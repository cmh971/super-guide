const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Gemini client. The model gets fed live web context gathered below, so it can
// answer questions about current events instead of only its training data.
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';

// How much web text to gather before handing it to the model.
const MAX_RESULTS = 5;
const PAGES_TO_READ = 2;
const PAGE_CHAR_LIMIT = 2500;

/**
 * Strip a chunk of HTML down to readable plain text.
 * Removes scripts/styles, tags, and decodes the most common entities.
 */
function htmlToText(html) {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Fetch a URL with a timeout so a slow page can't hang the command. */
async function fetchWithTimeout(url, ms = 8000) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), ms);
	try {
		return await fetch(url, {
			signal: controller.signal,
			headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/json' },
		});
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Search the web via DuckDuckGo's HTML endpoint (no API key required) and
 * return an array of { title, url, snippet } objects.
 */
async function searchWeb(query) {
	const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
	const res = await fetchWithTimeout(url);
	if (!res.ok) throw new Error(`search failed (${res.status})`);
	const html = await res.text();

	const results = [];
	// Each result link looks like: <a ... class="result__a" href="...">Title</a>
	const linkRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
	const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

	const snippets = [];
	let sm;
	while ((sm = snippetRegex.exec(html)) !== null) {
		snippets.push(htmlToText(sm[1]));
	}

	let m;
	let i = 0;
	while ((m = linkRegex.exec(html)) !== null && results.length < MAX_RESULTS) {
		let link = m[1];
		// DuckDuckGo wraps links in a redirect: /l/?uddg=<encoded real url>
		const uddg = link.match(/[?&]uddg=([^&]+)/);
		if (uddg) link = decodeURIComponent(uddg[1]);
		if (link.startsWith('//')) link = 'https:' + link;
		results.push({
			title: htmlToText(m[2]).slice(0, 200) || link,
			url: link,
			snippet: snippets[i] || '',
		});
		i++;
	}
	return results;
}

/**
 * Query DuckDuckGo's Instant Answer API for a quick factual abstract
 * (great for definitions, people, places). Returns a string or ''.
 */
async function instantAnswer(query) {
	const url =
		`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}` +
		'&format=json&no_html=1&skip_disambig=1';
	try {
		const res = await fetchWithTimeout(url, 6000);
		if (!res.ok) return '';
		const data = await res.json();
		if (data.AbstractText) {
			return `${data.AbstractText} (source: ${data.AbstractSource || 'DuckDuckGo'})`;
		}
		// Fall back to the first related topic if there's no direct abstract.
		const topic = Array.isArray(data.RelatedTopics)
			? data.RelatedTopics.find((t) => t && t.Text)
			: null;
		return topic ? topic.Text : '';
	} catch {
		return '';
	}
}

/** Download the top results and extract a slice of readable text from each. */
async function readPages(results) {
	const pages = [];
	for (const r of results.slice(0, PAGES_TO_READ)) {
		try {
			const res = await fetchWithTimeout(r.url, 8000);
			const ct = res.headers.get('content-type') || '';
			if (!res.ok || !ct.includes('text/html')) continue;
			const text = htmlToText(await res.text()).slice(0, PAGE_CHAR_LIMIT);
			if (text) pages.push({ url: r.url, title: r.title, text });
		} catch {
			// Skip pages that time out or block scraping.
		}
	}
	return pages;
}

/** Assemble the gathered web data into a single context block for the model. */
function buildContext(results, pages, abstract) {
	let ctx = '';
	if (abstract) ctx += `QUICK ANSWER:\n${abstract}\n\n`;
	ctx += 'SEARCH RESULTS:\n';
	results.forEach((r, idx) => {
		ctx += `[${idx + 1}] ${r.title}\n${r.url}\n${r.snippet}\n\n`;
	});
	if (pages.length) {
		ctx += '\nPAGE CONTENT:\n';
		pages.forEach((p) => {
			ctx += `--- ${p.title} (${p.url}) ---\n${p.text}\n\n`;
		});
	}
	return ctx;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('chat')
		.setDescription('Talk to Gemini AI — now with live web search')
		.addStringOption((option) =>
			option
				.setName('prompt')
				.setDescription('What do you want to ask?')
				.setRequired(true))
		.addBooleanOption((option) =>
			option
				.setName('web')
				.setDescription('Search the web for up-to-date info (default: on)')
				.setRequired(false)),

	// exported so other modules/tests can reuse the web search if needed
	searchWeb,
	readPages,
	instantAnswer,

	async execute(interaction) {
		const prompt = interaction.options.getString('prompt');
		const useWeb = interaction.options.getBoolean('web') ?? true;

		await interaction.deferReply();

		try {
			let finalPrompt = prompt;
			let sources = [];

			if (useWeb) {
				await interaction.editReply('🔎 Searching the web…');
				// Run the search and the instant-answer lookup in parallel.
				const [results, abstract] = await Promise.all([
					searchWeb(prompt).catch(() => []),
					instantAnswer(prompt).catch(() => ''),
				]);

				if (results.length || abstract) {
					const pages = await readPages(results);
					const context = buildContext(results, pages, abstract);
					sources = results.slice(0, MAX_RESULTS);

					finalPrompt =
						'You are a helpful assistant with access to the following live web ' +
						'search results. Use them to answer the question accurately and ' +
						'concisely. Cite sources inline using their [number]. If the results ' +
						"don't contain the answer, say so and answer from your own knowledge.\n\n" +
						`${context}\n\nQUESTION: ${prompt}`;
				}
			}

			const result = await model.generateContent(finalPrompt);
			const text = (await result.response).text();

			const embed = new EmbedBuilder()
				.setColor('#5865F2')
				.setAuthor({ name: useWeb ? '🌐 Gemini (web-enabled)' : '🤖 Gemini' })
				.setDescription(text.slice(0, 4000));

			if (sources.length) {
				const list = sources
					.map((s, i) => `\`[${i + 1}]\` [${s.title.slice(0, 60)}](${s.url})`)
					.join('\n')
					.slice(0, 1024);
				embed.addFields({ name: '📚 Sources', value: list });
			}

			embed.setFooter({ text: `Asked by ${interaction.user.username}` }).setTimestamp();
			await interaction.editReply({ content: '', embeds: [embed] });
		} catch (error) {
			console.error('[chat] error:', error);
			await interaction.editReply('I ran into an error trying to process that prompt.');
		}
	},
};
