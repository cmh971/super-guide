// funbox.js — parent command grouping novelty + text-analysis commands as
// subcommands (e.g. /funbox catfact, /funbox textstats).
const { makeParent } = require('./tools/subcommand-router');

module.exports = makeParent('funbox', 'Fun, novelty & text-analysis commands', [
    'catfact', 'dogfact', 'numfact', 'pickupline', 'riddle', 'proverb',
    'cookie', 'neverhaveiever', 'hype', 'insult', 'lorem', 'namegen',
    'gamertag', 'bandname', 'lovecalc', 'conch', 'rpsls', 'yesno',
    'vowelcount', 'charcount', 'syllables', 'acronym', 'textstats',
    'charinfo', 'dadjoke',
]);
