// tools/subcommand-router.js
// Discord caps an app at 100 GLOBAL slash commands, but this bot ships far more.
// Rather than dropping the extra novelty commands, we re-expose them as
// SUBCOMMANDS of a few parent commands (e.g. /text flip, /funbox catfact).
//
// makeParent() builds a parent command that:
//   • assembles its subcommand list from each child's existing SlashCommandBuilder
//     (so child option schemas/choices/required-ness carry over untouched), and
//   • on invoke, routes to the matching child's execute().
//
// The child files stay exactly as they are — they keep working as standalone
// modules; they're just excluded from direct global registration in
// deploy-commands.js and surfaced through a parent instead.

const path = require('node:path');

const ROOT = path.join(__dirname, '..');

/**
 * @param {string} name        parent command name (must be unique, lowercase)
 * @param {string} description parent command description
 * @param {string[]} childNames file basenames (without .js) at the repo root
 */
function makeParent(name, description, childNames) {
    // Require each child once and key it by its own command name.
    const children = new Map();
    const subcommands = [];

    for (const cn of childNames) {
        const mod = require(path.join(ROOT, `${cn}.js`));
        if (!mod || !mod.data || typeof mod.execute !== 'function') {
            throw new Error(`subcommand-router: '${cn}' is missing data/execute`);
        }
        const cj = mod.data.toJSON();
        children.set(cj.name, mod);
        subcommands.push({
            type: 1, // SUB_COMMAND
            name: cj.name,
            description: (cj.description || cj.name).slice(0, 100),
            options: cj.options || [],
        });
    }

    if (subcommands.length > 25) {
        throw new Error(`subcommand-router: '${name}' has ${subcommands.length} subcommands (max 25)`);
    }

    const json = { name, description: description.slice(0, 100), type: 1, options: subcommands };

    return {
        // `data` only needs .name (for the loaders) and .toJSON() (for deploy).
        data: { name, toJSON: () => json },
        async execute(interaction) {
            const sub = interaction.options.getSubcommand();
            const child = children.get(sub);
            if (!child) {
                return interaction.reply({ content: `Unknown subcommand: ${sub}`, ephemeral: true });
            }
            return child.execute(interaction);
        },
    };
}

module.exports = { makeParent };
