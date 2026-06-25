// random.js — parent command grouping the random / dice / generator commands
// as subcommands (e.g. /random wheel, /random d6).
const { makeParent } = require('./tools/subcommand-router');

module.exports = makeParent('random', 'Random pickers, dice & generators', [
    'randomemoji', 'randomhex', 'scrabble', 'wheel', 'chance', 'fromroman',
    'd6', 'flipcoins', 'fortune',
]);
