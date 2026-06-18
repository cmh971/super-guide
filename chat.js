const { SlashCommandBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

module.exports = {
	data: new SlashCommandBuilder()
		.setName('chat')
		.setDescription('Talk to Gemini AI')
		.addStringOption(option =>
			option.setName('prompt')
				.setDescription('What do you want to ask?')
				.setRequired(true)),
	async execute(interaction) {
		const prompt = interaction.options.getString('prompt');
		
		// Defer the reply because AI takes time to think
		await interaction.deferReply();

		try {
			const result = await model.generateContent(prompt);
			const response = await result.response;
			const text = response.text();

			await interaction.editReply(text.slice(0, 2000)); // Discord limit is 2000 chars
		} catch (error) {
			console.error(error);
			await interaction.editReply('I ran into an error trying to process that prompt.');
		}
	},
};