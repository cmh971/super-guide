const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fun')
        .setDescription('Fun commands')
        .addSubcommand(s => s.setName('8ball').setDescription('Ask the magic 8ball').addStringOption(o => o.setName('question').setDescription('Your question').setRequired(true)))
        .addSubcommand(s => s.setName('coinflip').setDescription('Flip a coin'))
        .addSubcommand(s => s.setName('roll').setDescription('Roll a die').addIntegerOption(o => o.setName('sides').setDescription('Sides (default 6)')))
        .addSubcommand(s => s.setName('rps').setDescription('Rock Paper Scissors').addStringOption(o => o.setName('choice').setDescription('Pick one').setRequired(true).addChoices({name:'Rock',value:'rock'},{name:'Paper',value:'paper'},{name:'Scissors',value:'scissors'})))
        .addSubcommand(s => s.setName('joke').setDescription('Get a random joke'))
        .addSubcommand(s => s.setName('meme').setDescription('Get a random meme'))
        .addSubcommand(s => s.setName('mock').setDescription('mOcK tExT').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)))
        .addSubcommand(s => s.setName('reverse').setDescription('esrever txeT').addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)))
        .addSubcommand(s => s.setName('ship').setDescription('Check compatibility').addUserOption(o => o.setName('u1').setDescription('User 1').setRequired(true)).addUserOption(o => o.setName('u2').setDescription('User 2')))
        .addSubcommand(s => s.setName('rate').setDescription('Rate something').addStringOption(o => o.setName('thing').setDescription('What to rate').setRequired(true))),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        if (sub === '8ball') {
            const responses = ['Yes', 'No', 'Maybe', 'Ask later', 'Definitely', 'Highly unlikely'];
            return interaction.reply(`🎱 ${responses[Math.floor(Math.random() * responses.length)]}`);
        }

        if (sub === 'coinflip') {
            return interaction.reply(`🪙 It landed on: **${Math.random() > 0.5 ? 'Heads' : 'Tails'}**`);
        }

        if (sub === 'joke') {
            const res = await fetch('https://official-joke-api.appspot.com/random_joke').then(r => r.json());
            return interaction.reply(`${res.setup}\n\n*${res.punchline}*`);
        }

        if (sub === 'mock') {
            const text = interaction.options.getString('text');
            const mocked = text.split('').map((c, i) => i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()).join('');
            return interaction.reply(mocked);
        }

        if (sub === 'roll') {
            const sides = interaction.options.getInteger('sides') || 6;
            return interaction.reply(`🎲 You rolled a **${Math.floor(Math.random() * sides) + 1}**`);
        }

        if (sub === 'reverse') {
            return interaction.reply(interaction.options.getString('text').split('').reverse().join(''));
        }

        if (sub === 'rps') {
            const choices = ['rock', 'paper', 'scissors'];
            const botChoice = choices[Math.floor(Math.random() * 3)];
            return interaction.reply(`You chose **${interaction.options.getString('choice')}**, I chose **${botChoice}**!`);
        }

        if (sub === 'meme') {
            const res = await fetch('https://meme-api.com/gimme').then(r => r.json());
            return interaction.reply(res.url);
        }

        if (sub === 'ship') {
            const score = Math.floor(Math.random() * 101);
            return interaction.reply(`💖 Compatibility score: **${score}%**`);
        }

        if (sub === 'rate') {
            return interaction.reply(`I rate **${interaction.options.getString('thing')}** a **${Math.floor(Math.random() * 11)}/10**`);
        }
    }
};