// icons.js — Kansas State Roleplay icon gallery.
// Browse the built-in icon pack (40 static SVG-rendered PNG badges + 11 animated
// GIF badges) in an embed and, with one button, upload the current one as a real
// custom emoji in this server. Static icons are authored as SVG and rasterised by
// tools/svg2png.js; animated icons are rendered by tools/anim-icons.js + tools/gif.js.

const {
    SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ComponentType,
} = require('discord.js');
const { ICONS, render } = require('./tools/icon-render');
const { ANIMS, renderGif } = require('./tools/anim-icons');

// Unified catalogue: static icons first, then animated ones. Each entry knows
// how to produce its own image buffer and whether it's a GIF.
const CATALOG = [
    ...ICONS.map((ic, i) => ({ name: ic.name, label: ic.label, color: ic.color, animated: false, buf: () => render(i) })),
    ...ANIMS.map((a, i) => ({ name: a.name, label: a.label, color: a.color, animated: true, buf: () => renderGif(i) })),
];

// Build the panel (embed + attachment + buttons) for a given catalogue index.
function panel(index) {
    const ic = CATALOG[index];
    const ext = ic.animated ? 'gif' : 'png';
    const file = new AttachmentBuilder(ic.buf(), { name: `icon.${ext}` });
    const kind = ic.animated ? '🎞️ Animated' : '🎨 Static';

    const embed = new EmbedBuilder()
        .setColor(ic.color)
        .setTitle(`${kind} · ${ic.label}`)
        .setDescription(`Icon **${index + 1}** of **${CATALOG.length}**\nEmoji name when added: \`:${ic.name}:\``)
        .setImage(`attachment://icon.${ext}`)
        .setFooter({ text: 'Use ◀ ▶ to browse · ➕ to add this icon to the server' });

    const nav = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('icon_prev').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('icon_count').setLabel(`${index + 1}/${CATALOG.length}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('icon_next').setEmoji('▶️').setStyle(ButtonStyle.Secondary),
    );
    const action = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('icon_add').setLabel('Add to server').setEmoji('➕').setStyle(ButtonStyle.Success),
    );

    return { embeds: [embed], files: [file], components: [nav, action] };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('icons')
        .setDescription('Browse the icon pack (static + animated) and add icons as custom emojis')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions)
        .addIntegerOption(o =>
            o.setName('number')
                .setDescription(`Jump straight to an icon (1-${CATALOG.length})`)
                .setMinValue(1)
                .setMaxValue(CATALOG.length)
                .setRequired(false)),

    async execute(interaction) {
        let index = (interaction.options.getInteger('number') || 1) - 1;

        const message = await interaction.reply({ ...panel(index), fetchReply: true });

        // Only the invoker drives this panel; it stays live for 5 minutes.
        const collector = message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 5 * 60 * 1000,
            filter: i => i.user.id === interaction.user.id,
        });

        collector.on('collect', async i => {
            if (i.customId === 'icon_prev') {
                index = (index - 1 + CATALOG.length) % CATALOG.length;
                return i.update(panel(index));
            }
            if (i.customId === 'icon_next') {
                index = (index + 1) % CATALOG.length;
                return i.update(panel(index));
            }
            if (i.customId === 'icon_add') {
                const me = i.guild.members.me;
                if (!me?.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) {
                    return i.reply({ content: "❌ I need the **Manage Expressions** (Manage Emojis & Stickers) permission to add emojis.", flags: [MessageFlags.Ephemeral] });
                }

                const ic = CATALOG[index];
                // Discord emoji names must be unique per guild — suffix on collision.
                let name = ic.name;
                const taken = new Set(i.guild.emojis.cache.map(e => e.name));
                for (let n = 2; taken.has(name) && n < 100; n++) name = `${ic.name}_${n}`.slice(0, 32);

                try {
                    const emoji = await i.guild.emojis.create({ attachment: ic.buf(), name });
                    return i.reply({ content: `✅ Added ${emoji} as \`:${emoji.name}:\``, flags: [MessageFlags.Ephemeral] });
                } catch (err) {
                    const reason = /Maximum number of emojis/i.test(err.message)
                        ? `this server has reached its ${ic.animated ? 'animated ' : ''}emoji limit.`
                        : err.message;
                    return i.reply({ content: `❌ Couldn't add the emoji: ${reason}`, flags: [MessageFlags.Ephemeral] });
                }
            }
        });

        collector.on('end', async () => {
            // Grey out the controls once the panel expires.
            const dead = panel(index);
            dead.components.forEach(row => row.components.forEach(b => b.setDisabled(true)));
            await message.edit({ components: dead.components }).catch(() => null);
        });
    },
};
