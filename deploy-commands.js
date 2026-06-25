require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Discord allows a maximum of 100 GLOBAL slash commands per app, but we ship
// far more than that. Instead of dropping the extras, these niche commands are
// excluded from DIRECT global registration and re-exposed as SUBCOMMANDS of the
// parent commands /text, /funbox and /random (see *.js + tools/subcommand-router.js).
// They still load in the bot — they're just reached via their parent command.
const EXCLUDE = new Set([
	// → /text  (text styling & transforms)
	'spaceout', 'bubbletext', 'smallcaps', 'zalgo', 'flip', 'mirrortext',
	'reverseeach', 'redact', 'shuffleletters', 'emojiletters', 'numemoji',
	'braille', 'nato', 'asciicode', 'fromascii', 'stutter', 'spongebob',
	'owoify', 'piglatin', 'slugify', 'rot13', 'uppercase', 'lowercase',
	'titlecase', 'clap',
	// → /funbox  (novelty + text analysis)
	'catfact', 'dogfact', 'numfact', 'pickupline', 'riddle', 'proverb',
	'cookie', 'neverhaveiever', 'hype', 'insult', 'lorem', 'namegen',
	'gamertag', 'bandname', 'lovecalc', 'conch', 'rpsls', 'yesno',
	'vowelcount', 'charcount', 'syllables', 'acronym', 'textstats',
	'charinfo', 'dadjoke',
	// → /random  (random pickers, dice, generators)
	'randomemoji', 'randomhex', 'scrabble', 'wheel', 'chance', 'fromroman',
	'd6', 'flipcoins', 'fortune',
]);

const commands = [];
const commandFiles = fs.readdirSync(__dirname).filter(file =>
	file.endsWith('.js') &&
	file !== 'index.js' &&
	file !== 'deploy-commands.js'
);

for (const file of commandFiles) {
	const filePath = path.join(__dirname, file);
	const command = require(filePath);
	if ('data' in command && 'execute' in command) {
		if (EXCLUDE.has(command.data.name)) continue;
		commands.push(command.data.toJSON());
	}
}

// Hard safety: never send more than 100 (Discord rejects the whole request otherwise).
if (commands.length > 100) {
	console.warn(`⚠️  ${commands.length} commands after exclude — trimming to 100.`);
	commands.length = 100;
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		const data = await rest.put(
			Routes.applicationCommands(process.env.CLIENT_ID),
			{ body: commands },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		console.error(error);
	}
})();