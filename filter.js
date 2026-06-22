/**
 * filter.js — Smart word filter for California State Roleplay.
 *
 * ⚠️  GENERATED FILE. Edit tools/filter.template.js and run
 *     `node tools/build-filter.js` to regenerate. Do not hand-edit or it will be overwritten bc it may amke the bot blow up.
 *
 * This command provides a powerful, bypass-resistant word filter with optional
 *
 * Features:
 *   • /filter enable|disable        toggle the filter per server
 *   • Checks every message against words.json (your block list)
 *   • Defeats bypasses with RegEx + a Unicode "confusables" map, so
 *       b.a.d.w.o.r.d , b a d w o r d , b@dw0rd and bаdwоrd (Cyrillic) all match
 *   • When it's unsure (a "confused" near-miss) it asks Gemini AI to decide
 *
 * The heavy CONFUSABLES table below is generated from the official Unicode
 * security "confusables" data — that's what catches lookalike-character tricks.
 */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('node:fs');
const path = require('node:path');

// ---- Gemini (lazy, optional) ----------------------------------------------
let genAI = null;
function getModel() {
    if (!process.env.GEMINI_API_KEY) return null;
    if (!genAI) {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }
    return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

// ---- Per-guild config ------------------------------------------------------
const filterConfigSchema = new mongoose.Schema({
    guildId: { type: String, unique: true },
    enabled: { type: Boolean, default: false },
    useAI: { type: Boolean, default: true },
    action: { type: String, default: 'delete' }
});
const FilterConfig = mongoose.models.FilterConfig || mongoose.model('FilterConfig', filterConfigSchema);

// ---- Homoglyph / confusable map: lookalike char -> plain ascii -------------
const CONFUSABLES = {
    // ===== characters that look like '2' =====
    // U+01A7 LATIN CAPITAL LETTER TONE TWO -> 2
    "Ƨ": "2",
    // U+03E8 COPTIC CAPITAL LETTER HORI -> 2
    "Ϩ": "2",
    // U+14BF CANADIAN SYLLABICS SAYISI M -> 2
    "ᒿ": "2",
    // U+A644 CYRILLIC CAPITAL LETTER REVERSED DZE -> 2
    "Ꙅ": "2",
    // U+A6EF BAMUM LETTER KOGHOM -> 2
    "ꛯ": "2",
    // U+A75A LATIN CAPITAL LETTER R ROTUNDA -> 2
    "Ꝛ": "2",
    // U+1CCF2 OUTLINED DIGIT TWO -> 2
    "𜳲": "2",
    // U+1D7D0 MATHEMATICAL BOLD DIGIT TWO -> 2
    "𝟐": "2",
    // U+1D7DA MATHEMATICAL DOUBLE-STRUCK DIGIT TWO -> 2
    "𝟚": "2",
    // U+1D7E4 MATHEMATICAL SANS-SERIF DIGIT TWO -> 2
    "𝟤": "2",
    // U+1D7EE MATHEMATICAL SANS-SERIF BOLD DIGIT TWO -> 2
    "𝟮": "2",
    // U+1D7F8 MATHEMATICAL MONOSPACE DIGIT TWO -> 2
    "𝟸": "2",
    // U+1FBF2 SEGMENTED DIGIT TWO -> 2
    "🯲": "2",
    // ===== characters that look like '3' =====
    // U+01B7 LATIN CAPITAL LETTER EZH -> 3
    "Ʒ": "3",
    // U+021C LATIN CAPITAL LETTER YOGH -> 3
    "Ȝ": "3",
    // U+0417 CYRILLIC CAPITAL LETTER ZE -> 3
    "З": "3",
    // U+04E0 CYRILLIC CAPITAL LETTER ABKHASIAN DZE -> 3
    "Ӡ": "3",
    // U+0969 DEVANAGARI DIGIT THREE -> 3
    "३": "3",
    // U+0AE9 GUJARATI DIGIT THREE -> 3
    "૩": "3",
    // U+2C9C COPTIC CAPITAL LETTER KSI -> 3
    "Ⲝ": "3",
    // U+2CC4 COPTIC CAPITAL LETTER OLD COPTIC SHEI -> 3
    "Ⳅ": "3",
    // U+2CCC COPTIC CAPITAL LETTER OLD COPTIC HORI -> 3
    "Ⳍ": "3",
    // U+A76A LATIN CAPITAL LETTER ET -> 3
    "Ꝫ": "3",
    // U+A7AB LATIN CAPITAL LETTER REVERSED OPEN E -> 3
    "Ɜ": "3",
    // U+118CA WARANG CITI SMALL LETTER ANG -> 3
    "𑣊": "3",
    // U+16F3B MIAO LETTER ZA -> 3
    "𖼻": "3",
    // U+1CCF3 OUTLINED DIGIT THREE -> 3
    "𜳳": "3",
    // U+1D206 GREEK VOCAL NOTATION SYMBOL-7 -> 3
    "𝈆": "3",
    // U+1D7D1 MATHEMATICAL BOLD DIGIT THREE -> 3
    "𝟑": "3",
    // U+1D7DB MATHEMATICAL DOUBLE-STRUCK DIGIT THREE -> 3
    "𝟛": "3",
    // U+1D7E5 MATHEMATICAL SANS-SERIF DIGIT THREE -> 3
    "𝟥": "3",
    // U+1D7EF MATHEMATICAL SANS-SERIF BOLD DIGIT THREE -> 3
    "𝟯": "3",
    // U+1D7F9 MATHEMATICAL MONOSPACE DIGIT THREE -> 3
    "𝟹": "3",
    // U+1FBF3 SEGMENTED DIGIT THREE -> 3
    "🯳": "3",
    // ===== characters that look like '4' =====
    // U+13CE CHEROKEE LETTER SE -> 4
    "Ꮞ": "4",
    // U+118AF WARANG CITI CAPITAL LETTER UC -> 4
    "𑢯": "4",
    // U+1CCF4 OUTLINED DIGIT FOUR -> 4
    "𜳴": "4",
    // U+1D7D2 MATHEMATICAL BOLD DIGIT FOUR -> 4
    "𝟒": "4",
    // U+1D7DC MATHEMATICAL DOUBLE-STRUCK DIGIT FOUR -> 4
    "𝟜": "4",
    // U+1D7E6 MATHEMATICAL SANS-SERIF DIGIT FOUR -> 4
    "𝟦": "4",
    // U+1D7F0 MATHEMATICAL SANS-SERIF BOLD DIGIT FOUR -> 4
    "𝟰": "4",
    // U+1D7FA MATHEMATICAL MONOSPACE DIGIT FOUR -> 4
    "𝟺": "4",
    // U+1FBF4 SEGMENTED DIGIT FOUR -> 4
    "🯴": "4",
    // ===== characters that look like '5' =====
    // U+01BC LATIN CAPITAL LETTER TONE FIVE -> 5
    "Ƽ": "5",
    // U+118BB WARANG CITI CAPITAL LETTER HORR -> 5
    "𑢻": "5",
    // U+1CCF5 OUTLINED DIGIT FIVE -> 5
    "𜳵": "5",
    // U+1D7D3 MATHEMATICAL BOLD DIGIT FIVE -> 5
    "𝟓": "5",
    // U+1D7DD MATHEMATICAL DOUBLE-STRUCK DIGIT FIVE -> 5
    "𝟝": "5",
    // U+1D7E7 MATHEMATICAL SANS-SERIF DIGIT FIVE -> 5
    "𝟧": "5",
    // U+1D7F1 MATHEMATICAL SANS-SERIF BOLD DIGIT FIVE -> 5
    "𝟱": "5",
    // U+1D7FB MATHEMATICAL MONOSPACE DIGIT FIVE -> 5
    "𝟻": "5",
    // U+1FBF5 SEGMENTED DIGIT FIVE -> 5
    "🯵": "5",
    // ===== characters that look like '6' =====
    // U+03EC COPTIC CAPITAL LETTER SHIMA -> 6
    "Ϭ": "6",
    // U+0431 CYRILLIC SMALL LETTER BE -> 6
    "б": "6",
    // U+13EE CHEROKEE LETTER WV -> 6
    "Ꮾ": "6",
    // U+2CD2 COPTIC CAPITAL LETTER OLD COPTIC HEI -> 6
    "Ⳓ": "6",
    // U+2CD3 COPTIC SMALL LETTER OLD COPTIC HEI -> 6
    "ⳓ": "6",
    // U+2CDC COPTIC CAPITAL LETTER OLD NUBIAN SHIMA -> 6
    "Ⳝ": "6",
    // U+118D5 WARANG CITI SMALL LETTER AT -> 6
    "𑣕": "6",
    // U+1CCF6 OUTLINED DIGIT SIX -> 6
    "𜳶": "6",
    // U+1D7D4 MATHEMATICAL BOLD DIGIT SIX -> 6
    "𝟔": "6",
    // U+1D7DE MATHEMATICAL DOUBLE-STRUCK DIGIT SIX -> 6
    "𝟞": "6",
    // U+1D7E8 MATHEMATICAL SANS-SERIF DIGIT SIX -> 6
    "𝟨": "6",
    // U+1D7F2 MATHEMATICAL SANS-SERIF BOLD DIGIT SIX -> 6
    "𝟲": "6",
    // U+1D7FC MATHEMATICAL MONOSPACE DIGIT SIX -> 6
    "𝟼": "6",
    // U+1FBF6 SEGMENTED DIGIT SIX -> 6
    "🯶": "6",
    // ===== characters that look like '7' =====
    // U+104D2 OSAGE CAPITAL LETTER ZA -> 7
    "𐓒": "7",
    // U+118C6 WARANG CITI SMALL LETTER II -> 7
    "𑣆": "7",
    // U+1CCF7 OUTLINED DIGIT SEVEN -> 7
    "𜳷": "7",
    // U+1D212 GREEK VOCAL NOTATION SYMBOL-19 -> 7
    "𝈒": "7",
    // U+1D7D5 MATHEMATICAL BOLD DIGIT SEVEN -> 7
    "𝟕": "7",
    // U+1D7DF MATHEMATICAL DOUBLE-STRUCK DIGIT SEVEN -> 7
    "𝟟": "7",
    // U+1D7E9 MATHEMATICAL SANS-SERIF DIGIT SEVEN -> 7
    "𝟩": "7",
    // U+1D7F3 MATHEMATICAL SANS-SERIF BOLD DIGIT SEVEN -> 7
    "𝟳": "7",
    // U+1D7FD MATHEMATICAL MONOSPACE DIGIT SEVEN -> 7
    "𝟽": "7",
    // U+1FBF7 SEGMENTED DIGIT SEVEN -> 7
    "🯷": "7",
    // ===== characters that look like '8' =====
    // U+0222 LATIN CAPITAL LETTER OU -> 8
    "Ȣ": "8",
    // U+0223 LATIN SMALL LETTER OU -> 8
    "ȣ": "8",
    // U+09EA BENGALI DIGIT FOUR -> 8
    "৪": "8",
    // U+0A6A GURMUKHI DIGIT FOUR -> 8
    "੪": "8",
    // U+0B03 ORIYA SIGN VISARGA -> 8
    "ଃ": "8",
    // U+1031A OLD ITALIC LETTER EF -> 8
    "𐌚": "8",
    // U+1CCF8 OUTLINED DIGIT EIGHT -> 8
    "𜳸": "8",
    // U+1D7D6 MATHEMATICAL BOLD DIGIT EIGHT -> 8
    "𝟖": "8",
    // U+1D7E0 MATHEMATICAL DOUBLE-STRUCK DIGIT EIGHT -> 8
    "𝟠": "8",
    // U+1D7EA MATHEMATICAL SANS-SERIF DIGIT EIGHT -> 8
    "𝟪": "8",
    // U+1D7F4 MATHEMATICAL SANS-SERIF BOLD DIGIT EIGHT -> 8
    "𝟴": "8",
    // U+1D7FE MATHEMATICAL MONOSPACE DIGIT EIGHT -> 8
    "𝟾": "8",
    // U+1E8CB MENDE KIKAKUI DIGIT FIVE -> 8
    "𞣋": "8",
    // U+1FBF8 SEGMENTED DIGIT EIGHT -> 8
    "🯸": "8",
    // ===== characters that look like '9' =====
    // U+09ED BENGALI DIGIT SEVEN -> 9
    "৭": "9",
    // U+0A67 GURMUKHI DIGIT ONE -> 9
    "੧": "9",
    // U+0B68 ORIYA DIGIT TWO -> 9
    "୨": "9",
    // U+0D6D MALAYALAM DIGIT SEVEN -> 9
    "൭": "9",
    // U+2CCA COPTIC CAPITAL LETTER DIALECT-P HORI -> 9
    "Ⳋ": "9",
    // U+2CCB COPTIC SMALL LETTER DIALECT-P HORI -> 9
    "ⳋ": "9",
    // U+A76E LATIN CAPITAL LETTER CON -> 9
    "Ꝯ": "9",
    // U+118AC WARANG CITI CAPITAL LETTER KO -> 9
    "𑢬": "9",
    // U+118CC WARANG CITI SMALL LETTER KO -> 9
    "𑣌": "9",
    // U+118D6 WARANG CITI SMALL LETTER AM -> 9
    "𑣖": "9",
    // U+1CCF9 OUTLINED DIGIT NINE -> 9
    "𜳹": "9",
    // U+1D7D7 MATHEMATICAL BOLD DIGIT NINE -> 9
    "𝟗": "9",
    // U+1D7E1 MATHEMATICAL DOUBLE-STRUCK DIGIT NINE -> 9
    "𝟡": "9",
    // U+1D7EB MATHEMATICAL SANS-SERIF DIGIT NINE -> 9
    "𝟫": "9",
    // U+1D7F5 MATHEMATICAL SANS-SERIF BOLD DIGIT NINE -> 9
    "𝟵": "9",
    // U+1D7FF MATHEMATICAL MONOSPACE DIGIT NINE -> 9
    "𝟿": "9",
    // U+1FBF9 SEGMENTED DIGIT NINE -> 9
    "🯹": "9",
    // ===== characters that look like 'a' =====
    // U+0251 LATIN SMALL LETTER ALPHA -> a
    "ɑ": "a",
    // U+0391 GREEK CAPITAL LETTER ALPHA -> a
    "Α": "a",
    // U+03B1 GREEK SMALL LETTER ALPHA -> a
    "α": "a",
    // U+0410 CYRILLIC CAPITAL LETTER A -> a
    "А": "a",
    // U+0430 CYRILLIC SMALL LETTER A -> a
    "а": "a",
    // U+13AA CHEROKEE LETTER GO -> a
    "Ꭺ": "a",
    // U+15C5 CANADIAN SYLLABICS CARRIER GHO -> a
    "ᗅ": "a",
    // U+237A APL FUNCTIONAL SYMBOL ALPHA -> a
    "⍺": "a",
    // U+A4EE LISU LETTER A -> a
    "ꓮ": "a",
    // U+FF21 FULLWIDTH LATIN CAPITAL LETTER A -> a
    "Ａ": "a",
    // U+FF41 FULLWIDTH LATIN SMALL LETTER A -> a
    "ａ": "a",
    // U+102A0 CARIAN LETTER A -> a
    "𐊠": "a",
    // U+16F40 MIAO LETTER ZZYA -> a
    "𖽀": "a",
    // U+1CCD6 OUTLINED LATIN CAPITAL LETTER A -> a
    "𜳖": "a",
    // U+1D400 MATHEMATICAL BOLD CAPITAL A -> a
    "𝐀": "a",
    // U+1D41A MATHEMATICAL BOLD SMALL A -> a
    "𝐚": "a",
    // U+1D434 MATHEMATICAL ITALIC CAPITAL A -> a
    "𝐴": "a",
    // U+1D44E MATHEMATICAL ITALIC SMALL A -> a
    "𝑎": "a",
    // U+1D468 MATHEMATICAL BOLD ITALIC CAPITAL A -> a
    "𝑨": "a",
    // U+1D482 MATHEMATICAL BOLD ITALIC SMALL A -> a
    "𝒂": "a",
    // U+1D49C MATHEMATICAL SCRIPT CAPITAL A -> a
    "𝒜": "a",
    // U+1D4B6 MATHEMATICAL SCRIPT SMALL A -> a
    "𝒶": "a",
    // U+1D4D0 MATHEMATICAL BOLD SCRIPT CAPITAL A -> a
    "𝓐": "a",
    // U+1D4EA MATHEMATICAL BOLD SCRIPT SMALL A -> a
    "𝓪": "a",
    // U+1D504 MATHEMATICAL FRAKTUR CAPITAL A -> a
    "𝔄": "a",
    // U+1D51E MATHEMATICAL FRAKTUR SMALL A -> a
    "𝔞": "a",
    // U+1D538 MATHEMATICAL DOUBLE-STRUCK CAPITAL A -> a
    "𝔸": "a",
    // U+1D552 MATHEMATICAL DOUBLE-STRUCK SMALL A -> a
    "𝕒": "a",
    // U+1D56C MATHEMATICAL BOLD FRAKTUR CAPITAL A -> a
    "𝕬": "a",
    // U+1D586 MATHEMATICAL BOLD FRAKTUR SMALL A -> a
    "𝖆": "a",
    // U+1D5A0 MATHEMATICAL SANS-SERIF CAPITAL A -> a
    "𝖠": "a",
    // U+1D5BA MATHEMATICAL SANS-SERIF SMALL A -> a
    "𝖺": "a",
    // U+1D5D4 MATHEMATICAL SANS-SERIF BOLD CAPITAL A -> a
    "𝗔": "a",
    // U+1D5EE MATHEMATICAL SANS-SERIF BOLD SMALL A -> a
    "𝗮": "a",
    // U+1D608 MATHEMATICAL SANS-SERIF ITALIC CAPITAL A -> a
    "𝘈": "a",
    // U+1D622 MATHEMATICAL SANS-SERIF ITALIC SMALL A -> a
    "𝘢": "a",
    // U+1D63C MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL A -> a
    "𝘼": "a",
    // U+1D656 MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL A -> a
    "𝙖": "a",
    // U+1D670 MATHEMATICAL MONOSPACE CAPITAL A -> a
    "𝙰": "a",
    // U+1D68A MATHEMATICAL MONOSPACE SMALL A -> a
    "𝚊": "a",
    // U+1D6A8 MATHEMATICAL BOLD CAPITAL ALPHA -> a
    "𝚨": "a",
    // U+1D6C2 MATHEMATICAL BOLD SMALL ALPHA -> a
    "𝛂": "a",
    // U+1D6E2 MATHEMATICAL ITALIC CAPITAL ALPHA -> a
    "𝛢": "a",
    // U+1D6FC MATHEMATICAL ITALIC SMALL ALPHA -> a
    "𝛼": "a",
    // U+1D71C MATHEMATICAL BOLD ITALIC CAPITAL ALPHA -> a
    "𝜜": "a",
    // U+1D736 MATHEMATICAL BOLD ITALIC SMALL ALPHA -> a
    "𝜶": "a",
    // U+1D756 MATHEMATICAL SANS-SERIF BOLD CAPITAL ALPHA -> a
    "𝝖": "a",
    // U+1D770 MATHEMATICAL SANS-SERIF BOLD SMALL ALPHA -> a
    "𝝰": "a",
    // U+1D790 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL ALPHA -> a
    "𝞐": "a",
    // U+1D7AA MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL ALPHA -> a
    "𝞪": "a",
    // ===== characters that look like 'b' =====
    // U+0184 LATIN CAPITAL LETTER TONE SIX -> b
    "Ƅ": "b",
    // U+0392 GREEK CAPITAL LETTER BETA -> b
    "Β": "b",
    // U+0412 CYRILLIC CAPITAL LETTER VE -> b
    "В": "b",
    // U+042C CYRILLIC CAPITAL LETTER SOFT SIGN -> b
    "Ь": "b",
    // U+13CF CHEROKEE LETTER SI -> b
    "Ꮟ": "b",
    // U+13F4 CHEROKEE LETTER YV -> b
    "Ᏼ": "b",
    // U+1472 CANADIAN SYLLABICS KA -> b
    "ᑲ": "b",
    // U+15AF CANADIAN SYLLABICS AIVILIK B -> b
    "ᖯ": "b",
    // U+15F7 CANADIAN SYLLABICS CARRIER KHE -> b
    "ᗷ": "b",
    // U+212C SCRIPT CAPITAL B -> b
    "ℬ": "b",
    // U+2C82 COPTIC CAPITAL LETTER VIDA -> b
    "Ⲃ": "b",
    // U+A4D0 LISU LETTER BA -> b
    "ꓐ": "b",
    // U+A7B4 LATIN CAPITAL LETTER BETA -> b
    "Ꞵ": "b",
    // U+FF22 FULLWIDTH LATIN CAPITAL LETTER B -> b
    "Ｂ": "b",
    // U+10282 LYCIAN LETTER B -> b
    "𐊂": "b",
    // U+102A1 CARIAN LETTER P2 -> b
    "𐊡": "b",
    // U+10301 OLD ITALIC LETTER BE -> b
    "𐌁": "b",
    // U+16EB6 BERIA ERFE CAPITAL LETTER UI -> b
    "𖺶": "b",
    // U+1CCD7 OUTLINED LATIN CAPITAL LETTER B -> b
    "𜳗": "b",
    // U+1D401 MATHEMATICAL BOLD CAPITAL B -> b
    "𝐁": "b",
    // U+1D41B MATHEMATICAL BOLD SMALL B -> b
    "𝐛": "b",
    // U+1D435 MATHEMATICAL ITALIC CAPITAL B -> b
    "𝐵": "b",
    // U+1D44F MATHEMATICAL ITALIC SMALL B -> b
    "𝑏": "b",
    // U+1D469 MATHEMATICAL BOLD ITALIC CAPITAL B -> b
    "𝑩": "b",
    // U+1D483 MATHEMATICAL BOLD ITALIC SMALL B -> b
    "𝒃": "b",
    // U+1D4B7 MATHEMATICAL SCRIPT SMALL B -> b
    "𝒷": "b",
    // U+1D4D1 MATHEMATICAL BOLD SCRIPT CAPITAL B -> b
    "𝓑": "b",
    // U+1D4EB MATHEMATICAL BOLD SCRIPT SMALL B -> b
    "𝓫": "b",
    // U+1D505 MATHEMATICAL FRAKTUR CAPITAL B -> b
    "𝔅": "b",
    // U+1D51F MATHEMATICAL FRAKTUR SMALL B -> b
    "𝔟": "b",
    // U+1D539 MATHEMATICAL DOUBLE-STRUCK CAPITAL B -> b
    "𝔹": "b",
    // U+1D553 MATHEMATICAL DOUBLE-STRUCK SMALL B -> b
    "𝕓": "b",
    // U+1D56D MATHEMATICAL BOLD FRAKTUR CAPITAL B -> b
    "𝕭": "b",
    // U+1D587 MATHEMATICAL BOLD FRAKTUR SMALL B -> b
    "𝖇": "b",
    // U+1D5A1 MATHEMATICAL SANS-SERIF CAPITAL B -> b
    "𝖡": "b",
    // U+1D5BB MATHEMATICAL SANS-SERIF SMALL B -> b
    "𝖻": "b",
    // U+1D5D5 MATHEMATICAL SANS-SERIF BOLD CAPITAL B -> b
    "𝗕": "b",
    // U+1D5EF MATHEMATICAL SANS-SERIF BOLD SMALL B -> b
    "𝗯": "b",
    // U+1D609 MATHEMATICAL SANS-SERIF ITALIC CAPITAL B -> b
    "𝘉": "b",
    // U+1D623 MATHEMATICAL SANS-SERIF ITALIC SMALL B -> b
    "𝘣": "b",
    // U+1D63D MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL B -> b
    "𝘽": "b",
    // U+1D657 MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL B -> b
    "𝙗": "b",
    // U+1D671 MATHEMATICAL MONOSPACE CAPITAL B -> b
    "𝙱": "b",
    // U+1D68B MATHEMATICAL MONOSPACE SMALL B -> b
    "𝚋": "b",
    // U+1D6A9 MATHEMATICAL BOLD CAPITAL BETA -> b
    "𝚩": "b",
    // U+1D6E3 MATHEMATICAL ITALIC CAPITAL BETA -> b
    "𝛣": "b",
    // U+1D71D MATHEMATICAL BOLD ITALIC CAPITAL BETA -> b
    "𝜝": "b",
    // U+1D757 MATHEMATICAL SANS-SERIF BOLD CAPITAL BETA -> b
    "𝝗": "b",
    // U+1D791 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL BETA -> b
    "𝞑": "b",
    // ===== characters that look like 'c' =====
    // U+03F2 GREEK LUNATE SIGMA SYMBOL -> c
    "ϲ": "c",
    // U+03F9 GREEK CAPITAL LUNATE SIGMA SYMBOL -> c
    "Ϲ": "c",
    // U+0421 CYRILLIC CAPITAL LETTER ES -> c
    "С": "c",
    // U+0441 CYRILLIC SMALL LETTER ES -> c
    "с": "c",
    // U+1004 MYANMAR LETTER NGA -> c
    "င": "c",
    // U+105A MYANMAR LETTER MON NGA -> c
    "ၚ": "c",
    // U+13DF CHEROKEE LETTER TLI -> c
    "Ꮯ": "c",
    // U+1D04 LATIN LETTER SMALL CAPITAL C -> c
    "ᴄ": "c",
    // U+2102 DOUBLE-STRUCK CAPITAL C -> c
    "ℂ": "c",
    // U+212D BLACK-LETTER CAPITAL C -> c
    "ℭ": "c",
    // U+216D ROMAN NUMERAL ONE HUNDRED -> c
    "Ⅽ": "c",
    // U+217D SMALL ROMAN NUMERAL ONE HUNDRED -> c
    "ⅽ": "c",
    // U+2CA4 COPTIC CAPITAL LETTER SIMA -> c
    "Ⲥ": "c",
    // U+2CA5 COPTIC SMALL LETTER SIMA -> c
    "ⲥ": "c",
    // U+A4DA LISU LETTER CA -> c
    "ꓚ": "c",
    // U+ABAF CHEROKEE SMALL LETTER TLI -> c
    "ꮯ": "c",
    // U+FF23 FULLWIDTH LATIN CAPITAL LETTER C -> c
    "Ｃ": "c",
    // U+FF43 FULLWIDTH LATIN SMALL LETTER C -> c
    "ｃ": "c",
    // U+102A2 CARIAN LETTER D -> c
    "𐊢": "c",
    // U+10302 OLD ITALIC LETTER KE -> c
    "𐌂": "c",
    // U+10415 DESERET CAPITAL LETTER CHEE -> c
    "𐐕": "c",
    // U+1043D DESERET SMALL LETTER CHEE -> c
    "𐐽": "c",
    // U+1051C ELBASAN LETTER SHE -> c
    "𐔜": "c",
    // U+118E9 WARANG CITI DIGIT NINE -> c
    "𑣩": "c",
    // U+118F2 WARANG CITI NUMBER NINETY -> c
    "𑣲": "c",
    // U+1CCD8 OUTLINED LATIN CAPITAL LETTER C -> c
    "𜳘": "c",
    // U+1D402 MATHEMATICAL BOLD CAPITAL C -> c
    "𝐂": "c",
    // U+1D41C MATHEMATICAL BOLD SMALL C -> c
    "𝐜": "c",
    // U+1D436 MATHEMATICAL ITALIC CAPITAL C -> c
    "𝐶": "c",
    // U+1D450 MATHEMATICAL ITALIC SMALL C -> c
    "𝑐": "c",
    // U+1D46A MATHEMATICAL BOLD ITALIC CAPITAL C -> c
    "𝑪": "c",
    // U+1D484 MATHEMATICAL BOLD ITALIC SMALL C -> c
    "𝒄": "c",
    // U+1D49E MATHEMATICAL SCRIPT CAPITAL C -> c
    "𝒞": "c",
    // U+1D4B8 MATHEMATICAL SCRIPT SMALL C -> c
    "𝒸": "c",
    // U+1D4D2 MATHEMATICAL BOLD SCRIPT CAPITAL C -> c
    "𝓒": "c",
    // U+1D4EC MATHEMATICAL BOLD SCRIPT SMALL C -> c
    "𝓬": "c",
    // U+1D520 MATHEMATICAL FRAKTUR SMALL C -> c
    "𝔠": "c",
    // U+1D554 MATHEMATICAL DOUBLE-STRUCK SMALL C -> c
    "𝕔": "c",
    // U+1D56E MATHEMATICAL BOLD FRAKTUR CAPITAL C -> c
    "𝕮": "c",
    // U+1D588 MATHEMATICAL BOLD FRAKTUR SMALL C -> c
    "𝖈": "c",
    // U+1D5A2 MATHEMATICAL SANS-SERIF CAPITAL C -> c
    "𝖢": "c",
    // U+1D5BC MATHEMATICAL SANS-SERIF SMALL C -> c
    "𝖼": "c",
    // U+1D5D6 MATHEMATICAL SANS-SERIF BOLD CAPITAL C -> c
    "𝗖": "c",
    // U+1D5F0 MATHEMATICAL SANS-SERIF BOLD SMALL C -> c
    "𝗰": "c",
    // U+1D60A MATHEMATICAL SANS-SERIF ITALIC CAPITAL C -> c
    "𝘊": "c",
    // U+1D624 MATHEMATICAL SANS-SERIF ITALIC SMALL C -> c
    "𝘤": "c",
    // U+1D63E MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL C -> c
    "𝘾": "c",
    // U+1D658 MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL C -> c
    "𝙘": "c",
    // U+1D672 MATHEMATICAL MONOSPACE CAPITAL C -> c
    "𝙲": "c",
    // U+1D68C MATHEMATICAL MONOSPACE SMALL C -> c
    "𝚌": "c",
    // U+1F74C ALCHEMICAL SYMBOL FOR CALX -> c
    "🝌": "c",
    // ===== characters that look like 'd' =====
    // U+0501 CYRILLIC SMALL LETTER KOMI DE -> d
    "ԁ": "d",
    // U+13A0 CHEROKEE LETTER A -> d
    "Ꭰ": "d",
    // U+13E7 CHEROKEE LETTER TSU -> d
    "Ꮷ": "d",
    // U+146F CANADIAN SYLLABICS KO -> d
    "ᑯ": "d",
    // U+15DE CANADIAN SYLLABICS CARRIER THE -> d
    "ᗞ": "d",
    // U+15EA CANADIAN SYLLABICS CARRIER PE -> d
    "ᗪ": "d",
    // U+2145 DOUBLE-STRUCK ITALIC CAPITAL D -> d
    "ⅅ": "d",
    // U+2146 DOUBLE-STRUCK ITALIC SMALL D -> d
    "ⅆ": "d",
    // U+216E ROMAN NUMERAL FIVE HUNDRED -> d
    "Ⅾ": "d",
    // U+217E SMALL ROMAN NUMERAL FIVE HUNDRED -> d
    "ⅾ": "d",
    // U+A4D2 LISU LETTER PHA -> d
    "ꓒ": "d",
    // U+A4D3 LISU LETTER DA -> d
    "ꓓ": "d",
    // U+1CCD9 OUTLINED LATIN CAPITAL LETTER D -> d
    "𜳙": "d",
    // U+1D403 MATHEMATICAL BOLD CAPITAL D -> d
    "𝐃": "d",
    // U+1D41D MATHEMATICAL BOLD SMALL D -> d
    "𝐝": "d",
    // U+1D437 MATHEMATICAL ITALIC CAPITAL D -> d
    "𝐷": "d",
    // U+1D451 MATHEMATICAL ITALIC SMALL D -> d
    "𝑑": "d",
    // U+1D46B MATHEMATICAL BOLD ITALIC CAPITAL D -> d
    "𝑫": "d",
    // U+1D485 MATHEMATICAL BOLD ITALIC SMALL D -> d
    "𝒅": "d",
    // U+1D49F MATHEMATICAL SCRIPT CAPITAL D -> d
    "𝒟": "d",
    // U+1D4B9 MATHEMATICAL SCRIPT SMALL D -> d
    "𝒹": "d",
    // U+1D4D3 MATHEMATICAL BOLD SCRIPT CAPITAL D -> d
    "𝓓": "d",
    // U+1D4ED MATHEMATICAL BOLD SCRIPT SMALL D -> d
    "𝓭": "d",
    // U+1D507 MATHEMATICAL FRAKTUR CAPITAL D -> d
    "𝔇": "d",
    // U+1D521 MATHEMATICAL FRAKTUR SMALL D -> d
    "𝔡": "d",
    // U+1D53B MATHEMATICAL DOUBLE-STRUCK CAPITAL D -> d
    "𝔻": "d",
    // U+1D555 MATHEMATICAL DOUBLE-STRUCK SMALL D -> d
    "𝕕": "d",
    // U+1D56F MATHEMATICAL BOLD FRAKTUR CAPITAL D -> d
    "𝕯": "d",
    // U+1D589 MATHEMATICAL BOLD FRAKTUR SMALL D -> d
    "𝖉": "d",
    // U+1D5A3 MATHEMATICAL SANS-SERIF CAPITAL D -> d
    "𝖣": "d",
    // U+1D5BD MATHEMATICAL SANS-SERIF SMALL D -> d
    "𝖽": "d",
    // U+1D5D7 MATHEMATICAL SANS-SERIF BOLD CAPITAL D -> d
    "𝗗": "d",
    // U+1D5F1 MATHEMATICAL SANS-SERIF BOLD SMALL D -> d
    "𝗱": "d",
    // U+1D60B MATHEMATICAL SANS-SERIF ITALIC CAPITAL D -> d
    "𝘋": "d",
    // U+1D625 MATHEMATICAL SANS-SERIF ITALIC SMALL D -> d
    "𝘥": "d",
    // U+1D63F MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL D -> d
    "𝘿": "d",
    // U+1D659 MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL D -> d
    "𝙙": "d",
    // U+1D673 MATHEMATICAL MONOSPACE CAPITAL D -> d
    "𝙳": "d",
    // U+1D68D MATHEMATICAL MONOSPACE SMALL D -> d
    "𝚍": "d",
    // ===== characters that look like 'e' =====
    // U+0395 GREEK CAPITAL LETTER EPSILON -> e
    "Ε": "e",
    // U+0415 CYRILLIC CAPITAL LETTER IE -> e
    "Е": "e",
    // U+0435 CYRILLIC SMALL LETTER IE -> e
    "е": "e",
    // U+04BD CYRILLIC SMALL LETTER ABKHASIAN CHE -> e
    "ҽ": "e",
    // U+13AC CHEROKEE LETTER GV -> e
    "Ꭼ": "e",
    // U+212E ESTIMATED SYMBOL -> e
    "℮": "e",
    // U+212F SCRIPT SMALL E -> e
    "ℯ": "e",
    // U+2130 SCRIPT CAPITAL E -> e
    "ℰ": "e",
    // U+2147 DOUBLE-STRUCK ITALIC SMALL E -> e
    "ⅇ": "e",
    // U+22FF Z NOTATION BAG MEMBERSHIP -> e
    "⋿": "e",
    // U+2D39 TIFINAGH LETTER YADD -> e
    "ⴹ": "e",
    // U+A4F0 LISU LETTER E -> e
    "ꓰ": "e",
    // U+AB32 LATIN SMALL LETTER BLACKLETTER E -> e
    "ꬲ": "e",
    // U+FF25 FULLWIDTH LATIN CAPITAL LETTER E -> e
    "Ｅ": "e",
    // U+FF45 FULLWIDTH LATIN SMALL LETTER E -> e
    "ｅ": "e",
    // U+10286 LYCIAN LETTER I -> e
    "𐊆": "e",
    // U+118A6 WARANG CITI CAPITAL LETTER II -> e
    "𑢦": "e",
    // U+118AE WARANG CITI CAPITAL LETTER YUJ -> e
    "𑢮": "e",
    // U+1CCDA OUTLINED LATIN CAPITAL LETTER E -> e
    "𜳚": "e",
    // U+1D404 MATHEMATICAL BOLD CAPITAL E -> e
    "𝐄": "e",
    // U+1D41E MATHEMATICAL BOLD SMALL E -> e
    "𝐞": "e",
    // U+1D438 MATHEMATICAL ITALIC CAPITAL E -> e
    "𝐸": "e",
    // U+1D452 MATHEMATICAL ITALIC SMALL E -> e
    "𝑒": "e",
    // U+1D46C MATHEMATICAL BOLD ITALIC CAPITAL E -> e
    "𝑬": "e",
    // U+1D486 MATHEMATICAL BOLD ITALIC SMALL E -> e
    "𝒆": "e",
    // U+1D4D4 MATHEMATICAL BOLD SCRIPT CAPITAL E -> e
    "𝓔": "e",
    // U+1D4EE MATHEMATICAL BOLD SCRIPT SMALL E -> e
    "𝓮": "e",
    // U+1D508 MATHEMATICAL FRAKTUR CAPITAL E -> e
    "𝔈": "e",
    // U+1D522 MATHEMATICAL FRAKTUR SMALL E -> e
    "𝔢": "e",
    // U+1D53C MATHEMATICAL DOUBLE-STRUCK CAPITAL E -> e
    "𝔼": "e",
    // U+1D556 MATHEMATICAL DOUBLE-STRUCK SMALL E -> e
    "𝕖": "e",
    // U+1D570 MATHEMATICAL BOLD FRAKTUR CAPITAL E -> e
    "𝕰": "e",
    // U+1D58A MATHEMATICAL BOLD FRAKTUR SMALL E -> e
    "𝖊": "e",
    // U+1D5A4 MATHEMATICAL SANS-SERIF CAPITAL E -> e
    "𝖤": "e",
    // U+1D5BE MATHEMATICAL SANS-SERIF SMALL E -> e
    "𝖾": "e",
    // U+1D5D8 MATHEMATICAL SANS-SERIF BOLD CAPITAL E -> e
    "𝗘": "e",
    // U+1D5F2 MATHEMATICAL SANS-SERIF BOLD SMALL E -> e
    "𝗲": "e",
    // U+1D60C MATHEMATICAL SANS-SERIF ITALIC CAPITAL E -> e
    "𝘌": "e",
    // U+1D626 MATHEMATICAL SANS-SERIF ITALIC SMALL E -> e
    "𝘦": "e",
    // U+1D640 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL E -> e
    "𝙀": "e",
    // U+1D65A MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL E -> e
    "𝙚": "e",
    // U+1D674 MATHEMATICAL MONOSPACE CAPITAL E -> e
    "𝙴": "e",
    // U+1D68E MATHEMATICAL MONOSPACE SMALL E -> e
    "𝚎": "e",
    // U+1D6AC MATHEMATICAL BOLD CAPITAL EPSILON -> e
    "𝚬": "e",
    // U+1D6E6 MATHEMATICAL ITALIC CAPITAL EPSILON -> e
    "𝛦": "e",
    // U+1D720 MATHEMATICAL BOLD ITALIC CAPITAL EPSILON -> e
    "𝜠": "e",
    // U+1D75A MATHEMATICAL SANS-SERIF BOLD CAPITAL EPSILON -> e
    "𝝚": "e",
    // U+1D794 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL EPSILON -> e
    "𝞔": "e",
    // ===== characters that look like 'f' =====
    // U+017F LATIN SMALL LETTER LONG S -> f
    "ſ": "f",
    // U+0192 LATIN SMALL LETTER F WITH HOOK -> f
    "ƒ": "f",
    // U+03DC GREEK LETTER DIGAMMA -> f
    "Ϝ": "f",
    // U+0584 ARMENIAN SMALL LETTER KEH -> f
    "ք": "f",
    // U+15B4 CANADIAN SYLLABICS BLACKFOOT WE -> f
    "ᖴ": "f",
    // U+1E9D LATIN SMALL LETTER LONG S WITH HIGH STROKE -> f
    "ẝ": "f",
    // U+2131 SCRIPT CAPITAL F -> f
    "ℱ": "f",
    // U+A4DD LISU LETTER TSA -> f
    "ꓝ": "f",
    // U+A798 LATIN CAPITAL LETTER F WITH STROKE -> f
    "Ꞙ": "f",
    // U+A799 LATIN SMALL LETTER F WITH STROKE -> f
    "ꞙ": "f",
    // U+AB35 LATIN SMALL LETTER LENIS F -> f
    "ꬵ": "f",
    // U+10287 LYCIAN LETTER W -> f
    "𐊇": "f",
    // U+102A5 CARIAN LETTER R -> f
    "𐊥": "f",
    // U+10525 ELBASAN LETTER GHE -> f
    "𐔥": "f",
    // U+118A2 WARANG CITI CAPITAL LETTER WI -> f
    "𑢢": "f",
    // U+118C2 WARANG CITI SMALL LETTER WI -> f
    "𑣂": "f",
    // U+1CCDB OUTLINED LATIN CAPITAL LETTER F -> f
    "𜳛": "f",
    // U+1D213 GREEK VOCAL NOTATION SYMBOL-20 -> f
    "𝈓": "f",
    // U+1D405 MATHEMATICAL BOLD CAPITAL F -> f
    "𝐅": "f",
    // U+1D41F MATHEMATICAL BOLD SMALL F -> f
    "𝐟": "f",
    // U+1D439 MATHEMATICAL ITALIC CAPITAL F -> f
    "𝐹": "f",
    // U+1D453 MATHEMATICAL ITALIC SMALL F -> f
    "𝑓": "f",
    // U+1D46D MATHEMATICAL BOLD ITALIC CAPITAL F -> f
    "𝑭": "f",
    // U+1D487 MATHEMATICAL BOLD ITALIC SMALL F -> f
    "𝒇": "f",
    // U+1D4BB MATHEMATICAL SCRIPT SMALL F -> f
    "𝒻": "f",
    // U+1D4D5 MATHEMATICAL BOLD SCRIPT CAPITAL F -> f
    "𝓕": "f",
    // U+1D4EF MATHEMATICAL BOLD SCRIPT SMALL F -> f
    "𝓯": "f",
    // U+1D509 MATHEMATICAL FRAKTUR CAPITAL F -> f
    "𝔉": "f",
    // U+1D523 MATHEMATICAL FRAKTUR SMALL F -> f
    "𝔣": "f",
    // U+1D53D MATHEMATICAL DOUBLE-STRUCK CAPITAL F -> f
    "𝔽": "f",
    // U+1D557 MATHEMATICAL DOUBLE-STRUCK SMALL F -> f
    "𝕗": "f",
    // U+1D571 MATHEMATICAL BOLD FRAKTUR CAPITAL F -> f
    "𝕱": "f",
    // U+1D58B MATHEMATICAL BOLD FRAKTUR SMALL F -> f
    "𝖋": "f",
    // U+1D5A5 MATHEMATICAL SANS-SERIF CAPITAL F -> f
    "𝖥": "f",
    // U+1D5BF MATHEMATICAL SANS-SERIF SMALL F -> f
    "𝖿": "f",
    // U+1D5D9 MATHEMATICAL SANS-SERIF BOLD CAPITAL F -> f
    "𝗙": "f",
    // U+1D5F3 MATHEMATICAL SANS-SERIF BOLD SMALL F -> f
    "𝗳": "f",
    // U+1D60D MATHEMATICAL SANS-SERIF ITALIC CAPITAL F -> f
    "𝘍": "f",
    // U+1D627 MATHEMATICAL SANS-SERIF ITALIC SMALL F -> f
    "𝘧": "f",
    // U+1D641 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL F -> f
    "𝙁": "f",
    // U+1D65B MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL F -> f
    "𝙛": "f",
    // U+1D675 MATHEMATICAL MONOSPACE CAPITAL F -> f
    "𝙵": "f",
    // U+1D68F MATHEMATICAL MONOSPACE SMALL F -> f
    "𝚏": "f",
    // U+1D7CA MATHEMATICAL BOLD CAPITAL DIGAMMA -> f
    "𝟊": "f",
    // ===== characters that look like 'g' =====
    // U+018D LATIN SMALL LETTER TURNED DELTA -> g
    "ƍ": "g",
    // U+0261 LATIN SMALL LETTER SCRIPT G -> g
    "ɡ": "g",
    // U+050C CYRILLIC CAPITAL LETTER KOMI SJE -> g
    "Ԍ": "g",
    // U+0581 ARMENIAN SMALL LETTER CO -> g
    "ց": "g",
    // U+13C0 CHEROKEE LETTER NAH -> g
    "Ꮐ": "g",
    // U+13F3 CHEROKEE LETTER YU -> g
    "Ᏻ": "g",
    // U+1D83 LATIN SMALL LETTER G WITH PALATAL HOOK -> g
    "ᶃ": "g",
    // U+210A SCRIPT SMALL G -> g
    "ℊ": "g",
    // U+A4D6 LISU LETTER GA -> g
    "ꓖ": "g",
    // U+FF47 FULLWIDTH LATIN SMALL LETTER G -> g
    "ｇ": "g",
    // U+1CCDC OUTLINED LATIN CAPITAL LETTER G -> g
    "𜳜": "g",
    // U+1D406 MATHEMATICAL BOLD CAPITAL G -> g
    "𝐆": "g",
    // U+1D420 MATHEMATICAL BOLD SMALL G -> g
    "𝐠": "g",
    // U+1D43A MATHEMATICAL ITALIC CAPITAL G -> g
    "𝐺": "g",
    // U+1D454 MATHEMATICAL ITALIC SMALL G -> g
    "𝑔": "g",
    // U+1D46E MATHEMATICAL BOLD ITALIC CAPITAL G -> g
    "𝑮": "g",
    // U+1D488 MATHEMATICAL BOLD ITALIC SMALL G -> g
    "𝒈": "g",
    // U+1D4A2 MATHEMATICAL SCRIPT CAPITAL G -> g
    "𝒢": "g",
    // U+1D4D6 MATHEMATICAL BOLD SCRIPT CAPITAL G -> g
    "𝓖": "g",
    // U+1D4F0 MATHEMATICAL BOLD SCRIPT SMALL G -> g
    "𝓰": "g",
    // U+1D50A MATHEMATICAL FRAKTUR CAPITAL G -> g
    "𝔊": "g",
    // U+1D524 MATHEMATICAL FRAKTUR SMALL G -> g
    "𝔤": "g",
    // U+1D53E MATHEMATICAL DOUBLE-STRUCK CAPITAL G -> g
    "𝔾": "g",
    // U+1D558 MATHEMATICAL DOUBLE-STRUCK SMALL G -> g
    "𝕘": "g",
    // U+1D572 MATHEMATICAL BOLD FRAKTUR CAPITAL G -> g
    "𝕲": "g",
    // U+1D58C MATHEMATICAL BOLD FRAKTUR SMALL G -> g
    "𝖌": "g",
    // U+1D5A6 MATHEMATICAL SANS-SERIF CAPITAL G -> g
    "𝖦": "g",
    // U+1D5C0 MATHEMATICAL SANS-SERIF SMALL G -> g
    "𝗀": "g",
    // U+1D5DA MATHEMATICAL SANS-SERIF BOLD CAPITAL G -> g
    "𝗚": "g",
    // U+1D5F4 MATHEMATICAL SANS-SERIF BOLD SMALL G -> g
    "𝗴": "g",
    // U+1D60E MATHEMATICAL SANS-SERIF ITALIC CAPITAL G -> g
    "𝘎": "g",
    // U+1D628 MATHEMATICAL SANS-SERIF ITALIC SMALL G -> g
    "𝘨": "g",
    // U+1D642 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL G -> g
    "𝙂": "g",
    // U+1D65C MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL G -> g
    "𝙜": "g",
    // U+1D676 MATHEMATICAL MONOSPACE CAPITAL G -> g
    "𝙶": "g",
    // U+1D690 MATHEMATICAL MONOSPACE SMALL G -> g
    "𝚐": "g",
    // ===== characters that look like 'h' =====
    // U+0397 GREEK CAPITAL LETTER ETA -> h
    "Η": "h",
    // U+041D CYRILLIC CAPITAL LETTER EN -> h
    "Н": "h",
    // U+04BB CYRILLIC SMALL LETTER SHHA -> h
    "һ": "h",
    // U+0570 ARMENIAN SMALL LETTER HO -> h
    "հ": "h",
    // U+13BB CHEROKEE LETTER MI -> h
    "Ꮋ": "h",
    // U+13C2 CHEROKEE LETTER NI -> h
    "Ꮒ": "h",
    // U+157C CANADIAN SYLLABICS NUNAVUT H -> h
    "ᕼ": "h",
    // U+210B SCRIPT CAPITAL H -> h
    "ℋ": "h",
    // U+210C BLACK-LETTER CAPITAL H -> h
    "ℌ": "h",
    // U+210D DOUBLE-STRUCK CAPITAL H -> h
    "ℍ": "h",
    // U+210E PLANCK CONSTANT -> h
    "ℎ": "h",
    // U+2C8E COPTIC CAPITAL LETTER HATE -> h
    "Ⲏ": "h",
    // U+A4E7 LISU LETTER XA -> h
    "ꓧ": "h",
    // U+FF28 FULLWIDTH LATIN CAPITAL LETTER H -> h
    "Ｈ": "h",
    // U+FF48 FULLWIDTH LATIN SMALL LETTER H -> h
    "ｈ": "h",
    // U+102CF CARIAN LETTER E2 -> h
    "𐋏": "h",
    // U+1CCDD OUTLINED LATIN CAPITAL LETTER H -> h
    "𜳝": "h",
    // U+1D407 MATHEMATICAL BOLD CAPITAL H -> h
    "𝐇": "h",
    // U+1D421 MATHEMATICAL BOLD SMALL H -> h
    "𝐡": "h",
    // U+1D43B MATHEMATICAL ITALIC CAPITAL H -> h
    "𝐻": "h",
    // U+1D46F MATHEMATICAL BOLD ITALIC CAPITAL H -> h
    "𝑯": "h",
    // U+1D489 MATHEMATICAL BOLD ITALIC SMALL H -> h
    "𝒉": "h",
    // U+1D4BD MATHEMATICAL SCRIPT SMALL H -> h
    "𝒽": "h",
    // U+1D4D7 MATHEMATICAL BOLD SCRIPT CAPITAL H -> h
    "𝓗": "h",
    // U+1D4F1 MATHEMATICAL BOLD SCRIPT SMALL H -> h
    "𝓱": "h",
    // U+1D525 MATHEMATICAL FRAKTUR SMALL H -> h
    "𝔥": "h",
    // U+1D559 MATHEMATICAL DOUBLE-STRUCK SMALL H -> h
    "𝕙": "h",
    // U+1D573 MATHEMATICAL BOLD FRAKTUR CAPITAL H -> h
    "𝕳": "h",
    // U+1D58D MATHEMATICAL BOLD FRAKTUR SMALL H -> h
    "𝖍": "h",
    // U+1D5A7 MATHEMATICAL SANS-SERIF CAPITAL H -> h
    "𝖧": "h",
    // U+1D5C1 MATHEMATICAL SANS-SERIF SMALL H -> h
    "𝗁": "h",
    // U+1D5DB MATHEMATICAL SANS-SERIF BOLD CAPITAL H -> h
    "𝗛": "h",
    // U+1D5F5 MATHEMATICAL SANS-SERIF BOLD SMALL H -> h
    "𝗵": "h",
    // U+1D60F MATHEMATICAL SANS-SERIF ITALIC CAPITAL H -> h
    "𝘏": "h",
    // U+1D629 MATHEMATICAL SANS-SERIF ITALIC SMALL H -> h
    "𝘩": "h",
    // U+1D643 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL H -> h
    "𝙃": "h",
    // U+1D65D MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL H -> h
    "𝙝": "h",
    // U+1D677 MATHEMATICAL MONOSPACE CAPITAL H -> h
    "𝙷": "h",
    // U+1D691 MATHEMATICAL MONOSPACE SMALL H -> h
    "𝚑": "h",
    // U+1D6AE MATHEMATICAL BOLD CAPITAL ETA -> h
    "𝚮": "h",
    // U+1D6E8 MATHEMATICAL ITALIC CAPITAL ETA -> h
    "𝛨": "h",
    // U+1D722 MATHEMATICAL BOLD ITALIC CAPITAL ETA -> h
    "𝜢": "h",
    // U+1D75C MATHEMATICAL SANS-SERIF BOLD CAPITAL ETA -> h
    "𝝜": "h",
    // U+1D796 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL ETA -> h
    "𝞖": "h",
    // ===== characters that look like 'i' =====
    // U+0131 LATIN SMALL LETTER DOTLESS I -> i
    "ı": "i",
    // U+0269 LATIN SMALL LETTER IOTA -> i
    "ɩ": "i",
    // U+026A LATIN LETTER SMALL CAPITAL I -> i
    "ɪ": "i",
    // U+02DB OGONEK -> i
    "˛": "i",
    // U+037A GREEK YPOGEGRAMMENI -> i
    "ͺ": "i",
    // U+03B9 GREEK SMALL LETTER IOTA -> i
    "ι": "i",
    // U+0456 CYRILLIC SMALL LETTER BYELORUSSIAN-UKRAINIAN I -> i
    "і": "i",
    // U+0582 ARMENIAN SMALL LETTER YIWN -> i
    "ւ": "i",
    // U+13A5 CHEROKEE LETTER V -> i
    "Ꭵ": "i",
    // U+1FBE GREEK PROSGEGRAMMENI -> i
    "ι": "i",
    // U+2139 INFORMATION SOURCE -> i
    "ℹ": "i",
    // U+2148 DOUBLE-STRUCK ITALIC SMALL I -> i
    "ⅈ": "i",
    // U+2170 SMALL ROMAN NUMERAL ONE -> i
    "ⅰ": "i",
    // U+2373 APL FUNCTIONAL SYMBOL IOTA -> i
    "⍳": "i",
    // U+2C93 COPTIC SMALL LETTER IAUDA -> i
    "ⲓ": "i",
    // U+A647 CYRILLIC SMALL LETTER IOTA -> i
    "ꙇ": "i",
    // U+AB75 CHEROKEE SMALL LETTER V -> i
    "ꭵ": "i",
    // U+FF49 FULLWIDTH LATIN SMALL LETTER I -> i
    "ｉ": "i",
    // U+118C3 WARANG CITI SMALL LETTER YU -> i
    "𑣃": "i",
    // U+1D422 MATHEMATICAL BOLD SMALL I -> i
    "𝐢": "i",
    // U+1D456 MATHEMATICAL ITALIC SMALL I -> i
    "𝑖": "i",
    // U+1D48A MATHEMATICAL BOLD ITALIC SMALL I -> i
    "𝒊": "i",
    // U+1D4BE MATHEMATICAL SCRIPT SMALL I -> i
    "𝒾": "i",
    // U+1D4F2 MATHEMATICAL BOLD SCRIPT SMALL I -> i
    "𝓲": "i",
    // U+1D526 MATHEMATICAL FRAKTUR SMALL I -> i
    "𝔦": "i",
    // U+1D55A MATHEMATICAL DOUBLE-STRUCK SMALL I -> i
    "𝕚": "i",
    // U+1D58E MATHEMATICAL BOLD FRAKTUR SMALL I -> i
    "𝖎": "i",
    // U+1D5C2 MATHEMATICAL SANS-SERIF SMALL I -> i
    "𝗂": "i",
    // U+1D5F6 MATHEMATICAL SANS-SERIF BOLD SMALL I -> i
    "𝗶": "i",
    // U+1D62A MATHEMATICAL SANS-SERIF ITALIC SMALL I -> i
    "𝘪": "i",
    // U+1D65E MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL I -> i
    "𝙞": "i",
    // U+1D692 MATHEMATICAL MONOSPACE SMALL I -> i
    "𝚒": "i",
    // U+1D6A4 MATHEMATICAL ITALIC SMALL DOTLESS I -> i
    "𝚤": "i",
    // U+1D6CA MATHEMATICAL BOLD SMALL IOTA -> i
    "𝛊": "i",
    // U+1D704 MATHEMATICAL ITALIC SMALL IOTA -> i
    "𝜄": "i",
    // U+1D73E MATHEMATICAL BOLD ITALIC SMALL IOTA -> i
    "𝜾": "i",
    // U+1D778 MATHEMATICAL SANS-SERIF BOLD SMALL IOTA -> i
    "𝝸": "i",
    // U+1D7B2 MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL IOTA -> i
    "𝞲": "i",
    // ===== characters that look like 'j' =====
    // U+037F GREEK CAPITAL LETTER YOT -> j
    "Ϳ": "j",
    // U+03F3 GREEK LETTER YOT -> j
    "ϳ": "j",
    // U+0408 CYRILLIC CAPITAL LETTER JE -> j
    "Ј": "j",
    // U+0458 CYRILLIC SMALL LETTER JE -> j
    "ј": "j",
    // U+13AB CHEROKEE LETTER GU -> j
    "Ꭻ": "j",
    // U+148D CANADIAN SYLLABICS CO -> j
    "ᒍ": "j",
    // U+2149 DOUBLE-STRUCK ITALIC SMALL J -> j
    "ⅉ": "j",
    // U+A4D9 LISU LETTER JA -> j
    "ꓙ": "j",
    // U+A7B2 LATIN CAPITAL LETTER J WITH CROSSED-TAIL -> j
    "Ʝ": "j",
    // U+FF2A FULLWIDTH LATIN CAPITAL LETTER J -> j
    "Ｊ": "j",
    // U+FF4A FULLWIDTH LATIN SMALL LETTER J -> j
    "ｊ": "j",
    // U+1CCDF OUTLINED LATIN CAPITAL LETTER J -> j
    "𜳟": "j",
    // U+1D409 MATHEMATICAL BOLD CAPITAL J -> j
    "𝐉": "j",
    // U+1D423 MATHEMATICAL BOLD SMALL J -> j
    "𝐣": "j",
    // U+1D43D MATHEMATICAL ITALIC CAPITAL J -> j
    "𝐽": "j",
    // U+1D457 MATHEMATICAL ITALIC SMALL J -> j
    "𝑗": "j",
    // U+1D471 MATHEMATICAL BOLD ITALIC CAPITAL J -> j
    "𝑱": "j",
    // U+1D48B MATHEMATICAL BOLD ITALIC SMALL J -> j
    "𝒋": "j",
    // U+1D4A5 MATHEMATICAL SCRIPT CAPITAL J -> j
    "𝒥": "j",
    // U+1D4BF MATHEMATICAL SCRIPT SMALL J -> j
    "𝒿": "j",
    // U+1D4D9 MATHEMATICAL BOLD SCRIPT CAPITAL J -> j
    "𝓙": "j",
    // U+1D4F3 MATHEMATICAL BOLD SCRIPT SMALL J -> j
    "𝓳": "j",
    // U+1D50D MATHEMATICAL FRAKTUR CAPITAL J -> j
    "𝔍": "j",
    // U+1D527 MATHEMATICAL FRAKTUR SMALL J -> j
    "𝔧": "j",
    // U+1D541 MATHEMATICAL DOUBLE-STRUCK CAPITAL J -> j
    "𝕁": "j",
    // U+1D55B MATHEMATICAL DOUBLE-STRUCK SMALL J -> j
    "𝕛": "j",
    // U+1D575 MATHEMATICAL BOLD FRAKTUR CAPITAL J -> j
    "𝕵": "j",
    // U+1D58F MATHEMATICAL BOLD FRAKTUR SMALL J -> j
    "𝖏": "j",
    // U+1D5A9 MATHEMATICAL SANS-SERIF CAPITAL J -> j
    "𝖩": "j",
    // U+1D5C3 MATHEMATICAL SANS-SERIF SMALL J -> j
    "𝗃": "j",
    // U+1D5DD MATHEMATICAL SANS-SERIF BOLD CAPITAL J -> j
    "𝗝": "j",
    // U+1D5F7 MATHEMATICAL SANS-SERIF BOLD SMALL J -> j
    "𝗷": "j",
    // U+1D611 MATHEMATICAL SANS-SERIF ITALIC CAPITAL J -> j
    "𝘑": "j",
    // U+1D62B MATHEMATICAL SANS-SERIF ITALIC SMALL J -> j
    "𝘫": "j",
    // U+1D645 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL J -> j
    "𝙅": "j",
    // U+1D65F MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL J -> j
    "𝙟": "j",
    // U+1D679 MATHEMATICAL MONOSPACE CAPITAL J -> j
    "𝙹": "j",
    // U+1D693 MATHEMATICAL MONOSPACE SMALL J -> j
    "𝚓": "j",
    // ===== characters that look like 'k' =====
    // U+039A GREEK CAPITAL LETTER KAPPA -> k
    "Κ": "k",
    // U+041A CYRILLIC CAPITAL LETTER KA -> k
    "К": "k",
    // U+13E6 CHEROKEE LETTER TSO -> k
    "Ꮶ": "k",
    // U+16D5 RUNIC LETTER OPEN-P -> k
    "ᛕ": "k",
    // U+212A KELVIN SIGN -> k
    "K": "k",
    // U+2C94 COPTIC CAPITAL LETTER KAPA -> k
    "Ⲕ": "k",
    // U+A4D7 LISU LETTER KA -> k
    "ꓗ": "k",
    // U+FF2B FULLWIDTH LATIN CAPITAL LETTER K -> k
    "Ｋ": "k",
    // U+10518 ELBASAN LETTER QE -> k
    "𐔘": "k",
    // U+1CCE0 OUTLINED LATIN CAPITAL LETTER K -> k
    "𜳠": "k",
    // U+1D40A MATHEMATICAL BOLD CAPITAL K -> k
    "𝐊": "k",
    // U+1D424 MATHEMATICAL BOLD SMALL K -> k
    "𝐤": "k",
    // U+1D43E MATHEMATICAL ITALIC CAPITAL K -> k
    "𝐾": "k",
    // U+1D458 MATHEMATICAL ITALIC SMALL K -> k
    "𝑘": "k",
    // U+1D472 MATHEMATICAL BOLD ITALIC CAPITAL K -> k
    "𝑲": "k",
    // U+1D48C MATHEMATICAL BOLD ITALIC SMALL K -> k
    "𝒌": "k",
    // U+1D4A6 MATHEMATICAL SCRIPT CAPITAL K -> k
    "𝒦": "k",
    // U+1D4C0 MATHEMATICAL SCRIPT SMALL K -> k
    "𝓀": "k",
    // U+1D4DA MATHEMATICAL BOLD SCRIPT CAPITAL K -> k
    "𝓚": "k",
    // U+1D4F4 MATHEMATICAL BOLD SCRIPT SMALL K -> k
    "𝓴": "k",
    // U+1D50E MATHEMATICAL FRAKTUR CAPITAL K -> k
    "𝔎": "k",
    // U+1D528 MATHEMATICAL FRAKTUR SMALL K -> k
    "𝔨": "k",
    // U+1D542 MATHEMATICAL DOUBLE-STRUCK CAPITAL K -> k
    "𝕂": "k",
    // U+1D55C MATHEMATICAL DOUBLE-STRUCK SMALL K -> k
    "𝕜": "k",
    // U+1D576 MATHEMATICAL BOLD FRAKTUR CAPITAL K -> k
    "𝕶": "k",
    // U+1D590 MATHEMATICAL BOLD FRAKTUR SMALL K -> k
    "𝖐": "k",
    // U+1D5AA MATHEMATICAL SANS-SERIF CAPITAL K -> k
    "𝖪": "k",
    // U+1D5C4 MATHEMATICAL SANS-SERIF SMALL K -> k
    "𝗄": "k",
    // U+1D5DE MATHEMATICAL SANS-SERIF BOLD CAPITAL K -> k
    "𝗞": "k",
    // U+1D5F8 MATHEMATICAL SANS-SERIF BOLD SMALL K -> k
    "𝗸": "k",
    // U+1D612 MATHEMATICAL SANS-SERIF ITALIC CAPITAL K -> k
    "𝘒": "k",
    // U+1D62C MATHEMATICAL SANS-SERIF ITALIC SMALL K -> k
    "𝘬": "k",
    // U+1D646 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL K -> k
    "𝙆": "k",
    // U+1D660 MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL K -> k
    "𝙠": "k",
    // U+1D67A MATHEMATICAL MONOSPACE CAPITAL K -> k
    "𝙺": "k",
    // U+1D694 MATHEMATICAL MONOSPACE SMALL K -> k
    "𝚔": "k",
    // U+1D6B1 MATHEMATICAL BOLD CAPITAL KAPPA -> k
    "𝚱": "k",
    // U+1D6EB MATHEMATICAL ITALIC CAPITAL KAPPA -> k
    "𝛫": "k",
    // U+1D725 MATHEMATICAL BOLD ITALIC CAPITAL KAPPA -> k
    "𝜥": "k",
    // U+1D75F MATHEMATICAL SANS-SERIF BOLD CAPITAL KAPPA -> k
    "𝝟": "k",
    // U+1D799 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL KAPPA -> k
    "𝞙": "k",
    // ===== characters that look like 'l' =====
    // U+0196 LATIN CAPITAL LETTER IOTA -> l
    "Ɩ": "l",
    // U+01C0 LATIN LETTER DENTAL CLICK -> l
    "ǀ": "l",
    // U+0399 GREEK CAPITAL LETTER IOTA -> l
    "Ι": "l",
    // U+0406 CYRILLIC CAPITAL LETTER BYELORUSSIAN-UKRAINIAN I -> l
    "І": "l",
    // U+04C0 CYRILLIC LETTER PALOCHKA -> l
    "Ӏ": "l",
    // U+04CF CYRILLIC SMALL LETTER PALOCHKA -> l
    "ӏ": "l",
    // U+05C0 HEBREW PUNCTUATION PASEQ -> l
    "׀": "l",
    // U+05D5 HEBREW LETTER VAV -> l
    "ו": "l",
    // U+05DF HEBREW LETTER FINAL NUN -> l
    "ן": "l",
    // U+0627 ARABIC LETTER ALEF -> l
    "ا": "l",
    // U+0661 ARABIC-INDIC DIGIT ONE -> l
    "١": "l",
    // U+06F1 EXTENDED ARABIC-INDIC DIGIT ONE -> l
    "۱": "l",
    // U+07CA NKO LETTER A -> l
    "ߊ": "l",
    // U+13DE CHEROKEE LETTER TLE -> l
    "Ꮮ": "l",
    // U+14AA CANADIAN SYLLABICS MA -> l
    "ᒪ": "l",
    // U+16C1 RUNIC LETTER ISAZ IS ISS I -> l
    "ᛁ": "l",
    // U+2110 SCRIPT CAPITAL I -> l
    "ℐ": "l",
    // U+2111 BLACK-LETTER CAPITAL I -> l
    "ℑ": "l",
    // U+2112 SCRIPT CAPITAL L -> l
    "ℒ": "l",
    // U+2113 SCRIPT SMALL L -> l
    "ℓ": "l",
    // U+2160 ROMAN NUMERAL ONE -> l
    "Ⅰ": "l",
    // U+216C ROMAN NUMERAL FIFTY -> l
    "Ⅼ": "l",
    // U+217C SMALL ROMAN NUMERAL FIFTY -> l
    "ⅼ": "l",
    // U+2223 DIVIDES -> l
    "∣": "l",
    // U+23FD POWER ON SYMBOL -> l
    "⏽": "l",
    // U+2C92 COPTIC CAPITAL LETTER IAUDA -> l
    "Ⲓ": "l",
    // U+2CD0 COPTIC CAPITAL LETTER L-SHAPED HA -> l
    "Ⳑ": "l",
    // U+2D4F TIFINAGH LETTER YAN -> l
    "ⵏ": "l",
    // U+A4E1 LISU LETTER LA -> l
    "ꓡ": "l",
    // U+A4F2 LISU LETTER I -> l
    "ꓲ": "l",
    // U+FE8D ARABIC LETTER ALEF ISOLATED FORM -> l
    "ﺍ": "l",
    // U+FE8E ARABIC LETTER ALEF FINAL FORM -> l
    "ﺎ": "l",
    // U+FF29 FULLWIDTH LATIN CAPITAL LETTER I -> l
    "Ｉ": "l",
    // U+FF4C FULLWIDTH LATIN SMALL LETTER L -> l
    "ｌ": "l",
    // U+FFE8 HALFWIDTH FORMS LIGHT VERTICAL -> l
    "￨": "l",
    // U+1028A LYCIAN LETTER J -> l
    "𐊊": "l",
    // U+10309 OLD ITALIC LETTER I -> l
    "𐌉": "l",
    // U+10320 OLD ITALIC NUMERAL ONE -> l
    "𐌠": "l",
    // U+1041B DESERET CAPITAL LETTER ETH -> l
    "𐐛": "l",
    // U+10526 ELBASAN LETTER GHAMMA -> l
    "𐔦": "l",
    // U+118A3 WARANG CITI CAPITAL LETTER YU -> l
    "𑢣": "l",
    // U+118B2 WARANG CITI CAPITAL LETTER TTE -> l
    "𑢲": "l",
    // U+11DDA TOLONG SIKI SIGN HECAKA -> l
    "𑷚": "l",
    // U+11DE1 TOLONG SIKI DIGIT ONE -> l
    "𑷡": "l",
    // U+16EAA BERIA ERFE CAPITAL LETTER LAKKO -> l
    "𖺪": "l",
    // U+16F16 MIAO LETTER LA -> l
    "𖼖": "l",
    // U+16F28 MIAO LETTER GHA -> l
    "𖼨": "l",
    // U+1CCDE OUTLINED LATIN CAPITAL LETTER I -> l
    "𜳞": "l",
    // U+1CCE1 OUTLINED LATIN CAPITAL LETTER L -> l
    "𜳡": "l",
    // U+1CCF1 OUTLINED DIGIT ONE -> l
    "𜳱": "l",
    // U+1D22A GREEK INSTRUMENTAL NOTATION SYMBOL-23 -> l
    "𝈪": "l",
    // U+1D408 MATHEMATICAL BOLD CAPITAL I -> l
    "𝐈": "l",
    // U+1D40B MATHEMATICAL BOLD CAPITAL L -> l
    "𝐋": "l",
    // U+1D425 MATHEMATICAL BOLD SMALL L -> l
    "𝐥": "l",
    // U+1D43C MATHEMATICAL ITALIC CAPITAL I -> l
    "𝐼": "l",
    // U+1D43F MATHEMATICAL ITALIC CAPITAL L -> l
    "𝐿": "l",
    // U+1D459 MATHEMATICAL ITALIC SMALL L -> l
    "𝑙": "l",
    // U+1D470 MATHEMATICAL BOLD ITALIC CAPITAL I -> l
    "𝑰": "l",
    // U+1D473 MATHEMATICAL BOLD ITALIC CAPITAL L -> l
    "𝑳": "l",
    // U+1D48D MATHEMATICAL BOLD ITALIC SMALL L -> l
    "𝒍": "l",
    // U+1D4C1 MATHEMATICAL SCRIPT SMALL L -> l
    "𝓁": "l",
    // U+1D4D8 MATHEMATICAL BOLD SCRIPT CAPITAL I -> l
    "𝓘": "l",
    // U+1D4DB MATHEMATICAL BOLD SCRIPT CAPITAL L -> l
    "𝓛": "l",
    // U+1D4F5 MATHEMATICAL BOLD SCRIPT SMALL L -> l
    "𝓵": "l",
    // U+1D50F MATHEMATICAL FRAKTUR CAPITAL L -> l
    "𝔏": "l",
    // U+1D529 MATHEMATICAL FRAKTUR SMALL L -> l
    "𝔩": "l",
    // U+1D540 MATHEMATICAL DOUBLE-STRUCK CAPITAL I -> l
    "𝕀": "l",
    // U+1D543 MATHEMATICAL DOUBLE-STRUCK CAPITAL L -> l
    "𝕃": "l",
    // U+1D55D MATHEMATICAL DOUBLE-STRUCK SMALL L -> l
    "𝕝": "l",
    // U+1D574 MATHEMATICAL BOLD FRAKTUR CAPITAL I -> l
    "𝕴": "l",
    // U+1D577 MATHEMATICAL BOLD FRAKTUR CAPITAL L -> l
    "𝕷": "l",
    // U+1D591 MATHEMATICAL BOLD FRAKTUR SMALL L -> l
    "𝖑": "l",
    // U+1D5A8 MATHEMATICAL SANS-SERIF CAPITAL I -> l
    "𝖨": "l",
    // U+1D5AB MATHEMATICAL SANS-SERIF CAPITAL L -> l
    "𝖫": "l",
    // U+1D5C5 MATHEMATICAL SANS-SERIF SMALL L -> l
    "𝗅": "l",
    // U+1D5DC MATHEMATICAL SANS-SERIF BOLD CAPITAL I -> l
    "𝗜": "l",
    // U+1D5DF MATHEMATICAL SANS-SERIF BOLD CAPITAL L -> l
    "𝗟": "l",
    // U+1D5F9 MATHEMATICAL SANS-SERIF BOLD SMALL L -> l
    "𝗹": "l",
    // U+1D610 MATHEMATICAL SANS-SERIF ITALIC CAPITAL I -> l
    "𝘐": "l",
    // U+1D613 MATHEMATICAL SANS-SERIF ITALIC CAPITAL L -> l
    "𝘓": "l",
    // U+1D62D MATHEMATICAL SANS-SERIF ITALIC SMALL L -> l
    "𝘭": "l",
    // U+1D644 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL I -> l
    "𝙄": "l",
    // U+1D647 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL L -> l
    "𝙇": "l",
    // U+1D661 MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL L -> l
    "𝙡": "l",
    // U+1D678 MATHEMATICAL MONOSPACE CAPITAL I -> l
    "𝙸": "l",
    // U+1D67B MATHEMATICAL MONOSPACE CAPITAL L -> l
    "𝙻": "l",
    // U+1D695 MATHEMATICAL MONOSPACE SMALL L -> l
    "𝚕": "l",
    // U+1D6B0 MATHEMATICAL BOLD CAPITAL IOTA -> l
    "𝚰": "l",
    // U+1D6EA MATHEMATICAL ITALIC CAPITAL IOTA -> l
    "𝛪": "l",
    // U+1D724 MATHEMATICAL BOLD ITALIC CAPITAL IOTA -> l
    "𝜤": "l",
    // U+1D75E MATHEMATICAL SANS-SERIF BOLD CAPITAL IOTA -> l
    "𝝞": "l",
    // U+1D798 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL IOTA -> l
    "𝞘": "l",
    // U+1D7CF MATHEMATICAL BOLD DIGIT ONE -> l
    "𝟏": "l",
    // U+1D7D9 MATHEMATICAL DOUBLE-STRUCK DIGIT ONE -> l
    "𝟙": "l",
    // U+1D7E3 MATHEMATICAL SANS-SERIF DIGIT ONE -> l
    "𝟣": "l",
    // U+1D7ED MATHEMATICAL SANS-SERIF BOLD DIGIT ONE -> l
    "𝟭": "l",
    // U+1D7F7 MATHEMATICAL MONOSPACE DIGIT ONE -> l
    "𝟷": "l",
    // U+1E8C7 MENDE KIKAKUI DIGIT ONE -> l
    "𞣇": "l",
    // U+1EE00 ARABIC MATHEMATICAL ALEF -> l
    "𞸀": "l",
    // U+1EE80 ARABIC MATHEMATICAL LOOPED ALEF -> l
    "𞺀": "l",
    // U+1FBF1 SEGMENTED DIGIT ONE -> l
    "🯱": "l",
    // ===== characters that look like 'm' =====
    // U+039C GREEK CAPITAL LETTER MU -> m
    "Μ": "m",
    // U+03FA GREEK CAPITAL LETTER SAN -> m
    "Ϻ": "m",
    // U+041C CYRILLIC CAPITAL LETTER EM -> m
    "М": "m",
    // U+13B7 CHEROKEE LETTER LU -> m
    "Ꮇ": "m",
    // U+15F0 CANADIAN SYLLABICS CARRIER GO -> m
    "ᗰ": "m",
    // U+16D6 RUNIC LETTER EHWAZ EH E -> m
    "ᛖ": "m",
    // U+2133 SCRIPT CAPITAL M -> m
    "ℳ": "m",
    // U+216F ROMAN NUMERAL ONE THOUSAND -> m
    "Ⅿ": "m",
    // U+2C98 COPTIC CAPITAL LETTER MI -> m
    "Ⲙ": "m",
    // U+A4DF LISU LETTER MA -> m
    "ꓟ": "m",
    // U+FF2D FULLWIDTH LATIN CAPITAL LETTER M -> m
    "Ｍ": "m",
    // U+102B0 CARIAN LETTER S -> m
    "𐊰": "m",
    // U+10311 OLD ITALIC LETTER SHE -> m
    "𐌑": "m",
    // U+1CCE2 OUTLINED LATIN CAPITAL LETTER M -> m
    "𜳢": "m",
    // U+1D40C MATHEMATICAL BOLD CAPITAL M -> m
    "𝐌": "m",
    // U+1D440 MATHEMATICAL ITALIC CAPITAL M -> m
    "𝑀": "m",
    // U+1D474 MATHEMATICAL BOLD ITALIC CAPITAL M -> m
    "𝑴": "m",
    // U+1D4DC MATHEMATICAL BOLD SCRIPT CAPITAL M -> m
    "𝓜": "m",
    // U+1D510 MATHEMATICAL FRAKTUR CAPITAL M -> m
    "𝔐": "m",
    // U+1D544 MATHEMATICAL DOUBLE-STRUCK CAPITAL M -> m
    "𝕄": "m",
    // U+1D578 MATHEMATICAL BOLD FRAKTUR CAPITAL M -> m
    "𝕸": "m",
    // U+1D5AC MATHEMATICAL SANS-SERIF CAPITAL M -> m
    "𝖬": "m",
    // U+1D5E0 MATHEMATICAL SANS-SERIF BOLD CAPITAL M -> m
    "𝗠": "m",
    // U+1D614 MATHEMATICAL SANS-SERIF ITALIC CAPITAL M -> m
    "𝘔": "m",
    // U+1D648 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL M -> m
    "𝙈": "m",
    // U+1D67C MATHEMATICAL MONOSPACE CAPITAL M -> m
    "𝙼": "m",
    // U+1D6B3 MATHEMATICAL BOLD CAPITAL MU -> m
    "𝚳": "m",
    // U+1D6ED MATHEMATICAL ITALIC CAPITAL MU -> m
    "𝛭": "m",
    // U+1D727 MATHEMATICAL BOLD ITALIC CAPITAL MU -> m
    "𝜧": "m",
    // U+1D761 MATHEMATICAL SANS-SERIF BOLD CAPITAL MU -> m
    "𝝡": "m",
    // U+1D79B MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL MU -> m
    "𝞛": "m",
    // ===== characters that look like 'n' =====
    // U+039D GREEK CAPITAL LETTER NU -> n
    "Ν": "n",
    // U+0578 ARMENIAN SMALL LETTER VO -> n
    "ո": "n",
    // U+057C ARMENIAN SMALL LETTER RA -> n
    "ռ": "n",
    // U+2115 DOUBLE-STRUCK CAPITAL N -> n
    "ℕ": "n",
    // U+2C9A COPTIC CAPITAL LETTER NI -> n
    "Ⲛ": "n",
    // U+A4E0 LISU LETTER NA -> n
    "ꓠ": "n",
    // U+FF2E FULLWIDTH LATIN CAPITAL LETTER N -> n
    "Ｎ": "n",
    // U+10513 ELBASAN LETTER NE -> n
    "𐔓": "n",
    // U+1CCE3 OUTLINED LATIN CAPITAL LETTER N -> n
    "𜳣": "n",
    // U+1D40D MATHEMATICAL BOLD CAPITAL N -> n
    "𝐍": "n",
    // U+1D427 MATHEMATICAL BOLD SMALL N -> n
    "𝐧": "n",
    // U+1D441 MATHEMATICAL ITALIC CAPITAL N -> n
    "𝑁": "n",
    // U+1D45B MATHEMATICAL ITALIC SMALL N -> n
    "𝑛": "n",
    // U+1D475 MATHEMATICAL BOLD ITALIC CAPITAL N -> n
    "𝑵": "n",
    // U+1D48F MATHEMATICAL BOLD ITALIC SMALL N -> n
    "𝒏": "n",
    // U+1D4A9 MATHEMATICAL SCRIPT CAPITAL N -> n
    "𝒩": "n",
    // U+1D4C3 MATHEMATICAL SCRIPT SMALL N -> n
    "𝓃": "n",
    // U+1D4DD MATHEMATICAL BOLD SCRIPT CAPITAL N -> n
    "𝓝": "n",
    // U+1D4F7 MATHEMATICAL BOLD SCRIPT SMALL N -> n
    "𝓷": "n",
    // U+1D511 MATHEMATICAL FRAKTUR CAPITAL N -> n
    "𝔑": "n",
    // U+1D52B MATHEMATICAL FRAKTUR SMALL N -> n
    "𝔫": "n",
    // U+1D55F MATHEMATICAL DOUBLE-STRUCK SMALL N -> n
    "𝕟": "n",
    // U+1D579 MATHEMATICAL BOLD FRAKTUR CAPITAL N -> n
    "𝕹": "n",
    // U+1D593 MATHEMATICAL BOLD FRAKTUR SMALL N -> n
    "𝖓": "n",
    // U+1D5AD MATHEMATICAL SANS-SERIF CAPITAL N -> n
    "𝖭": "n",
    // U+1D5C7 MATHEMATICAL SANS-SERIF SMALL N -> n
    "𝗇": "n",
    // U+1D5E1 MATHEMATICAL SANS-SERIF BOLD CAPITAL N -> n
    "𝗡": "n",
    // U+1D5FB MATHEMATICAL SANS-SERIF BOLD SMALL N -> n
    "𝗻": "n",
    // U+1D615 MATHEMATICAL SANS-SERIF ITALIC CAPITAL N -> n
    "𝘕": "n",
    // U+1D62F MATHEMATICAL SANS-SERIF ITALIC SMALL N -> n
    "𝘯": "n",
    // U+1D649 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL N -> n
    "𝙉": "n",
    // U+1D663 MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL N -> n
    "𝙣": "n",
    // U+1D67D MATHEMATICAL MONOSPACE CAPITAL N -> n
    "𝙽": "n",
    // U+1D697 MATHEMATICAL MONOSPACE SMALL N -> n
    "𝚗": "n",
    // U+1D6B4 MATHEMATICAL BOLD CAPITAL NU -> n
    "𝚴": "n",
    // U+1D6EE MATHEMATICAL ITALIC CAPITAL NU -> n
    "𝛮": "n",
    // U+1D728 MATHEMATICAL BOLD ITALIC CAPITAL NU -> n
    "𝜨": "n",
    // U+1D762 MATHEMATICAL SANS-SERIF BOLD CAPITAL NU -> n
    "𝝢": "n",
    // U+1D79C MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL NU -> n
    "𝞜": "n",
    // ===== characters that look like 'o' =====
    // U+039F GREEK CAPITAL LETTER OMICRON -> o
    "Ο": "o",
    // U+03BF GREEK SMALL LETTER OMICRON -> o
    "ο": "o",
    // U+03C3 GREEK SMALL LETTER SIGMA -> o
    "σ": "o",
    // U+03ED COPTIC SMALL LETTER SHIMA -> o
    "ϭ": "o",
    // U+041E CYRILLIC CAPITAL LETTER O -> o
    "О": "o",
    // U+043E CYRILLIC SMALL LETTER O -> o
    "о": "o",
    // U+0555 ARMENIAN CAPITAL LETTER OH -> o
    "Օ": "o",
    // U+0585 ARMENIAN SMALL LETTER OH -> o
    "օ": "o",
    // U+05E1 HEBREW LETTER SAMEKH -> o
    "ס": "o",
    // U+0647 ARABIC LETTER HEH -> o
    "ه": "o",
    // U+0665 ARABIC-INDIC DIGIT FIVE -> o
    "٥": "o",
    // U+06BE ARABIC LETTER HEH DOACHASHMEE -> o
    "ھ": "o",
    // U+06C1 ARABIC LETTER HEH GOAL -> o
    "ہ": "o",
    // U+06D5 ARABIC LETTER AE -> o
    "ە": "o",
    // U+06F5 EXTENDED ARABIC-INDIC DIGIT FIVE -> o
    "۵": "o",
    // U+07C0 NKO DIGIT ZERO -> o
    "߀": "o",
    // U+0966 DEVANAGARI DIGIT ZERO -> o
    "०": "o",
    // U+09E6 BENGALI DIGIT ZERO -> o
    "০": "o",
    // U+0A66 GURMUKHI DIGIT ZERO -> o
    "੦": "o",
    // U+0AE6 GUJARATI DIGIT ZERO -> o
    "૦": "o",
    // U+0B20 ORIYA LETTER TTHA -> o
    "ଠ": "o",
    // U+0B66 ORIYA DIGIT ZERO -> o
    "୦": "o",
    // U+0BE6 TAMIL DIGIT ZERO -> o
    "௦": "o",
    // U+0C02 TELUGU SIGN ANUSVARA -> o
    "ం": "o",
    // U+0C66 TELUGU DIGIT ZERO -> o
    "౦": "o",
    // U+0C82 KANNADA SIGN ANUSVARA -> o
    "ಂ": "o",
    // U+0CE6 KANNADA DIGIT ZERO -> o
    "೦": "o",
    // U+0D02 MALAYALAM SIGN ANUSVARA -> o
    "ം": "o",
    // U+0D20 MALAYALAM LETTER TTHA -> o
    "ഠ": "o",
    // U+0D66 MALAYALAM DIGIT ZERO -> o
    "൦": "o",
    // U+0D82 SINHALA SIGN ANUSVARAYA -> o
    "ං": "o",
    // U+0E50 THAI DIGIT ZERO -> o
    "๐": "o",
    // U+0ED0 LAO DIGIT ZERO -> o
    "໐": "o",
    // U+101D MYANMAR LETTER WA -> o
    "ဝ": "o",
    // U+1040 MYANMAR DIGIT ZERO -> o
    "၀": "o",
    // U+10FF GEORGIAN LETTER LABIAL SIGN -> o
    "ჿ": "o",
    // U+12D0 ETHIOPIC SYLLABLE PHARYNGEAL A -> o
    "ዐ": "o",
    // U+17E0 KHMER DIGIT ZERO -> o
    "០": "o",
    // U+1D0F LATIN LETTER SMALL CAPITAL O -> o
    "ᴏ": "o",
    // U+1D11 LATIN SMALL LETTER SIDEWAYS O -> o
    "ᴑ": "o",
    // U+2134 SCRIPT SMALL O -> o
    "ℴ": "o",
    // U+2C9E COPTIC CAPITAL LETTER O -> o
    "Ⲟ": "o",
    // U+2C9F COPTIC SMALL LETTER O -> o
    "ⲟ": "o",
    // U+2D54 TIFINAGH LETTER YAR -> o
    "ⵔ": "o",
    // U+3007 IDEOGRAPHIC NUMBER ZERO -> o
    "〇": "o",
    // U+A4F3 LISU LETTER O -> o
    "ꓳ": "o",
    // U+AB3D LATIN SMALL LETTER BLACKLETTER O -> o
    "ꬽ": "o",
    // U+FBA6 ARABIC LETTER HEH GOAL ISOLATED FORM -> o
    "ﮦ": "o",
    // U+FBA7 ARABIC LETTER HEH GOAL FINAL FORM -> o
    "ﮧ": "o",
    // U+FBA8 ARABIC LETTER HEH GOAL INITIAL FORM -> o
    "ﮨ": "o",
    // U+FBA9 ARABIC LETTER HEH GOAL MEDIAL FORM -> o
    "ﮩ": "o",
    // U+FBAA ARABIC LETTER HEH DOACHASHMEE ISOLATED FORM -> o
    "ﮪ": "o",
    // U+FBAB ARABIC LETTER HEH DOACHASHMEE FINAL FORM -> o
    "ﮫ": "o",
    // U+FBAC ARABIC LETTER HEH DOACHASHMEE INITIAL FORM -> o
    "ﮬ": "o",
    // U+FBAD ARABIC LETTER HEH DOACHASHMEE MEDIAL FORM -> o
    "ﮭ": "o",
    // U+FEE9 ARABIC LETTER HEH ISOLATED FORM -> o
    "ﻩ": "o",
    // U+FEEA ARABIC LETTER HEH FINAL FORM -> o
    "ﻪ": "o",
    // U+FEEB ARABIC LETTER HEH INITIAL FORM -> o
    "ﻫ": "o",
    // U+FEEC ARABIC LETTER HEH MEDIAL FORM -> o
    "ﻬ": "o",
    // U+FF2F FULLWIDTH LATIN CAPITAL LETTER O -> o
    "Ｏ": "o",
    // U+FF4F FULLWIDTH LATIN SMALL LETTER O -> o
    "ｏ": "o",
    // U+10292 LYCIAN LETTER U -> o
    "𐊒": "o",
    // U+102AB CARIAN LETTER O -> o
    "𐊫": "o",
    // U+10404 DESERET CAPITAL LETTER LONG O -> o
    "𐐄": "o",
    // U+1042C DESERET SMALL LETTER LONG O -> o
    "𐐬": "o",
    // U+104C2 OSAGE CAPITAL LETTER O -> o
    "𐓂": "o",
    // U+104EA OSAGE SMALL LETTER O -> o
    "𐓪": "o",
    // U+10516 ELBASAN LETTER O -> o
    "𐔖": "o",
    // U+114D0 TIRHUTA DIGIT ZERO -> o
    "𑓐": "o",
    // U+118B5 WARANG CITI CAPITAL LETTER AT -> o
    "𑢵": "o",
    // U+118C8 WARANG CITI SMALL LETTER E -> o
    "𑣈": "o",
    // U+118D7 WARANG CITI SMALL LETTER BU -> o
    "𑣗": "o",
    // U+118E0 WARANG CITI DIGIT ZERO -> o
    "𑣠": "o",
    // U+11DE0 TOLONG SIKI DIGIT ZERO -> o
    "𑷠": "o",
    // U+1CCE4 OUTLINED LATIN CAPITAL LETTER O -> o
    "𜳤": "o",
    // U+1CCF0 OUTLINED DIGIT ZERO -> o
    "𜳰": "o",
    // U+1D40E MATHEMATICAL BOLD CAPITAL O -> o
    "𝐎": "o",
    // U+1D428 MATHEMATICAL BOLD SMALL O -> o
    "𝐨": "o",
    // U+1D442 MATHEMATICAL ITALIC CAPITAL O -> o
    "𝑂": "o",
    // U+1D45C MATHEMATICAL ITALIC SMALL O -> o
    "𝑜": "o",
    // U+1D476 MATHEMATICAL BOLD ITALIC CAPITAL O -> o
    "𝑶": "o",
    // U+1D490 MATHEMATICAL BOLD ITALIC SMALL O -> o
    "𝒐": "o",
    // U+1D4AA MATHEMATICAL SCRIPT CAPITAL O -> o
    "𝒪": "o",
    // U+1D4DE MATHEMATICAL BOLD SCRIPT CAPITAL O -> o
    "𝓞": "o",
    // U+1D4F8 MATHEMATICAL BOLD SCRIPT SMALL O -> o
    "𝓸": "o",
    // U+1D512 MATHEMATICAL FRAKTUR CAPITAL O -> o
    "𝔒": "o",
    // U+1D52C MATHEMATICAL FRAKTUR SMALL O -> o
    "𝔬": "o",
    // U+1D546 MATHEMATICAL DOUBLE-STRUCK CAPITAL O -> o
    "𝕆": "o",
    // U+1D560 MATHEMATICAL DOUBLE-STRUCK SMALL O -> o
    "𝕠": "o",
    // U+1D57A MATHEMATICAL BOLD FRAKTUR CAPITAL O -> o
    "𝕺": "o",
    // U+1D594 MATHEMATICAL BOLD FRAKTUR SMALL O -> o
    "𝖔": "o",
    // U+1D5AE MATHEMATICAL SANS-SERIF CAPITAL O -> o
    "𝖮": "o",
    // U+1D5C8 MATHEMATICAL SANS-SERIF SMALL O -> o
    "𝗈": "o",
    // U+1D5E2 MATHEMATICAL SANS-SERIF BOLD CAPITAL O -> o
    "𝗢": "o",
    // U+1D5FC MATHEMATICAL SANS-SERIF BOLD SMALL O -> o
    "𝗼": "o",
    // U+1D616 MATHEMATICAL SANS-SERIF ITALIC CAPITAL O -> o
    "𝘖": "o",
    // U+1D630 MATHEMATICAL SANS-SERIF ITALIC SMALL O -> o
    "𝘰": "o",
    // U+1D64A MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL O -> o
    "𝙊": "o",
    // U+1D664 MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL O -> o
    "𝙤": "o",
    // U+1D67E MATHEMATICAL MONOSPACE CAPITAL O -> o
    "𝙾": "o",
    // U+1D698 MATHEMATICAL MONOSPACE SMALL O -> o
    "𝚘": "o",
    // U+1D6B6 MATHEMATICAL BOLD CAPITAL OMICRON -> o
    "𝚶": "o",
    // U+1D6D0 MATHEMATICAL BOLD SMALL OMICRON -> o
    "𝛐": "o",
    // U+1D6D4 MATHEMATICAL BOLD SMALL SIGMA -> o
    "𝛔": "o",
    // U+1D6F0 MATHEMATICAL ITALIC CAPITAL OMICRON -> o
    "𝛰": "o",
    // U+1D70A MATHEMATICAL ITALIC SMALL OMICRON -> o
    "𝜊": "o",
    // U+1D70E MATHEMATICAL ITALIC SMALL SIGMA -> o
    "𝜎": "o",
    // U+1D72A MATHEMATICAL BOLD ITALIC CAPITAL OMICRON -> o
    "𝜪": "o",
    // U+1D744 MATHEMATICAL BOLD ITALIC SMALL OMICRON -> o
    "𝝄": "o",
    // U+1D748 MATHEMATICAL BOLD ITALIC SMALL SIGMA -> o
    "𝝈": "o",
    // U+1D764 MATHEMATICAL SANS-SERIF BOLD CAPITAL OMICRON -> o
    "𝝤": "o",
    // U+1D77E MATHEMATICAL SANS-SERIF BOLD SMALL OMICRON -> o
    "𝝾": "o",
    // U+1D782 MATHEMATICAL SANS-SERIF BOLD SMALL SIGMA -> o
    "𝞂": "o",
    // U+1D79E MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL OMICRON -> o
    "𝞞": "o",
    // U+1D7B8 MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL OMICRON -> o
    "𝞸": "o",
    // U+1D7BC MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL SIGMA -> o
    "𝞼": "o",
    // U+1D7CE MATHEMATICAL BOLD DIGIT ZERO -> o
    "𝟎": "o",
    // U+1D7D8 MATHEMATICAL DOUBLE-STRUCK DIGIT ZERO -> o
    "𝟘": "o",
    // U+1D7E2 MATHEMATICAL SANS-SERIF DIGIT ZERO -> o
    "𝟢": "o",
    // U+1D7EC MATHEMATICAL SANS-SERIF BOLD DIGIT ZERO -> o
    "𝟬": "o",
    // U+1D7F6 MATHEMATICAL MONOSPACE DIGIT ZERO -> o
    "𝟶": "o",
    // U+1EE24 ARABIC MATHEMATICAL INITIAL HEH -> o
    "𞸤": "o",
    // U+1EE64 ARABIC MATHEMATICAL STRETCHED HEH -> o
    "𞹤": "o",
    // U+1EE84 ARABIC MATHEMATICAL LOOPED HEH -> o
    "𞺄": "o",
    // U+1FBF0 SEGMENTED DIGIT ZERO -> o
    "🯰": "o",
    // ===== characters that look like 'p' =====
    // U+00FE LATIN SMALL LETTER THORN -> p
    "þ": "p",
    // U+01BF LATIN LETTER WYNN -> p
    "ƿ": "p",
    // U+03A1 GREEK CAPITAL LETTER RHO -> p
    "Ρ": "p",
    // U+03C1 GREEK SMALL LETTER RHO -> p
    "ρ": "p",
    // U+03F1 GREEK RHO SYMBOL -> p
    "ϱ": "p",
    // U+03F8 GREEK SMALL LETTER SHO -> p
    "ϸ": "p",
    // U+0420 CYRILLIC CAPITAL LETTER ER -> p
    "Р": "p",
    // U+0440 CYRILLIC SMALL LETTER ER -> p
    "р": "p",
    // U+13E2 CHEROKEE LETTER TLV -> p
    "Ꮲ": "p",
    // U+146D CANADIAN SYLLABICS KI -> p
    "ᑭ": "p",
    // U+2119 DOUBLE-STRUCK CAPITAL P -> p
    "ℙ": "p",
    // U+2374 APL FUNCTIONAL SYMBOL RHO -> p
    "⍴": "p",
    // U+2CA2 COPTIC CAPITAL LETTER RO -> p
    "Ⲣ": "p",
    // U+2CA3 COPTIC SMALL LETTER RO -> p
    "ⲣ": "p",
    // U+2CCE COPTIC CAPITAL LETTER OLD COPTIC HA -> p
    "Ⳏ": "p",
    // U+2CCF COPTIC SMALL LETTER OLD COPTIC HA -> p
    "ⳏ": "p",
    // U+A4D1 LISU LETTER PA -> p
    "ꓑ": "p",
    // U+FF30 FULLWIDTH LATIN CAPITAL LETTER P -> p
    "Ｐ": "p",
    // U+FF50 FULLWIDTH LATIN SMALL LETTER P -> p
    "ｐ": "p",
    // U+10295 LYCIAN LETTER R -> p
    "𐊕": "p",
    // U+1CCE5 OUTLINED LATIN CAPITAL LETTER P -> p
    "𜳥": "p",
    // U+1D40F MATHEMATICAL BOLD CAPITAL P -> p
    "𝐏": "p",
    // U+1D429 MATHEMATICAL BOLD SMALL P -> p
    "𝐩": "p",
    // U+1D443 MATHEMATICAL ITALIC CAPITAL P -> p
    "𝑃": "p",
    // U+1D45D MATHEMATICAL ITALIC SMALL P -> p
    "𝑝": "p",
    // U+1D477 MATHEMATICAL BOLD ITALIC CAPITAL P -> p
    "𝑷": "p",
    // U+1D491 MATHEMATICAL BOLD ITALIC SMALL P -> p
    "𝒑": "p",
    // U+1D4AB MATHEMATICAL SCRIPT CAPITAL P -> p
    "𝒫": "p",
    // U+1D4C5 MATHEMATICAL SCRIPT SMALL P -> p
    "𝓅": "p",
    // U+1D4DF MATHEMATICAL BOLD SCRIPT CAPITAL P -> p
    "𝓟": "p",
    // U+1D4F9 MATHEMATICAL BOLD SCRIPT SMALL P -> p
    "𝓹": "p",
    // U+1D513 MATHEMATICAL FRAKTUR CAPITAL P -> p
    "𝔓": "p",
    // U+1D52D MATHEMATICAL FRAKTUR SMALL P -> p
    "𝔭": "p",
    // U+1D561 MATHEMATICAL DOUBLE-STRUCK SMALL P -> p
    "𝕡": "p",
    // U+1D57B MATHEMATICAL BOLD FRAKTUR CAPITAL P -> p
    "𝕻": "p",
    // U+1D595 MATHEMATICAL BOLD FRAKTUR SMALL P -> p
    "𝖕": "p",
    // U+1D5AF MATHEMATICAL SANS-SERIF CAPITAL P -> p
    "𝖯": "p",
    // U+1D5C9 MATHEMATICAL SANS-SERIF SMALL P -> p
    "𝗉": "p",
    // U+1D5E3 MATHEMATICAL SANS-SERIF BOLD CAPITAL P -> p
    "𝗣": "p",
    // U+1D5FD MATHEMATICAL SANS-SERIF BOLD SMALL P -> p
    "𝗽": "p",
    // U+1D617 MATHEMATICAL SANS-SERIF ITALIC CAPITAL P -> p
    "𝘗": "p",
    // U+1D631 MATHEMATICAL SANS-SERIF ITALIC SMALL P -> p
    "𝘱": "p",
    // U+1D64B MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL P -> p
    "𝙋": "p",
    // U+1D665 MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL P -> p
    "𝙥": "p",
    // U+1D67F MATHEMATICAL MONOSPACE CAPITAL P -> p
    "𝙿": "p",
    // U+1D699 MATHEMATICAL MONOSPACE SMALL P -> p
    "𝚙": "p",
    // U+1D6B8 MATHEMATICAL BOLD CAPITAL RHO -> p
    "𝚸": "p",
    // U+1D6D2 MATHEMATICAL BOLD SMALL RHO -> p
    "𝛒": "p",
    // U+1D6E0 MATHEMATICAL BOLD RHO SYMBOL -> p
    "𝛠": "p",
    // U+1D6F2 MATHEMATICAL ITALIC CAPITAL RHO -> p
    "𝛲": "p",
    // U+1D70C MATHEMATICAL ITALIC SMALL RHO -> p
    "𝜌": "p",
    // U+1D71A MATHEMATICAL ITALIC RHO SYMBOL -> p
    "𝜚": "p",
    // U+1D72C MATHEMATICAL BOLD ITALIC CAPITAL RHO -> p
    "𝜬": "p",
    // U+1D746 MATHEMATICAL BOLD ITALIC SMALL RHO -> p
    "𝝆": "p",
    // U+1D754 MATHEMATICAL BOLD ITALIC RHO SYMBOL -> p
    "𝝔": "p",
    // U+1D766 MATHEMATICAL SANS-SERIF BOLD CAPITAL RHO -> p
    "𝝦": "p",
    // U+1D780 MATHEMATICAL SANS-SERIF BOLD SMALL RHO -> p
    "𝞀": "p",
    // U+1D78E MATHEMATICAL SANS-SERIF BOLD RHO SYMBOL -> p
    "𝞎": "p",
    // U+1D7A0 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL RHO -> p
    "𝞠": "p",
    // U+1D7BA MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL RHO -> p
    "𝞺": "p",
    // U+1D7C8 MATHEMATICAL SANS-SERIF BOLD ITALIC RHO SYMBOL -> p
    "𝟈": "p",
    // ===== characters that look like 'q' =====
    // U+051B CYRILLIC SMALL LETTER QA -> q
    "ԛ": "q",
    // U+0563 ARMENIAN SMALL LETTER GIM -> q
    "գ": "q",
    // U+0566 ARMENIAN SMALL LETTER ZA -> q
    "զ": "q",
    // U+211A DOUBLE-STRUCK CAPITAL Q -> q
    "ℚ": "q",
    // U+2D55 TIFINAGH LETTER YARR -> q
    "ⵕ": "q",
    // U+1CCE6 OUTLINED LATIN CAPITAL LETTER Q -> q
    "𜳦": "q",
    // U+1D410 MATHEMATICAL BOLD CAPITAL Q -> q
    "𝐐": "q",
    // U+1D42A MATHEMATICAL BOLD SMALL Q -> q
    "𝐪": "q",
    // U+1D444 MATHEMATICAL ITALIC CAPITAL Q -> q
    "𝑄": "q",
    // U+1D45E MATHEMATICAL ITALIC SMALL Q -> q
    "𝑞": "q",
    // U+1D478 MATHEMATICAL BOLD ITALIC CAPITAL Q -> q
    "𝑸": "q",
    // U+1D492 MATHEMATICAL BOLD ITALIC SMALL Q -> q
    "𝒒": "q",
    // U+1D4AC MATHEMATICAL SCRIPT CAPITAL Q -> q
    "𝒬": "q",
    // U+1D4C6 MATHEMATICAL SCRIPT SMALL Q -> q
    "𝓆": "q",
    // U+1D4E0 MATHEMATICAL BOLD SCRIPT CAPITAL Q -> q
    "𝓠": "q",
    // U+1D4FA MATHEMATICAL BOLD SCRIPT SMALL Q -> q
    "𝓺": "q",
    // U+1D514 MATHEMATICAL FRAKTUR CAPITAL Q -> q
    "𝔔": "q",
    // U+1D52E MATHEMATICAL FRAKTUR SMALL Q -> q
    "𝔮": "q",
    // U+1D562 MATHEMATICAL DOUBLE-STRUCK SMALL Q -> q
    "𝕢": "q",
    // U+1D57C MATHEMATICAL BOLD FRAKTUR CAPITAL Q -> q
    "𝕼": "q",
    // U+1D596 MATHEMATICAL BOLD FRAKTUR SMALL Q -> q
    "𝖖": "q",
    // U+1D5B0 MATHEMATICAL SANS-SERIF CAPITAL Q -> q
    "𝖰": "q",
    // U+1D5CA MATHEMATICAL SANS-SERIF SMALL Q -> q
    "𝗊": "q",
    // U+1D5E4 MATHEMATICAL SANS-SERIF BOLD CAPITAL Q -> q
    "𝗤": "q",
    // U+1D5FE MATHEMATICAL SANS-SERIF BOLD SMALL Q -> q
    "𝗾": "q",
    // U+1D618 MATHEMATICAL SANS-SERIF ITALIC CAPITAL Q -> q
    "𝘘": "q",
    // U+1D632 MATHEMATICAL SANS-SERIF ITALIC SMALL Q -> q
    "𝘲": "q",
    // U+1D64C MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL Q -> q
    "𝙌": "q",
    // U+1D666 MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL Q -> q
    "𝙦": "q",
    // U+1D680 MATHEMATICAL MONOSPACE CAPITAL Q -> q
    "𝚀": "q",
    // U+1D69A MATHEMATICAL MONOSPACE SMALL Q -> q
    "𝚚": "q",
    // ===== characters that look like 'r' =====
    // U+01A6 LATIN LETTER YR -> r
    "Ʀ": "r",
    // U+0433 CYRILLIC SMALL LETTER GHE -> r
    "г": "r",
    // U+13A1 CHEROKEE LETTER E -> r
    "Ꭱ": "r",
    // U+13D2 CHEROKEE LETTER SV -> r
    "Ꮢ": "r",
    // U+1587 CANADIAN SYLLABICS TLHI -> r
    "ᖇ": "r",
    // U+1D26 GREEK LETTER SMALL CAPITAL GAMMA -> r
    "ᴦ": "r",
    // U+211B SCRIPT CAPITAL R -> r
    "ℛ": "r",
    // U+211C BLACK-LETTER CAPITAL R -> r
    "ℜ": "r",
    // U+211D DOUBLE-STRUCK CAPITAL R -> r
    "ℝ": "r",
    // U+2C85 COPTIC SMALL LETTER GAMMA -> r
    "ⲅ": "r",
    // U+A4E3 LISU LETTER ZHA -> r
    "ꓣ": "r",
    // U+AB47 LATIN SMALL LETTER R WITHOUT HANDLE -> r
    "ꭇ": "r",
    // U+AB48 LATIN SMALL LETTER DOUBLE R -> r
    "ꭈ": "r",
    // U+AB81 CHEROKEE SMALL LETTER HU -> r
    "ꮁ": "r",
    // U+104B4 OSAGE CAPITAL LETTER BRA -> r
    "𐒴": "r",
    // U+16F35 MIAO LETTER ZHA -> r
    "𖼵": "r",
    // U+1CCE7 OUTLINED LATIN CAPITAL LETTER R -> r
    "𜳧": "r",
    // U+1D216 GREEK VOCAL NOTATION SYMBOL-23 -> r
    "𝈖": "r",
    // U+1D411 MATHEMATICAL BOLD CAPITAL R -> r
    "𝐑": "r",
    // U+1D42B MATHEMATICAL BOLD SMALL R -> r
    "𝐫": "r",
    // U+1D445 MATHEMATICAL ITALIC CAPITAL R -> r
    "𝑅": "r",
    // U+1D45F MATHEMATICAL ITALIC SMALL R -> r
    "𝑟": "r",
    // U+1D479 MATHEMATICAL BOLD ITALIC CAPITAL R -> r
    "𝑹": "r",
    // U+1D493 MATHEMATICAL BOLD ITALIC SMALL R -> r
    "𝒓": "r",
    // U+1D4C7 MATHEMATICAL SCRIPT SMALL R -> r
    "𝓇": "r",
    // U+1D4E1 MATHEMATICAL BOLD SCRIPT CAPITAL R -> r
    "𝓡": "r",
    // U+1D4FB MATHEMATICAL BOLD SCRIPT SMALL R -> r
    "𝓻": "r",
    // U+1D52F MATHEMATICAL FRAKTUR SMALL R -> r
    "𝔯": "r",
    // U+1D563 MATHEMATICAL DOUBLE-STRUCK SMALL R -> r
    "𝕣": "r",
    // U+1D57D MATHEMATICAL BOLD FRAKTUR CAPITAL R -> r
    "𝕽": "r",
    // U+1D597 MATHEMATICAL BOLD FRAKTUR SMALL R -> r
    "𝖗": "r",
    // U+1D5B1 MATHEMATICAL SANS-SERIF CAPITAL R -> r
    "𝖱": "r",
    // U+1D5CB MATHEMATICAL SANS-SERIF SMALL R -> r
    "𝗋": "r",
    // U+1D5E5 MATHEMATICAL SANS-SERIF BOLD CAPITAL R -> r
    "𝗥": "r",
    // U+1D5FF MATHEMATICAL SANS-SERIF BOLD SMALL R -> r
    "𝗿": "r",
    // U+1D619 MATHEMATICAL SANS-SERIF ITALIC CAPITAL R -> r
    "𝘙": "r",
    // U+1D633 MATHEMATICAL SANS-SERIF ITALIC SMALL R -> r
    "𝘳": "r",
    // U+1D64D MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL R -> r
    "𝙍": "r",
    // U+1D667 MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL R -> r
    "𝙧": "r",
    // U+1D681 MATHEMATICAL MONOSPACE CAPITAL R -> r
    "𝚁": "r",
    // U+1D69B MATHEMATICAL MONOSPACE SMALL R -> r
    "𝚛": "r",
    // ===== characters that look like 's' =====
    // U+01BD LATIN SMALL LETTER TONE FIVE -> s
    "ƽ": "s",
    // U+0405 CYRILLIC CAPITAL LETTER DZE -> s
    "Ѕ": "s",
    // U+0455 CYRILLIC SMALL LETTER DZE -> s
    "ѕ": "s",
    // U+054F ARMENIAN CAPITAL LETTER TIWN -> s
    "Տ": "s",
    // U+0D1F MALAYALAM LETTER TTA -> s
    "ട": "s",
    // U+13D5 CHEROKEE LETTER DE -> s
    "Ꮥ": "s",
    // U+13DA CHEROKEE LETTER DU -> s
    "Ꮪ": "s",
    // U+A4E2 LISU LETTER SA -> s
    "ꓢ": "s",
    // U+A731 LATIN LETTER SMALL CAPITAL S -> s
    "ꜱ": "s",
    // U+ABAA CHEROKEE SMALL LETTER DU -> s
    "ꮪ": "s",
    // U+FF33 FULLWIDTH LATIN CAPITAL LETTER S -> s
    "Ｓ": "s",
    // U+FF53 FULLWIDTH LATIN SMALL LETTER S -> s
    "ｓ": "s",
    // U+10296 LYCIAN LETTER S -> s
    "𐊖": "s",
    // U+10420 DESERET CAPITAL LETTER ZHEE -> s
    "𐐠": "s",
    // U+10448 DESERET SMALL LETTER ZHEE -> s
    "𐑈": "s",
    // U+118C1 WARANG CITI SMALL LETTER A -> s
    "𑣁": "s",
    // U+16F3A MIAO LETTER SA -> s
    "𖼺": "s",
    // U+1CCE8 OUTLINED LATIN CAPITAL LETTER S -> s
    "𜳨": "s",
    // U+1D412 MATHEMATICAL BOLD CAPITAL S -> s
    "𝐒": "s",
    // U+1D42C MATHEMATICAL BOLD SMALL S -> s
    "𝐬": "s",
    // U+1D446 MATHEMATICAL ITALIC CAPITAL S -> s
    "𝑆": "s",
    // U+1D460 MATHEMATICAL ITALIC SMALL S -> s
    "𝑠": "s",
    // U+1D47A MATHEMATICAL BOLD ITALIC CAPITAL S -> s
    "𝑺": "s",
    // U+1D494 MATHEMATICAL BOLD ITALIC SMALL S -> s
    "𝒔": "s",
    // U+1D4AE MATHEMATICAL SCRIPT CAPITAL S -> s
    "𝒮": "s",
    // U+1D4C8 MATHEMATICAL SCRIPT SMALL S -> s
    "𝓈": "s",
    // U+1D4E2 MATHEMATICAL BOLD SCRIPT CAPITAL S -> s
    "𝓢": "s",
    // U+1D4FC MATHEMATICAL BOLD SCRIPT SMALL S -> s
    "𝓼": "s",
    // U+1D516 MATHEMATICAL FRAKTUR CAPITAL S -> s
    "𝔖": "s",
    // U+1D530 MATHEMATICAL FRAKTUR SMALL S -> s
    "𝔰": "s",
    // U+1D54A MATHEMATICAL DOUBLE-STRUCK CAPITAL S -> s
    "𝕊": "s",
    // U+1D564 MATHEMATICAL DOUBLE-STRUCK SMALL S -> s
    "𝕤": "s",
    // U+1D57E MATHEMATICAL BOLD FRAKTUR CAPITAL S -> s
    "𝕾": "s",
    // U+1D598 MATHEMATICAL BOLD FRAKTUR SMALL S -> s
    "𝖘": "s",
    // U+1D5B2 MATHEMATICAL SANS-SERIF CAPITAL S -> s
    "𝖲": "s",
    // U+1D5CC MATHEMATICAL SANS-SERIF SMALL S -> s
    "𝗌": "s",
    // U+1D5E6 MATHEMATICAL SANS-SERIF BOLD CAPITAL S -> s
    "𝗦": "s",
    // U+1D600 MATHEMATICAL SANS-SERIF BOLD SMALL S -> s
    "𝘀": "s",
    // U+1D61A MATHEMATICAL SANS-SERIF ITALIC CAPITAL S -> s
    "𝘚": "s",
    // U+1D634 MATHEMATICAL SANS-SERIF ITALIC SMALL S -> s
    "𝘴": "s",
    // U+1D64E MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL S -> s
    "𝙎": "s",
    // U+1D668 MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL S -> s
    "𝙨": "s",
    // U+1D682 MATHEMATICAL MONOSPACE CAPITAL S -> s
    "𝚂": "s",
    // U+1D69C MATHEMATICAL MONOSPACE SMALL S -> s
    "𝚜": "s",
    // ===== characters that look like 't' =====
    // U+03A4 GREEK CAPITAL LETTER TAU -> t
    "Τ": "t",
    // U+0422 CYRILLIC CAPITAL LETTER TE -> t
    "Т": "t",
    // U+13A2 CHEROKEE LETTER I -> t
    "Ꭲ": "t",
    // U+22A4 DOWN TACK -> t
    "⊤": "t",
    // U+27D9 LARGE DOWN TACK -> t
    "⟙": "t",
    // U+2CA6 COPTIC CAPITAL LETTER TAU -> t
    "Ⲧ": "t",
    // U+A4D4 LISU LETTER TA -> t
    "ꓔ": "t",
    // U+FF34 FULLWIDTH LATIN CAPITAL LETTER T -> t
    "Ｔ": "t",
    // U+10297 LYCIAN LETTER T -> t
    "𐊗": "t",
    // U+102B1 CARIAN LETTER C-18 -> t
    "𐊱": "t",
    // U+10315 OLD ITALIC LETTER TE -> t
    "𐌕": "t",
    // U+118BC WARANG CITI CAPITAL LETTER HAR -> t
    "𑢼": "t",
    // U+16F0A MIAO LETTER TA -> t
    "𖼊": "t",
    // U+1CCE9 OUTLINED LATIN CAPITAL LETTER T -> t
    "𜳩": "t",
    // U+1D413 MATHEMATICAL BOLD CAPITAL T -> t
    "𝐓": "t",
    // U+1D42D MATHEMATICAL BOLD SMALL T -> t
    "𝐭": "t",
    // U+1D447 MATHEMATICAL ITALIC CAPITAL T -> t
    "𝑇": "t",
    // U+1D461 MATHEMATICAL ITALIC SMALL T -> t
    "𝑡": "t",
    // U+1D47B MATHEMATICAL BOLD ITALIC CAPITAL T -> t
    "𝑻": "t",
    // U+1D495 MATHEMATICAL BOLD ITALIC SMALL T -> t
    "𝒕": "t",
    // U+1D4AF MATHEMATICAL SCRIPT CAPITAL T -> t
    "𝒯": "t",
    // U+1D4C9 MATHEMATICAL SCRIPT SMALL T -> t
    "𝓉": "t",
    // U+1D4E3 MATHEMATICAL BOLD SCRIPT CAPITAL T -> t
    "𝓣": "t",
    // U+1D4FD MATHEMATICAL BOLD SCRIPT SMALL T -> t
    "𝓽": "t",
    // U+1D517 MATHEMATICAL FRAKTUR CAPITAL T -> t
    "𝔗": "t",
    // U+1D531 MATHEMATICAL FRAKTUR SMALL T -> t
    "𝔱": "t",
    // U+1D54B MATHEMATICAL DOUBLE-STRUCK CAPITAL T -> t
    "𝕋": "t",
    // U+1D565 MATHEMATICAL DOUBLE-STRUCK SMALL T -> t
    "𝕥": "t",
    // U+1D57F MATHEMATICAL BOLD FRAKTUR CAPITAL T -> t
    "𝕿": "t",
    // U+1D599 MATHEMATICAL BOLD FRAKTUR SMALL T -> t
    "𝖙": "t",
    // U+1D5B3 MATHEMATICAL SANS-SERIF CAPITAL T -> t
    "𝖳": "t",
    // U+1D5CD MATHEMATICAL SANS-SERIF SMALL T -> t
    "𝗍": "t",
    // U+1D5E7 MATHEMATICAL SANS-SERIF BOLD CAPITAL T -> t
    "𝗧": "t",
    // U+1D601 MATHEMATICAL SANS-SERIF BOLD SMALL T -> t
    "𝘁": "t",
    // U+1D61B MATHEMATICAL SANS-SERIF ITALIC CAPITAL T -> t
    "𝘛": "t",
    // U+1D635 MATHEMATICAL SANS-SERIF ITALIC SMALL T -> t
    "𝘵": "t",
    // U+1D64F MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL T -> t
    "𝙏": "t",
    // U+1D669 MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL T -> t
    "𝙩": "t",
    // U+1D683 MATHEMATICAL MONOSPACE CAPITAL T -> t
    "𝚃": "t",
    // U+1D69D MATHEMATICAL MONOSPACE SMALL T -> t
    "𝚝": "t",
    // U+1D6BB MATHEMATICAL BOLD CAPITAL TAU -> t
    "𝚻": "t",
    // U+1D6F5 MATHEMATICAL ITALIC CAPITAL TAU -> t
    "𝛵": "t",
    // U+1D72F MATHEMATICAL BOLD ITALIC CAPITAL TAU -> t
    "𝜯": "t",
    // U+1D769 MATHEMATICAL SANS-SERIF BOLD CAPITAL TAU -> t
    "𝝩": "t",
    // U+1D7A3 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL TAU -> t
    "𝞣": "t",
    // U+1F768 ALCHEMICAL SYMBOL FOR CRUCIBLE-4 -> t
    "🝨": "t",
    // ===== characters that look like 'u' =====
    // U+028B LATIN SMALL LETTER V WITH HOOK -> u
    "ʋ": "u",
    // U+03C5 GREEK SMALL LETTER UPSILON -> u
    "υ": "u",
    // U+054D ARMENIAN CAPITAL LETTER SEH -> u
    "Ս": "u",
    // U+057D ARMENIAN SMALL LETTER SEH -> u
    "ս": "u",
    // U+1200 ETHIOPIC SYLLABLE HA -> u
    "ሀ": "u",
    // U+144C CANADIAN SYLLABICS TE -> u
    "ᑌ": "u",
    // U+1D1C LATIN LETTER SMALL CAPITAL U -> u
    "ᴜ": "u",
    // U+222A UNION -> u
    "∪": "u",
    // U+22C3 N-ARY UNION -> u
    "⋃": "u",
    // U+A4F4 LISU LETTER U -> u
    "ꓴ": "u",
    // U+A79F LATIN SMALL LETTER VOLAPUK UE -> u
    "ꞟ": "u",
    // U+AB4E LATIN SMALL LETTER U WITH SHORT RIGHT LEG -> u
    "ꭎ": "u",
    // U+AB52 LATIN SMALL LETTER U WITH LEFT HOOK -> u
    "ꭒ": "u",
    // U+104CE OSAGE CAPITAL LETTER U -> u
    "𐓎": "u",
    // U+104F6 OSAGE SMALL LETTER U -> u
    "𐓶": "u",
    // U+118B8 WARANG CITI CAPITAL LETTER PU -> u
    "𑢸": "u",
    // U+118D8 WARANG CITI SMALL LETTER PU -> u
    "𑣘": "u",
    // U+16F42 MIAO LETTER WA -> u
    "𖽂": "u",
    // U+1CCEA OUTLINED LATIN CAPITAL LETTER U -> u
    "𜳪": "u",
    // U+1D414 MATHEMATICAL BOLD CAPITAL U -> u
    "𝐔": "u",
    // U+1D42E MATHEMATICAL BOLD SMALL U -> u
    "𝐮": "u",
    // U+1D448 MATHEMATICAL ITALIC CAPITAL U -> u
    "𝑈": "u",
    // U+1D462 MATHEMATICAL ITALIC SMALL U -> u
    "𝑢": "u",
    // U+1D47C MATHEMATICAL BOLD ITALIC CAPITAL U -> u
    "𝑼": "u",
    // U+1D496 MATHEMATICAL BOLD ITALIC SMALL U -> u
    "𝒖": "u",
    // U+1D4B0 MATHEMATICAL SCRIPT CAPITAL U -> u
    "𝒰": "u",
    // U+1D4CA MATHEMATICAL SCRIPT SMALL U -> u
    "𝓊": "u",
    // U+1D4E4 MATHEMATICAL BOLD SCRIPT CAPITAL U -> u
    "𝓤": "u",
    // U+1D4FE MATHEMATICAL BOLD SCRIPT SMALL U -> u
    "𝓾": "u",
    // U+1D518 MATHEMATICAL FRAKTUR CAPITAL U -> u
    "𝔘": "u",
    // U+1D532 MATHEMATICAL FRAKTUR SMALL U -> u
    "𝔲": "u",
    // U+1D54C MATHEMATICAL DOUBLE-STRUCK CAPITAL U -> u
    "𝕌": "u",
    // U+1D566 MATHEMATICAL DOUBLE-STRUCK SMALL U -> u
    "𝕦": "u",
    // U+1D580 MATHEMATICAL BOLD FRAKTUR CAPITAL U -> u
    "𝖀": "u",
    // U+1D59A MATHEMATICAL BOLD FRAKTUR SMALL U -> u
    "𝖚": "u",
    // U+1D5B4 MATHEMATICAL SANS-SERIF CAPITAL U -> u
    "𝖴": "u",
    // U+1D5CE MATHEMATICAL SANS-SERIF SMALL U -> u
    "𝗎": "u",
    // U+1D5E8 MATHEMATICAL SANS-SERIF BOLD CAPITAL U -> u
    "𝗨": "u",
    // U+1D602 MATHEMATICAL SANS-SERIF BOLD SMALL U -> u
    "𝘂": "u",
    // U+1D61C MATHEMATICAL SANS-SERIF ITALIC CAPITAL U -> u
    "𝘜": "u",
    // U+1D636 MATHEMATICAL SANS-SERIF ITALIC SMALL U -> u
    "𝘶": "u",
    // U+1D650 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL U -> u
    "𝙐": "u",
    // U+1D66A MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL U -> u
    "𝙪": "u",
    // U+1D684 MATHEMATICAL MONOSPACE CAPITAL U -> u
    "𝚄": "u",
    // U+1D69E MATHEMATICAL MONOSPACE SMALL U -> u
    "𝚞": "u",
    // U+1D6D6 MATHEMATICAL BOLD SMALL UPSILON -> u
    "𝛖": "u",
    // U+1D710 MATHEMATICAL ITALIC SMALL UPSILON -> u
    "𝜐": "u",
    // U+1D74A MATHEMATICAL BOLD ITALIC SMALL UPSILON -> u
    "𝝊": "u",
    // U+1D784 MATHEMATICAL SANS-SERIF BOLD SMALL UPSILON -> u
    "𝞄": "u",
    // U+1D7BE MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL UPSILON -> u
    "𝞾": "u",
    // ===== characters that look like 'v' =====
    // U+03BD GREEK SMALL LETTER NU -> v
    "ν": "v",
    // U+0474 CYRILLIC CAPITAL LETTER IZHITSA -> v
    "Ѵ": "v",
    // U+0475 CYRILLIC SMALL LETTER IZHITSA -> v
    "ѵ": "v",
    // U+05D8 HEBREW LETTER TET -> v
    "ט": "v",
    // U+0667 ARABIC-INDIC DIGIT SEVEN -> v
    "٧": "v",
    // U+06F7 EXTENDED ARABIC-INDIC DIGIT SEVEN -> v
    "۷": "v",
    // U+13D9 CHEROKEE LETTER DO -> v
    "Ꮩ": "v",
    // U+142F CANADIAN SYLLABICS PE -> v
    "ᐯ": "v",
    // U+1D20 LATIN LETTER SMALL CAPITAL V -> v
    "ᴠ": "v",
    // U+2164 ROMAN NUMERAL FIVE -> v
    "Ⅴ": "v",
    // U+2174 SMALL ROMAN NUMERAL FIVE -> v
    "ⅴ": "v",
    // U+2228 LOGICAL OR -> v
    "∨": "v",
    // U+22C1 N-ARY LOGICAL OR -> v
    "⋁": "v",
    // U+2D38 TIFINAGH LETTER YADH -> v
    "ⴸ": "v",
    // U+A4E6 LISU LETTER HA -> v
    "ꓦ": "v",
    // U+A6DF BAMUM LETTER KO -> v
    "ꛟ": "v",
    // U+ABA9 CHEROKEE SMALL LETTER DO -> v
    "ꮩ": "v",
    // U+FF56 FULLWIDTH LATIN SMALL LETTER V -> v
    "ｖ": "v",
    // U+1051D ELBASAN LETTER TE -> v
    "𐔝": "v",
    // U+11706 AHOM LETTER PA -> v
    "𑜆": "v",
    // U+118A0 WARANG CITI CAPITAL LETTER NGAA -> v
    "𑢠": "v",
    // U+118C0 WARANG CITI SMALL LETTER NGAA -> v
    "𑣀": "v",
    // U+16F08 MIAO LETTER VA -> v
    "𖼈": "v",
    // U+1CCEB OUTLINED LATIN CAPITAL LETTER V -> v
    "𜳫": "v",
    // U+1D20D GREEK VOCAL NOTATION SYMBOL-14 -> v
    "𝈍": "v",
    // U+1D415 MATHEMATICAL BOLD CAPITAL V -> v
    "𝐕": "v",
    // U+1D42F MATHEMATICAL BOLD SMALL V -> v
    "𝐯": "v",
    // U+1D449 MATHEMATICAL ITALIC CAPITAL V -> v
    "𝑉": "v",
    // U+1D463 MATHEMATICAL ITALIC SMALL V -> v
    "𝑣": "v",
    // U+1D47D MATHEMATICAL BOLD ITALIC CAPITAL V -> v
    "𝑽": "v",
    // U+1D497 MATHEMATICAL BOLD ITALIC SMALL V -> v
    "𝒗": "v",
    // U+1D4B1 MATHEMATICAL SCRIPT CAPITAL V -> v
    "𝒱": "v",
    // U+1D4CB MATHEMATICAL SCRIPT SMALL V -> v
    "𝓋": "v",
    // U+1D4E5 MATHEMATICAL BOLD SCRIPT CAPITAL V -> v
    "𝓥": "v",
    // U+1D4FF MATHEMATICAL BOLD SCRIPT SMALL V -> v
    "𝓿": "v",
    // U+1D519 MATHEMATICAL FRAKTUR CAPITAL V -> v
    "𝔙": "v",
    // U+1D533 MATHEMATICAL FRAKTUR SMALL V -> v
    "𝔳": "v",
    // U+1D54D MATHEMATICAL DOUBLE-STRUCK CAPITAL V -> v
    "𝕍": "v",
    // U+1D567 MATHEMATICAL DOUBLE-STRUCK SMALL V -> v
    "𝕧": "v",
    // U+1D581 MATHEMATICAL BOLD FRAKTUR CAPITAL V -> v
    "𝖁": "v",
    // U+1D59B MATHEMATICAL BOLD FRAKTUR SMALL V -> v
    "𝖛": "v",
    // U+1D5B5 MATHEMATICAL SANS-SERIF CAPITAL V -> v
    "𝖵": "v",
    // U+1D5CF MATHEMATICAL SANS-SERIF SMALL V -> v
    "𝗏": "v",
    // U+1D5E9 MATHEMATICAL SANS-SERIF BOLD CAPITAL V -> v
    "𝗩": "v",
    // U+1D603 MATHEMATICAL SANS-SERIF BOLD SMALL V -> v
    "𝘃": "v",
    // U+1D61D MATHEMATICAL SANS-SERIF ITALIC CAPITAL V -> v
    "𝘝": "v",
    // U+1D637 MATHEMATICAL SANS-SERIF ITALIC SMALL V -> v
    "𝘷": "v",
    // U+1D651 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL V -> v
    "𝙑": "v",
    // U+1D66B MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL V -> v
    "𝙫": "v",
    // U+1D685 MATHEMATICAL MONOSPACE CAPITAL V -> v
    "𝚅": "v",
    // U+1D69F MATHEMATICAL MONOSPACE SMALL V -> v
    "𝚟": "v",
    // U+1D6CE MATHEMATICAL BOLD SMALL NU -> v
    "𝛎": "v",
    // U+1D708 MATHEMATICAL ITALIC SMALL NU -> v
    "𝜈": "v",
    // U+1D742 MATHEMATICAL BOLD ITALIC SMALL NU -> v
    "𝝂": "v",
    // U+1D77C MATHEMATICAL SANS-SERIF BOLD SMALL NU -> v
    "𝝼": "v",
    // U+1D7B6 MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL NU -> v
    "𝞶": "v",
    // ===== characters that look like 'w' =====
    // U+026F LATIN SMALL LETTER TURNED M -> w
    "ɯ": "w",
    // U+0448 CYRILLIC SMALL LETTER SHA -> w
    "ш": "w",
    // U+0461 CYRILLIC SMALL LETTER OMEGA -> w
    "ѡ": "w",
    // U+051C CYRILLIC CAPITAL LETTER WE -> w
    "Ԝ": "w",
    // U+051D CYRILLIC SMALL LETTER WE -> w
    "ԝ": "w",
    // U+0561 ARMENIAN SMALL LETTER AYB -> w
    "ա": "w",
    // U+13B3 CHEROKEE LETTER LA -> w
    "Ꮃ": "w",
    // U+13D4 CHEROKEE LETTER TA -> w
    "Ꮤ": "w",
    // U+1D21 LATIN LETTER SMALL CAPITAL W -> w
    "ᴡ": "w",
    // U+2CBD COPTIC SMALL LETTER CRYPTOGRAMMIC NI -> w
    "ⲽ": "w",
    // U+A4EA LISU LETTER WA -> w
    "ꓪ": "w",
    // U+AB83 CHEROKEE SMALL LETTER LA -> w
    "ꮃ": "w",
    // U+1170A AHOM LETTER JA -> w
    "𑜊": "w",
    // U+1170E AHOM LETTER LA -> w
    "𑜎": "w",
    // U+1170F AHOM LETTER SA -> w
    "𑜏": "w",
    // U+118E6 WARANG CITI DIGIT SIX -> w
    "𑣦": "w",
    // U+118EF WARANG CITI NUMBER SIXTY -> w
    "𑣯": "w",
    // U+1CCEC OUTLINED LATIN CAPITAL LETTER W -> w
    "𜳬": "w",
    // U+1D416 MATHEMATICAL BOLD CAPITAL W -> w
    "𝐖": "w",
    // U+1D430 MATHEMATICAL BOLD SMALL W -> w
    "𝐰": "w",
    // U+1D44A MATHEMATICAL ITALIC CAPITAL W -> w
    "𝑊": "w",
    // U+1D464 MATHEMATICAL ITALIC SMALL W -> w
    "𝑤": "w",
    // U+1D47E MATHEMATICAL BOLD ITALIC CAPITAL W -> w
    "𝑾": "w",
    // U+1D498 MATHEMATICAL BOLD ITALIC SMALL W -> w
    "𝒘": "w",
    // U+1D4B2 MATHEMATICAL SCRIPT CAPITAL W -> w
    "𝒲": "w",
    // U+1D4CC MATHEMATICAL SCRIPT SMALL W -> w
    "𝓌": "w",
    // U+1D4E6 MATHEMATICAL BOLD SCRIPT CAPITAL W -> w
    "𝓦": "w",
    // U+1D500 MATHEMATICAL BOLD SCRIPT SMALL W -> w
    "𝔀": "w",
    // U+1D51A MATHEMATICAL FRAKTUR CAPITAL W -> w
    "𝔚": "w",
    // U+1D534 MATHEMATICAL FRAKTUR SMALL W -> w
    "𝔴": "w",
    // U+1D54E MATHEMATICAL DOUBLE-STRUCK CAPITAL W -> w
    "𝕎": "w",
    // U+1D568 MATHEMATICAL DOUBLE-STRUCK SMALL W -> w
    "𝕨": "w",
    // U+1D582 MATHEMATICAL BOLD FRAKTUR CAPITAL W -> w
    "𝖂": "w",
    // U+1D59C MATHEMATICAL BOLD FRAKTUR SMALL W -> w
    "𝖜": "w",
    // U+1D5B6 MATHEMATICAL SANS-SERIF CAPITAL W -> w
    "𝖶": "w",
    // U+1D5D0 MATHEMATICAL SANS-SERIF SMALL W -> w
    "𝗐": "w",
    // U+1D5EA MATHEMATICAL SANS-SERIF BOLD CAPITAL W -> w
    "𝗪": "w",
    // U+1D604 MATHEMATICAL SANS-SERIF BOLD SMALL W -> w
    "𝘄": "w",
    // U+1D61E MATHEMATICAL SANS-SERIF ITALIC CAPITAL W -> w
    "𝘞": "w",
    // U+1D638 MATHEMATICAL SANS-SERIF ITALIC SMALL W -> w
    "𝘸": "w",
    // U+1D652 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL W -> w
    "𝙒": "w",
    // U+1D66C MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL W -> w
    "𝙬": "w",
    // U+1D686 MATHEMATICAL MONOSPACE CAPITAL W -> w
    "𝚆": "w",
    // U+1D6A0 MATHEMATICAL MONOSPACE SMALL W -> w
    "𝚠": "w",
    // ===== characters that look like 'x' =====
    // U+00D7 MULTIPLICATION SIGN -> x
    "×": "x",
    // U+03A7 GREEK CAPITAL LETTER CHI -> x
    "Χ": "x",
    // U+0425 CYRILLIC CAPITAL LETTER HA -> x
    "Х": "x",
    // U+0445 CYRILLIC SMALL LETTER HA -> x
    "х": "x",
    // U+1541 CANADIAN SYLLABICS SAYISI YI -> x
    "ᕁ": "x",
    // U+157D CANADIAN SYLLABICS HK -> x
    "ᕽ": "x",
    // U+166D CANADIAN SYLLABICS CHI SIGN -> x
    "᙭": "x",
    // U+166E CANADIAN SYLLABICS FULL STOP -> x
    "᙮": "x",
    // U+16B7 RUNIC LETTER GEBO GYFU G -> x
    "ᚷ": "x",
    // U+2169 ROMAN NUMERAL TEN -> x
    "Ⅹ": "x",
    // U+2179 SMALL ROMAN NUMERAL TEN -> x
    "ⅹ": "x",
    // U+2573 BOX DRAWINGS LIGHT DIAGONAL CROSS -> x
    "╳": "x",
    // U+292B RISING DIAGONAL CROSSING FALLING DIAGONAL -> x
    "⤫": "x",
    // U+292C FALLING DIAGONAL CROSSING RISING DIAGONAL -> x
    "⤬": "x",
    // U+2A2F VECTOR OR CROSS PRODUCT -> x
    "⨯": "x",
    // U+2CAC COPTIC CAPITAL LETTER KHI -> x
    "Ⲭ": "x",
    // U+2D5D TIFINAGH LETTER YATH -> x
    "ⵝ": "x",
    // U+A4EB LISU LETTER SHA -> x
    "ꓫ": "x",
    // U+A7B3 LATIN CAPITAL LETTER CHI -> x
    "Ꭓ": "x",
    // U+FF38 FULLWIDTH LATIN CAPITAL LETTER X -> x
    "Ｘ": "x",
    // U+FF58 FULLWIDTH LATIN SMALL LETTER X -> x
    "ｘ": "x",
    // U+10290 LYCIAN LETTER MM -> x
    "𐊐": "x",
    // U+102B4 CARIAN LETTER X -> x
    "𐊴": "x",
    // U+10317 OLD ITALIC LETTER EKS -> x
    "𐌗": "x",
    // U+10322 OLD ITALIC NUMERAL TEN -> x
    "𐌢": "x",
    // U+10527 ELBASAN LETTER KHE -> x
    "𐔧": "x",
    // U+118EC WARANG CITI NUMBER THIRTY -> x
    "𑣬": "x",
    // U+1CCED OUTLINED LATIN CAPITAL LETTER X -> x
    "𜳭": "x",
    // U+1D417 MATHEMATICAL BOLD CAPITAL X -> x
    "𝐗": "x",
    // U+1D431 MATHEMATICAL BOLD SMALL X -> x
    "𝐱": "x",
    // U+1D44B MATHEMATICAL ITALIC CAPITAL X -> x
    "𝑋": "x",
    // U+1D465 MATHEMATICAL ITALIC SMALL X -> x
    "𝑥": "x",
    // U+1D47F MATHEMATICAL BOLD ITALIC CAPITAL X -> x
    "𝑿": "x",
    // U+1D499 MATHEMATICAL BOLD ITALIC SMALL X -> x
    "𝒙": "x",
    // U+1D4B3 MATHEMATICAL SCRIPT CAPITAL X -> x
    "𝒳": "x",
    // U+1D4CD MATHEMATICAL SCRIPT SMALL X -> x
    "𝓍": "x",
    // U+1D4E7 MATHEMATICAL BOLD SCRIPT CAPITAL X -> x
    "𝓧": "x",
    // U+1D501 MATHEMATICAL BOLD SCRIPT SMALL X -> x
    "𝔁": "x",
    // U+1D51B MATHEMATICAL FRAKTUR CAPITAL X -> x
    "𝔛": "x",
    // U+1D535 MATHEMATICAL FRAKTUR SMALL X -> x
    "𝔵": "x",
    // U+1D54F MATHEMATICAL DOUBLE-STRUCK CAPITAL X -> x
    "𝕏": "x",
    // U+1D569 MATHEMATICAL DOUBLE-STRUCK SMALL X -> x
    "𝕩": "x",
    // U+1D583 MATHEMATICAL BOLD FRAKTUR CAPITAL X -> x
    "𝖃": "x",
    // U+1D59D MATHEMATICAL BOLD FRAKTUR SMALL X -> x
    "𝖝": "x",
    // U+1D5B7 MATHEMATICAL SANS-SERIF CAPITAL X -> x
    "𝖷": "x",
    // U+1D5D1 MATHEMATICAL SANS-SERIF SMALL X -> x
    "𝗑": "x",
    // U+1D5EB MATHEMATICAL SANS-SERIF BOLD CAPITAL X -> x
    "𝗫": "x",
    // U+1D605 MATHEMATICAL SANS-SERIF BOLD SMALL X -> x
    "𝘅": "x",
    // U+1D61F MATHEMATICAL SANS-SERIF ITALIC CAPITAL X -> x
    "𝘟": "x",
    // U+1D639 MATHEMATICAL SANS-SERIF ITALIC SMALL X -> x
    "𝘹": "x",
    // U+1D653 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL X -> x
    "𝙓": "x",
    // U+1D66D MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL X -> x
    "𝙭": "x",
    // U+1D687 MATHEMATICAL MONOSPACE CAPITAL X -> x
    "𝚇": "x",
    // U+1D6A1 MATHEMATICAL MONOSPACE SMALL X -> x
    "𝚡": "x",
    // U+1D6BE MATHEMATICAL BOLD CAPITAL CHI -> x
    "𝚾": "x",
    // U+1D6F8 MATHEMATICAL ITALIC CAPITAL CHI -> x
    "𝛸": "x",
    // U+1D732 MATHEMATICAL BOLD ITALIC CAPITAL CHI -> x
    "𝜲": "x",
    // U+1D76C MATHEMATICAL SANS-SERIF BOLD CAPITAL CHI -> x
    "𝝬": "x",
    // U+1D7A6 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL CHI -> x
    "𝞦": "x",
    // ===== characters that look like 'y' =====
    // U+0263 LATIN SMALL LETTER GAMMA -> y
    "ɣ": "y",
    // U+028F LATIN LETTER SMALL CAPITAL Y -> y
    "ʏ": "y",
    // U+03A5 GREEK CAPITAL LETTER UPSILON -> y
    "Υ": "y",
    // U+03B3 GREEK SMALL LETTER GAMMA -> y
    "γ": "y",
    // U+03D2 GREEK UPSILON WITH HOOK SYMBOL -> y
    "ϒ": "y",
    // U+0423 CYRILLIC CAPITAL LETTER U -> y
    "У": "y",
    // U+0443 CYRILLIC SMALL LETTER U -> y
    "у": "y",
    // U+04AE CYRILLIC CAPITAL LETTER STRAIGHT U -> y
    "Ү": "y",
    // U+04AF CYRILLIC SMALL LETTER STRAIGHT U -> y
    "ү": "y",
    // U+10E7 GEORGIAN LETTER QAR -> y
    "ყ": "y",
    // U+13A9 CHEROKEE LETTER GI -> y
    "Ꭹ": "y",
    // U+13BD CHEROKEE LETTER MU -> y
    "Ꮍ": "y",
    // U+1D8C LATIN SMALL LETTER V WITH PALATAL HOOK -> y
    "ᶌ": "y",
    // U+1EFF LATIN SMALL LETTER Y WITH LOOP -> y
    "ỿ": "y",
    // U+213D DOUBLE-STRUCK SMALL GAMMA -> y
    "ℽ": "y",
    // U+2CA8 COPTIC CAPITAL LETTER UA -> y
    "Ⲩ": "y",
    // U+2CA9 COPTIC SMALL LETTER UA -> y
    "ⲩ": "y",
    // U+A4EC LISU LETTER YA -> y
    "ꓬ": "y",
    // U+AB5A LATIN SMALL LETTER Y WITH SHORT RIGHT LEG -> y
    "ꭚ": "y",
    // U+FF39 FULLWIDTH LATIN CAPITAL LETTER Y -> y
    "Ｙ": "y",
    // U+FF59 FULLWIDTH LATIN SMALL LETTER Y -> y
    "ｙ": "y",
    // U+102B2 CARIAN LETTER U -> y
    "𐊲": "y",
    // U+118A4 WARANG CITI CAPITAL LETTER YA -> y
    "𑢤": "y",
    // U+118DC WARANG CITI SMALL LETTER HAR -> y
    "𑣜": "y",
    // U+16F43 MIAO LETTER AH -> y
    "𖽃": "y",
    // U+1CCEE OUTLINED LATIN CAPITAL LETTER Y -> y
    "𜳮": "y",
    // U+1D418 MATHEMATICAL BOLD CAPITAL Y -> y
    "𝐘": "y",
    // U+1D432 MATHEMATICAL BOLD SMALL Y -> y
    "𝐲": "y",
    // U+1D44C MATHEMATICAL ITALIC CAPITAL Y -> y
    "𝑌": "y",
    // U+1D466 MATHEMATICAL ITALIC SMALL Y -> y
    "𝑦": "y",
    // U+1D480 MATHEMATICAL BOLD ITALIC CAPITAL Y -> y
    "𝒀": "y",
    // U+1D49A MATHEMATICAL BOLD ITALIC SMALL Y -> y
    "𝒚": "y",
    // U+1D4B4 MATHEMATICAL SCRIPT CAPITAL Y -> y
    "𝒴": "y",
    // U+1D4CE MATHEMATICAL SCRIPT SMALL Y -> y
    "𝓎": "y",
    // U+1D4E8 MATHEMATICAL BOLD SCRIPT CAPITAL Y -> y
    "𝓨": "y",
    // U+1D502 MATHEMATICAL BOLD SCRIPT SMALL Y -> y
    "𝔂": "y",
    // U+1D51C MATHEMATICAL FRAKTUR CAPITAL Y -> y
    "𝔜": "y",
    // U+1D536 MATHEMATICAL FRAKTUR SMALL Y -> y
    "𝔶": "y",
    // U+1D550 MATHEMATICAL DOUBLE-STRUCK CAPITAL Y -> y
    "𝕐": "y",
    // U+1D56A MATHEMATICAL DOUBLE-STRUCK SMALL Y -> y
    "𝕪": "y",
    // U+1D584 MATHEMATICAL BOLD FRAKTUR CAPITAL Y -> y
    "𝖄": "y",
    // U+1D59E MATHEMATICAL BOLD FRAKTUR SMALL Y -> y
    "𝖞": "y",
    // U+1D5B8 MATHEMATICAL SANS-SERIF CAPITAL Y -> y
    "𝖸": "y",
    // U+1D5D2 MATHEMATICAL SANS-SERIF SMALL Y -> y
    "𝗒": "y",
    // U+1D5EC MATHEMATICAL SANS-SERIF BOLD CAPITAL Y -> y
    "𝗬": "y",
    // U+1D606 MATHEMATICAL SANS-SERIF BOLD SMALL Y -> y
    "𝘆": "y",
    // U+1D620 MATHEMATICAL SANS-SERIF ITALIC CAPITAL Y -> y
    "𝘠": "y",
    // U+1D63A MATHEMATICAL SANS-SERIF ITALIC SMALL Y -> y
    "𝘺": "y",
    // U+1D654 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL Y -> y
    "𝙔": "y",
    // U+1D66E MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL Y -> y
    "𝙮": "y",
    // U+1D688 MATHEMATICAL MONOSPACE CAPITAL Y -> y
    "𝚈": "y",
    // U+1D6A2 MATHEMATICAL MONOSPACE SMALL Y -> y
    "𝚢": "y",
    // U+1D6BC MATHEMATICAL BOLD CAPITAL UPSILON -> y
    "𝚼": "y",
    // U+1D6C4 MATHEMATICAL BOLD SMALL GAMMA -> y
    "𝛄": "y",
    // U+1D6F6 MATHEMATICAL ITALIC CAPITAL UPSILON -> y
    "𝛶": "y",
    // U+1D6FE MATHEMATICAL ITALIC SMALL GAMMA -> y
    "𝛾": "y",
    // U+1D730 MATHEMATICAL BOLD ITALIC CAPITAL UPSILON -> y
    "𝜰": "y",
    // U+1D738 MATHEMATICAL BOLD ITALIC SMALL GAMMA -> y
    "𝜸": "y",
    // U+1D76A MATHEMATICAL SANS-SERIF BOLD CAPITAL UPSILON -> y
    "𝝪": "y",
    // U+1D772 MATHEMATICAL SANS-SERIF BOLD SMALL GAMMA -> y
    "𝝲": "y",
    // U+1D7A4 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL UPSILON -> y
    "𝞤": "y",
    // U+1D7AC MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL GAMMA -> y
    "𝞬": "y",
    // ===== characters that look like 'z' =====
    // U+0396 GREEK CAPITAL LETTER ZETA -> z
    "Ζ": "z",
    // U+13C3 CHEROKEE LETTER NO -> z
    "Ꮓ": "z",
    // U+1D22 LATIN LETTER SMALL CAPITAL Z -> z
    "ᴢ": "z",
    // U+2124 DOUBLE-STRUCK CAPITAL Z -> z
    "ℤ": "z",
    // U+2128 BLACK-LETTER CAPITAL Z -> z
    "ℨ": "z",
    // U+A4DC LISU LETTER DZA -> z
    "ꓜ": "z",
    // U+AB93 CHEROKEE SMALL LETTER NO -> z
    "ꮓ": "z",
    // U+FF3A FULLWIDTH LATIN CAPITAL LETTER Z -> z
    "Ｚ": "z",
    // U+102F5 COPTIC EPACT NUMBER THREE HUNDRED -> z
    "𐋵": "z",
    // U+118A9 WARANG CITI CAPITAL LETTER O -> z
    "𑢩": "z",
    // U+118C4 WARANG CITI SMALL LETTER YA -> z
    "𑣄": "z",
    // U+118E5 WARANG CITI DIGIT FIVE -> z
    "𑣥": "z",
    // U+1CCEF OUTLINED LATIN CAPITAL LETTER Z -> z
    "𜳯": "z",
    // U+1D419 MATHEMATICAL BOLD CAPITAL Z -> z
    "𝐙": "z",
    // U+1D433 MATHEMATICAL BOLD SMALL Z -> z
    "𝐳": "z",
    // U+1D44D MATHEMATICAL ITALIC CAPITAL Z -> z
    "𝑍": "z",
    // U+1D467 MATHEMATICAL ITALIC SMALL Z -> z
    "𝑧": "z",
    // U+1D481 MATHEMATICAL BOLD ITALIC CAPITAL Z -> z
    "𝒁": "z",
    // U+1D49B MATHEMATICAL BOLD ITALIC SMALL Z -> z
    "𝒛": "z",
    // U+1D4B5 MATHEMATICAL SCRIPT CAPITAL Z -> z
    "𝒵": "z",
    // U+1D4CF MATHEMATICAL SCRIPT SMALL Z -> z
    "𝓏": "z",
    // U+1D4E9 MATHEMATICAL BOLD SCRIPT CAPITAL Z -> z
    "𝓩": "z",
    // U+1D503 MATHEMATICAL BOLD SCRIPT SMALL Z -> z
    "𝔃": "z",
    // U+1D537 MATHEMATICAL FRAKTUR SMALL Z -> z
    "𝔷": "z",
    // U+1D56B MATHEMATICAL DOUBLE-STRUCK SMALL Z -> z
    "𝕫": "z",
    // U+1D585 MATHEMATICAL BOLD FRAKTUR CAPITAL Z -> z
    "𝖅": "z",
    // U+1D59F MATHEMATICAL BOLD FRAKTUR SMALL Z -> z
    "𝖟": "z",
    // U+1D5B9 MATHEMATICAL SANS-SERIF CAPITAL Z -> z
    "𝖹": "z",
    // U+1D5D3 MATHEMATICAL SANS-SERIF SMALL Z -> z
    "𝗓": "z",
    // U+1D5ED MATHEMATICAL SANS-SERIF BOLD CAPITAL Z -> z
    "𝗭": "z",
    // U+1D607 MATHEMATICAL SANS-SERIF BOLD SMALL Z -> z
    "𝘇": "z",
    // U+1D621 MATHEMATICAL SANS-SERIF ITALIC CAPITAL Z -> z
    "𝘡": "z",
    // U+1D63B MATHEMATICAL SANS-SERIF ITALIC SMALL Z -> z
    "𝘻": "z",
    // U+1D655 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL Z -> z
    "𝙕": "z",
    // U+1D66F MATHEMATICAL SANS-SERIF BOLD ITALIC SMALL Z -> z
    "𝙯": "z",
    // U+1D689 MATHEMATICAL MONOSPACE CAPITAL Z -> z
    "𝚉": "z",
    // U+1D6A3 MATHEMATICAL MONOSPACE SMALL Z -> z
    "𝚣": "z",
    // U+1D6AD MATHEMATICAL BOLD CAPITAL ZETA -> z
    "𝚭": "z",
    // U+1D6E7 MATHEMATICAL ITALIC CAPITAL ZETA -> z
    "𝛧": "z",
    // U+1D721 MATHEMATICAL BOLD ITALIC CAPITAL ZETA -> z
    "𝜡": "z",
    // U+1D75B MATHEMATICAL SANS-SERIF BOLD CAPITAL ZETA -> z
    "𝝛": "z",
    // U+1D795 MATHEMATICAL SANS-SERIF BOLD ITALIC CAPITAL ZETA -> z
    "𝞕": "z",
};

// Leetspeak expansions added to each letter's character class in the regex.
const LEET = {
    a: '@4', b: '8', c: '(', e: '3', g: '9', i: '1!|', l: '1|', o: '0', s: '5$', t: '7+', z: '2'
};

// Reverse map: a leet symbol -> the plain letter it stands in for. Used to build
// a "de-leeted" copy of the text so the cheap prefilter can find candidates
// like b@dw0rd or $h1t before the precise regex confirms them.
const DELEET = {
    '@': 'a', '4': 'a', '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e',
    '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g', '2': 'z', '(': 'c'
};
function applyDeleet(text) {
    let out = '';
    for (const ch of text) out += (DELEET[ch] || ch);
    return out;
}

// ---- Word list (your block list) ------------------------------------------
const WORDS_PATH = path.join(__dirname, 'words.json');
let WORDS = [];
let WORD_REGEX = new Map();

function loadWords() {
    try {
        const raw = JSON.parse(fs.readFileSync(WORDS_PATH, 'utf8'));
        WORDS = (Array.isArray(raw) ? raw : (raw.words || [])).map((w) => String(w).toLowerCase()).filter(Boolean);
    } catch {
        WORDS = [];
    }
    WORD_REGEX = new Map();
    for (const w of WORDS) {
        const r = buildWordRegex(w);
        if (r) WORD_REGEX.set(w, r);
    }
    return WORDS.length;
}

function saveWords() {
    fs.writeFileSync(WORDS_PATH, JSON.stringify({ words: WORDS }, null, 2), 'utf8');
}

// Characters that are special INSIDE a regex character class.
function escapeForClass(s) {
    return s.replace(/[-\\^\]]/g, '\\$&');
}

/**
 * Build a detection regex for one word that tolerates:
 *   - separators between letters  ([\W_]*  e.g. b.a.d, b a d, b-a-d)
 *   - leetspeak substitutions     (a -> [a@4], o -> [o0], ...)
 * but still requires word boundaries so "class" doesn't trip on "ass".
 */
function buildWordRegex(word) {
    const chars = String(word).toLowerCase().split('');
    if (!chars.length) return null;
    try {
        const parts = chars.map((c) => {
            const extra = LEET[c] || '';
            return '[' + escapeForClass(c + extra) + ']';
        });
        return new RegExp('(?<![a-z0-9])' + parts.join('[\\W_]*') + '(?![a-z0-9])', 'i');
    } catch {
        return null;
    }
}

// Map homoglyphs to ascii and lowercase, but KEEP separators so the regex
// (which allows separators between letters) can still see the structure.
function normalize(text) {
    let out = '';
    for (const ch of String(text).slice(0, 1000)) out += (CONFUSABLES[ch] || ch);
    return out.toLowerCase();
}

/**
 * Scan text. Returns one of:
 *   { status: 'clean' }
 *   { status: 'blocked', word }   definite hit (regex matched a whole word)
 *   { status: 'suspect', word }   collapsed text contains it but boundaries
 *                                 are fuzzy -> let the AI decide
 */
function scan(text) {
    const norm = normalize(text);
    const deleet = applyDeleet(norm);
    const cNorm = norm.replace(/[\W_]/g, '');
    const cDeleet = deleet.replace(/[\W_]/g, '');
    let suspect = null;
    for (const w of WORDS) {
        // Cheap prefilter: is the word present once separators are removed,
        // either as-is or after undoing leetspeak?
        if (!cNorm.includes(w) && !cDeleet.includes(w)) continue;
        const rx = WORD_REGEX.get(w);
        if (rx && (rx.test(norm) || rx.test(deleet))) return { status: 'blocked', word: w };
        suspect = w; // present but boundaries fuzzy -> let the AI decide
    }
    return suspect ? { status: 'suspect', word: suspect } : { status: 'clean' };
}

async function askAI(content, suspectWord) {
    const model = getModel();
    if (!model) return false;
    try {
        const prompt =
            'You are a strict Discord moderation filter. Reply with ONLY "YES" or "NO". ' +
            'Is the following message trying to say or disguise the banned word "' + suspectWord +
            '" (using spacing, symbols, or lookalike characters)? Message: "' + content.slice(0, 300) + '"';
        const res = await model.generateContent(prompt);
        return /\byes\b/i.test((await res.response).text());
    } catch {
        return false;
    }
}

async function punish(message) {
    await message.delete().catch(() => null);
    const warn = await message.channel.send({
        content: '🚫 ' + message.author.toString() + ', your message was removed for a filtered word.',
        allowedMentions: { users: [message.author.id] }
    }).catch(() => null);
    if (warn) setTimeout(() => warn.delete().catch(() => null), 5000);
}

/** Called from index.js on every message. Returns true if it acted. */
async function checkMessage(message, client) {
    if (!message.guild || !message.content) return false;
    const cfg = await FilterConfig.findOne({ guildId: message.guildId }).catch(() => null);
    if (!cfg || !cfg.enabled) return false;
    // Don't filter people who can already moderate.
    if (message.member?.permissions?.has(PermissionFlagsBits.ManageMessages)) return false;
    if (!WORDS.length) loadWords();

    const result = scan(message.content);
    if (result.status === 'blocked') { await punish(message); return true; }
    if (result.status === 'suspect' && cfg.useAI) {
        if (await askAI(message.content, result.word)) { await punish(message); return true; }
    }
    return false;
}

// Load words at startup.
loadWords();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('filter')
        .setDescription('Turn the word filter on/off and manage it')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(s => s.setName('enable').setDescription('Turn the word filter ON'))
        .addSubcommand(s => s.setName('disable').setDescription('Turn the word filter OFF'))
        .addSubcommand(s => s.setName('status').setDescription('Show the current filter status'))
        .addSubcommand(s => s.setName('ai').setDescription('Toggle the Gemini AI fallback')
            .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true)))
        .addSubcommand(s => s.setName('add').setDescription('Add a word to the filter')
            .addStringOption(o => o.setName('word').setDescription('Word to ban').setRequired(true)))
        .addSubcommand(s => s.setName('remove').setDescription('Remove a word from the filter')
            .addStringOption(o => o.setName('word').setDescription('Word to unban').setRequired(true)))
        .addSubcommand(s => s.setName('list').setDescription('Show how many words are filtered'))
        .addSubcommand(s => s.setName('test').setDescription('Test the filter against sample text')
            .addStringOption(o => o.setName('text').setDescription('Text to test').setRequired(true))),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: '❌ Server only.', ephemeral: true });
        }
        const sub = interaction.options.getSubcommand();
        const cfg = await FilterConfig.findOne({ guildId: interaction.guildId })
            || new FilterConfig({ guildId: interaction.guildId });

        if (sub === 'enable') {
            cfg.enabled = true; await cfg.save();
            return interaction.reply({ content: `✅ Word filter **enabled**. Watching for ${WORDS.length} words (bypass-resistant).`, ephemeral: true });
        }
        if (sub === 'disable') {
            cfg.enabled = false; await cfg.save();
            return interaction.reply({ content: '🛑 Word filter **disabled**.', ephemeral: true });
        }
        if (sub === 'ai') {
            cfg.useAI = interaction.options.getBoolean('enabled'); await cfg.save();
            return interaction.reply({ content: `🤖 AI fallback is now **${cfg.useAI ? 'ON' : 'OFF'}**.`, ephemeral: true });
        }
        if (sub === 'status') {
            const embed = new EmbedBuilder()
                .setTitle('🛡️ Word Filter Status')
                .setColor(cfg.enabled ? '#22c55e' : '#ef4444')
                .addFields(
                    { name: 'Filter', value: cfg.enabled ? '✅ Enabled' : '🛑 Disabled', inline: true },
                    { name: 'AI fallback', value: cfg.useAI ? '🤖 On' : 'Off', inline: true },
                    { name: 'Words loaded', value: String(WORDS.length), inline: true },
                    { name: 'Confusable chars mapped', value: String(Object.keys(CONFUSABLES).length), inline: true }
                );
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        if (sub === 'add') {
            const word = interaction.options.getString('word').toLowerCase().trim();
            if (WORDS.includes(word)) return interaction.reply({ content: '⚠️ That word is already filtered.', ephemeral: true });
            WORDS.push(word); saveWords(); loadWords();
            return interaction.reply({ content: `✅ Added \`${word}\`. Now filtering ${WORDS.length} words.`, ephemeral: true });
        }
        if (sub === 'remove') {
            const word = interaction.options.getString('word').toLowerCase().trim();
            if (!WORDS.includes(word)) return interaction.reply({ content: '⚠️ That word is not in the list.', ephemeral: true });
            WORDS = WORDS.filter((w) => w !== word); saveWords(); loadWords();
            return interaction.reply({ content: `🗑️ Removed \`${word}\`. Now filtering ${WORDS.length} words.`, ephemeral: true });
        }
        if (sub === 'list') {
            const preview = WORDS.slice(0, 30).join(', ');
            return interaction.reply({ content: `📋 **${WORDS.length}** words filtered.\nFirst 30: ${preview || '(none)'}`, ephemeral: true });
        }
        if (sub === 'test') {
            const text = interaction.options.getString('text');
            const r = scan(text);
            const label = r.status === 'blocked' ? `🚫 BLOCKED (matched \`${r.word}\`)`
                : r.status === 'suspect' ? `🤔 SUSPECT (looks like \`${r.word}\` — AI would decide)`
                    : '✅ CLEAN';
            return interaction.reply({ content: `Result: ${label}\nNormalized: \`${normalize(text).slice(0, 200)}\``, ephemeral: true });
        }
    },

    // Exposed for index.js + tests.
    checkMessage,
    scan,
    normalize,
    buildWordRegex,
    loadWords
};

/* ===========================================================================
   APPENDIX: A crash course in Regular Expressions (RegEx)
   ---------------------------------------------------------------------------
   This filter leans on RegEx to catch bypass attempts. Here is exactly how
   the patterns in this file work, so future-you can extend them confidently.
   =========================================================================== */

/* Lesson 1: What is a RegEx?
 * A Regular Expression is a tiny pattern language for matching text.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 2: Literal characters
 * /bad/ matches the exact letters b, a, d in a row.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 3: Case insensitivity
 * The "i" flag makes /bad/i match BAD, Bad, bAd, etc.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 4: Character classes
 * [abc] matches a, b, OR c. [a@4] matches a, @ or 4 (leetspeak).
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 5: Ranges in classes
 * [a-z] matches any lowercase letter; [0-9] any digit.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 6: Negated classes
 * [^a-z] matches anything that is NOT a lowercase letter.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 7: The dot
 * . matches any single character except a newline.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 8: Quantifier *
 * * means "zero or more" of the previous thing.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 9: Quantifier +
 * + means "one or more".
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 10: Quantifier ?
 * ? means "zero or one" (optional).
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 11: Exact counts
 * {3} means exactly 3; {2,5} means between 2 and 5.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 12: \W and \w
 * \w is a word char [A-Za-z0-9_]; \W is the opposite.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 13: Why [\W_]*
 * It lets us skip ANY separators between letters: b.a.d, b a d, b-a-d.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 14: Anchors
 * ^ matches start of string, $ matches the end.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 15: Word boundaries
 * \b sits between a word char and a non-word char.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 16: Lookahead
 * (?=x) asserts x comes next WITHOUT consuming it.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 17: Negative lookahead
 * (?!x) asserts x does NOT come next.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 18: Lookbehind
 * (?<=x) asserts x came right before.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 19: Negative lookbehind
 * (?<!x) asserts x did NOT come right before.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 20: Our boundary trick
 * (?<![a-z0-9]) ... (?![a-z0-9]) means the word is not glued to other letters.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 21: Escaping
 * Special chars like . * + ? need a backslash to be literal: \.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 22: Groups
 * (abc) groups characters so quantifiers apply to the whole group.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 23: Alternation
 * cat|dog matches "cat" OR "dog".
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 24: Greedy vs lazy
 * .* grabs as much as possible; .*? grabs as little as possible.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 25: Unicode homoglyphs
 * A Cyrillic а (U+0430) looks like Latin a but is a different char.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 26: Why we normalize
 * We map homoglyphs to ascii FIRST, so bаd becomes bad before matching.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 27: The Scunthorpe problem
 * Naive filters flag "classic" because it contains "ass" — boundaries help.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 28: Combine the tricks
 * normalize() + [\W_]* + leet classes + boundaries = bypass-resistant.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 29: When in doubt
 * If the regex is unsure, we hand the message to Gemini AI to judge.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 30: What is a RegEx?
 * A Regular Expression is a tiny pattern language for matching text.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 31: Literal characters
 * /bad/ matches the exact letters b, a, d in a row.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 32: Case insensitivity
 * The "i" flag makes /bad/i match BAD, Bad, bAd, etc.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 33: Character classes
 * [abc] matches a, b, OR c. [a@4] matches a, @ or 4 (leetspeak).
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 34: Ranges in classes
 * [a-z] matches any lowercase letter; [0-9] any digit.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 35: Negated classes
 * [^a-z] matches anything that is NOT a lowercase letter.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 36: The dot
 * . matches any single character except a newline.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 37: Quantifier *
 * * means "zero or more" of the previous thing.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 38: Quantifier +
 * + means "one or more".
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 39: Quantifier ?
 * ? means "zero or one" (optional).
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 40: Exact counts
 * {3} means exactly 3; {2,5} means between 2 and 5.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 41: \W and \w
 * \w is a word char [A-Za-z0-9_]; \W is the opposite.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 42: Why [\W_]*
 * It lets us skip ANY separators between letters: b.a.d, b a d, b-a-d.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 43: Anchors
 * ^ matches start of string, $ matches the end.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 44: Word boundaries
 * \b sits between a word char and a non-word char.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 45: Lookahead
 * (?=x) asserts x comes next WITHOUT consuming it.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 46: Negative lookahead
 * (?!x) asserts x does NOT come next.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 47: Lookbehind
 * (?<=x) asserts x came right before.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 48: Negative lookbehind
 * (?<!x) asserts x did NOT come right before.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 49: Our boundary trick
 * (?<![a-z0-9]) ... (?![a-z0-9]) means the word is not glued to other letters.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 50: Escaping
 * Special chars like . * + ? need a backslash to be literal: \.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 51: Groups
 * (abc) groups characters so quantifiers apply to the whole group.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 52: Alternation
 * cat|dog matches "cat" OR "dog".
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 53: Greedy vs lazy
 * .* grabs as much as possible; .*? grabs as little as possible.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 54: Unicode homoglyphs
 * A Cyrillic а (U+0430) looks like Latin a but is a different char.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 55: Why we normalize
 * We map homoglyphs to ascii FIRST, so bаd becomes bad before matching.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 56: The Scunthorpe problem
 * Naive filters flag "classic" because it contains "ass" — boundaries help.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 57: Combine the tricks
 * normalize() + [\W_]* + leet classes + boundaries = bypass-resistant.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 58: When in doubt
 * If the regex is unsure, we hand the message to Gemini AI to judge.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 59: What is a RegEx?
 * A Regular Expression is a tiny pattern language for matching text.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 60: Literal characters
 * /bad/ matches the exact letters b, a, d in a row.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 61: Case insensitivity
 * The "i" flag makes /bad/i match BAD, Bad, bAd, etc.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 62: Character classes
 * [abc] matches a, b, OR c. [a@4] matches a, @ or 4 (leetspeak).
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 63: Ranges in classes
 * [a-z] matches any lowercase letter; [0-9] any digit.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 64: Negated classes
 * [^a-z] matches anything that is NOT a lowercase letter.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 65: The dot
 * . matches any single character except a newline.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 66: Quantifier *
 * * means "zero or more" of the previous thing.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 67: Quantifier +
 * + means "one or more".
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 68: Quantifier ?
 * ? means "zero or one" (optional).
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 69: Exact counts
 * {3} means exactly 3; {2,5} means between 2 and 5.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 70: \W and \w
 * \w is a word char [A-Za-z0-9_]; \W is the opposite.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 71: Why [\W_]*
 * It lets us skip ANY separators between letters: b.a.d, b a d, b-a-d.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 72: Anchors
 * ^ matches start of string, $ matches the end.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 73: Word boundaries
 * \b sits between a word char and a non-word char.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 74: Lookahead
 * (?=x) asserts x comes next WITHOUT consuming it.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 75: Negative lookahead
 * (?!x) asserts x does NOT come next.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 76: Lookbehind
 * (?<=x) asserts x came right before.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 77: Negative lookbehind
 * (?<!x) asserts x did NOT come right before.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 78: Our boundary trick
 * (?<![a-z0-9]) ... (?![a-z0-9]) means the word is not glued to other letters.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 79: Escaping
 * Special chars like . * + ? need a backslash to be literal: \.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 80: Groups
 * (abc) groups characters so quantifiers apply to the whole group.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 81: Alternation
 * cat|dog matches "cat" OR "dog".
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 82: Greedy vs lazy
 * .* grabs as much as possible; .*? grabs as little as possible.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 83: Unicode homoglyphs
 * A Cyrillic а (U+0430) looks like Latin a but is a different char.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 84: Why we normalize
 * We map homoglyphs to ascii FIRST, so bаd becomes bad before matching.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 85: The Scunthorpe problem
 * Naive filters flag "classic" because it contains "ass" — boundaries help.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 86: Combine the tricks
 * normalize() + [\W_]* + leet classes + boundaries = bypass-resistant.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 87: When in doubt
 * If the regex is unsure, we hand the message to Gemini AI to judge.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 88: What is a RegEx?
 * A Regular Expression is a tiny pattern language for matching text.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 89: Literal characters
 * /bad/ matches the exact letters b, a, d in a row.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 90: Case insensitivity
 * The "i" flag makes /bad/i match BAD, Bad, bAd, etc.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 91: Character classes
 * [abc] matches a, b, OR c. [a@4] matches a, @ or 4 (leetspeak).
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 92: Ranges in classes
 * [a-z] matches any lowercase letter; [0-9] any digit.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 93: Negated classes
 * [^a-z] matches anything that is NOT a lowercase letter.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 94: The dot
 * . matches any single character except a newline.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 95: Quantifier *
 * * means "zero or more" of the previous thing.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 96: Quantifier +
 * + means "one or more".
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 97: Quantifier ?
 * ? means "zero or one" (optional).
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 98: Exact counts
 * {3} means exactly 3; {2,5} means between 2 and 5.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 99: \W and \w
 * \w is a word char [A-Za-z0-9_]; \W is the opposite.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 100: Why [\W_]*
 * It lets us skip ANY separators between letters: b.a.d, b a d, b-a-d.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 101: Anchors
 * ^ matches start of string, $ matches the end.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 102: Word boundaries
 * \b sits between a word char and a non-word char.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 103: Lookahead
 * (?=x) asserts x comes next WITHOUT consuming it.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 104: Negative lookahead
 * (?!x) asserts x does NOT come next.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 105: Lookbehind
 * (?<=x) asserts x came right before.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 106: Negative lookbehind
 * (?<!x) asserts x did NOT come right before.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 107: Our boundary trick
 * (?<![a-z0-9]) ... (?![a-z0-9]) means the word is not glued to other letters.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 108: Escaping
 * Special chars like . * + ? need a backslash to be literal: \.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 109: Groups
 * (abc) groups characters so quantifiers apply to the whole group.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 110: Alternation
 * cat|dog matches "cat" OR "dog".
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 111: Greedy vs lazy
 * .* grabs as much as possible; .*? grabs as little as possible.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 112: Unicode homoglyphs
 * A Cyrillic а (U+0430) looks like Latin a but is a different char.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 113: Why we normalize
 * We map homoglyphs to ascii FIRST, so bаd becomes bad before matching.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 114: The Scunthorpe problem
 * Naive filters flag "classic" because it contains "ass" — boundaries help.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 115: Combine the tricks
 * normalize() + [\W_]* + leet classes + boundaries = bypass-resistant.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 116: When in doubt
 * If the regex is unsure, we hand the message to Gemini AI to judge.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 117: What is a RegEx?
 * A Regular Expression is a tiny pattern language for matching text.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 118: Literal characters
 * /bad/ matches the exact letters b, a, d in a row.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 119: Case insensitivity
 * The "i" flag makes /bad/i match BAD, Bad, bAd, etc.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 120: Character classes
 * [abc] matches a, b, OR c. [a@4] matches a, @ or 4 (leetspeak).
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 121: Ranges in classes
 * [a-z] matches any lowercase letter; [0-9] any digit.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 122: Negated classes
 * [^a-z] matches anything that is NOT a lowercase letter.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 123: The dot
 * . matches any single character except a newline.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 124: Quantifier *
 * * means "zero or more" of the previous thing.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 125: Quantifier +
 * + means "one or more".
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 126: Quantifier ?
 * ? means "zero or one" (optional).
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 127: Exact counts
 * {3} means exactly 3; {2,5} means between 2 and 5.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 128: \W and \w
 * \w is a word char [A-Za-z0-9_]; \W is the opposite.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 129: Why [\W_]*
 * It lets us skip ANY separators between letters: b.a.d, b a d, b-a-d.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 130: Anchors
 * ^ matches start of string, $ matches the end.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 131: Word boundaries
 * \b sits between a word char and a non-word char.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 132: Lookahead
 * (?=x) asserts x comes next WITHOUT consuming it.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 133: Negative lookahead
 * (?!x) asserts x does NOT come next.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 134: Lookbehind
 * (?<=x) asserts x came right before.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 135: Negative lookbehind
 * (?<!x) asserts x did NOT come right before.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 136: Our boundary trick
 * (?<![a-z0-9]) ... (?![a-z0-9]) means the word is not glued to other letters.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 137: Escaping
 * Special chars like . * + ? need a backslash to be literal: \.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 138: Groups
 * (abc) groups characters so quantifiers apply to the whole group.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 139: Alternation
 * cat|dog matches "cat" OR "dog".
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 140: Greedy vs lazy
 * .* grabs as much as possible; .*? grabs as little as possible.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 141: Unicode homoglyphs
 * A Cyrillic а (U+0430) looks like Latin a but is a different char.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 142: Why we normalize
 * We map homoglyphs to ascii FIRST, so bаd becomes bad before matching.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 143: The Scunthorpe problem
 * Naive filters flag "classic" because it contains "ass" — boundaries help.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 144: Combine the tricks
 * normalize() + [\W_]* + leet classes + boundaries = bypass-resistant.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 145: When in doubt
 * If the regex is unsure, we hand the message to Gemini AI to judge.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 146: What is a RegEx?
 * A Regular Expression is a tiny pattern language for matching text.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 147: Literal characters
 * /bad/ matches the exact letters b, a, d in a row.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 148: Case insensitivity
 * The "i" flag makes /bad/i match BAD, Bad, bAd, etc.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 149: Character classes
 * [abc] matches a, b, OR c. [a@4] matches a, @ or 4 (leetspeak).
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 150: Ranges in classes
 * [a-z] matches any lowercase letter; [0-9] any digit.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 151: Negated classes
 * [^a-z] matches anything that is NOT a lowercase letter.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 152: The dot
 * . matches any single character except a newline.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 153: Quantifier *
 * * means "zero or more" of the previous thing.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 154: Quantifier +
 * + means "one or more".
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 155: Quantifier ?
 * ? means "zero or one" (optional).
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 156: Exact counts
 * {3} means exactly 3; {2,5} means between 2 and 5.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 157: \W and \w
 * \w is a word char [A-Za-z0-9_]; \W is the opposite.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 158: Why [\W_]*
 * It lets us skip ANY separators between letters: b.a.d, b a d, b-a-d.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 159: Anchors
 * ^ matches start of string, $ matches the end.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 160: Word boundaries
 * \b sits between a word char and a non-word char.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 161: Lookahead
 * (?=x) asserts x comes next WITHOUT consuming it.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 162: Negative lookahead
 * (?!x) asserts x does NOT come next.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 163: Lookbehind
 * (?<=x) asserts x came right before.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 164: Negative lookbehind
 * (?<!x) asserts x did NOT come right before.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 165: Our boundary trick
 * (?<![a-z0-9]) ... (?![a-z0-9]) means the word is not glued to other letters.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 166: Escaping
 * Special chars like . * + ? need a backslash to be literal: \.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 167: Groups
 * (abc) groups characters so quantifiers apply to the whole group.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 168: Alternation
 * cat|dog matches "cat" OR "dog".
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 169: Greedy vs lazy
 * .* grabs as much as possible; .*? grabs as little as possible.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 170: Unicode homoglyphs
 * A Cyrillic а (U+0430) looks like Latin a but is a different char.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 171: Why we normalize
 * We map homoglyphs to ascii FIRST, so bаd becomes bad before matching.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 172: The Scunthorpe problem
 * Naive filters flag "classic" because it contains "ass" — boundaries help.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 173: Combine the tricks
 * normalize() + [\W_]* + leet classes + boundaries = bypass-resistant.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 174: When in doubt
 * If the regex is unsure, we hand the message to Gemini AI to judge.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 175: What is a RegEx?
 * A Regular Expression is a tiny pattern language for matching text.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 176: Literal characters
 * /bad/ matches the exact letters b, a, d in a row.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 177: Case insensitivity
 * The "i" flag makes /bad/i match BAD, Bad, bAd, etc.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 178: Character classes
 * [abc] matches a, b, OR c. [a@4] matches a, @ or 4 (leetspeak).
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 179: Ranges in classes
 * [a-z] matches any lowercase letter; [0-9] any digit.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 180: Negated classes
 * [^a-z] matches anything that is NOT a lowercase letter.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 181: The dot
 * . matches any single character except a newline.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 182: Quantifier *
 * * means "zero or more" of the previous thing.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 183: Quantifier +
 * + means "one or more".
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 184: Quantifier ?
 * ? means "zero or one" (optional).
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 185: Exact counts
 * {3} means exactly 3; {2,5} means between 2 and 5.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 186: \W and \w
 * \w is a word char [A-Za-z0-9_]; \W is the opposite.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 187: Why [\W_]*
 * It lets us skip ANY separators between letters: b.a.d, b a d, b-a-d.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 188: Anchors
 * ^ matches start of string, $ matches the end.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 189: Word boundaries
 * \b sits between a word char and a non-word char.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 190: Lookahead
 * (?=x) asserts x comes next WITHOUT consuming it.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 191: Negative lookahead
 * (?!x) asserts x does NOT come next.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 192: Lookbehind
 * (?<=x) asserts x came right before.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 193: Negative lookbehind
 * (?<!x) asserts x did NOT come right before.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 194: Our boundary trick
 * (?<![a-z0-9]) ... (?![a-z0-9]) means the word is not glued to other letters.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 195: Escaping
 * Special chars like . * + ? need a backslash to be literal: \.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 196: Groups
 * (abc) groups characters so quantifiers apply to the whole group.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 197: Alternation
 * cat|dog matches "cat" OR "dog".
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 198: Greedy vs lazy
 * .* grabs as much as possible; .*? grabs as little as possible.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 199: Unicode homoglyphs
 * A Cyrillic а (U+0430) looks like Latin a but is a different char.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 200: Why we normalize
 * We map homoglyphs to ascii FIRST, so bаd becomes bad before matching.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 201: The Scunthorpe problem
 * Naive filters flag "classic" because it contains "ass" — boundaries help.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 202: Combine the tricks
 * normalize() + [\W_]* + leet classes + boundaries = bypass-resistant.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 203: When in doubt
 * If the regex is unsure, we hand the message to Gemini AI to judge.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 204: What is a RegEx?
 * A Regular Expression is a tiny pattern language for matching text.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 205: Literal characters
 * /bad/ matches the exact letters b, a, d in a row.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 206: Case insensitivity
 * The "i" flag makes /bad/i match BAD, Bad, bAd, etc.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 207: Character classes
 * [abc] matches a, b, OR c. [a@4] matches a, @ or 4 (leetspeak).
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 208: Ranges in classes
 * [a-z] matches any lowercase letter; [0-9] any digit.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 209: Negated classes
 * [^a-z] matches anything that is NOT a lowercase letter.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 210: The dot
 * . matches any single character except a newline.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 211: Quantifier *
 * * means "zero or more" of the previous thing.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 212: Quantifier +
 * + means "one or more".
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 213: Quantifier ?
 * ? means "zero or one" (optional).
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 214: Exact counts
 * {3} means exactly 3; {2,5} means between 2 and 5.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 215: \W and \w
 * \w is a word char [A-Za-z0-9_]; \W is the opposite.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 216: Why [\W_]*
 * It lets us skip ANY separators between letters: b.a.d, b a d, b-a-d.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 217: Anchors
 * ^ matches start of string, $ matches the end.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */

/* Lesson 218: Word boundaries
 * \b sits between a word char and a non-word char.
 * Example pattern  : /[a@4]/
 * Example match    : "@" "4" "a"
 */

/* Lesson 219: Lookahead
 * (?=x) asserts x comes next WITHOUT consuming it.
 * Example pattern  : /b[\W_]*a[\W_]*d/i
 * Example match    : "b.a.d" "b a d" "b-a-d"
 */

/* Lesson 220: Negative lookahead
 * (?!x) asserts x does NOT come next.
 * Example pattern  : /(?<![a-z0-9])bad(?![a-z0-9])/i
 * Example match    : "bad" but NOT "badword"
 */

/* Lesson 221: Lookbehind
 * (?<=x) asserts x came right before.
 * Example pattern  : /h+e+l+l+o+/i
 * Example match    : "hellooo" "hel" no
 */

/* Lesson 222: Negative lookbehind
 * (?<!x) asserts x did NOT come right before.
 * Example pattern  : /c(at|og)/
 * Example match    : "cat" "cog"
 */

/* Lesson 223: Our boundary trick
 * (?<![a-z0-9]) ... (?![a-z0-9]) means the word is not glued to other letters.
 * Example pattern  : /\d{3}-\d{4}/
 * Example match    : "123-4567"
 */

/* Lesson 224: Escaping
 * Special chars like . * + ? need a backslash to be literal: \.
 * Example pattern  : /colou?r/i
 * Example match    : "color" "colour"
 */

/* Lesson 225: Groups
 * (abc) groups characters so quantifiers apply to the whole group.
 * Example pattern  : /bad/i
 * Example match    : "BAD" "bad" "Bad"
 */
