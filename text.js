// text.js — parent command grouping the text styling / transform tools as
// subcommands (e.g. /text flip, /text zalgo). See tools/subcommand-router.js.
const { makeParent } = require('./tools/subcommand-router');

module.exports = makeParent('text', 'Text styling & transformation tools', [
    'spaceout', 'bubbletext', 'smallcaps', 'zalgo', 'flip', 'mirrortext',
    'reverseeach', 'redact', 'shuffleletters', 'emojiletters', 'numemoji',
    'braille', 'nato', 'asciicode', 'fromascii', 'stutter', 'spongebob',
    'owoify', 'piglatin', 'slugify', 'rot13', 'uppercase', 'lowercase',
    'titlecase', 'clap',
]);
