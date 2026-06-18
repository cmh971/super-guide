/**
 * @file calc.js
 * @description A safe arithmetic calculator. Tokenizes and evaluates a math
 *              expression with +, -, *, /, %, ^, and parentheses — no eval().
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

/**
 * Tokenize an arithmetic expression into numbers and operators.
 * @param {string} expr
 * @returns {Array<{ type: string, value: string|number }>}
 */
function tokenize(expr) {
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
        const ch = expr[i];
        if (ch === ' ') { i++; continue; }
        if (/[0-9.]/.test(ch)) {
            let num = '';
            while (i < expr.length && /[0-9.]/.test(expr[i])) { num += expr[i++]; }
            tokens.push({ type: 'number', value: parseFloat(num) });
            continue;
        }
        if ('+-*/%^()'.includes(ch)) {
            tokens.push({ type: 'op', value: ch });
            i++;
            continue;
        }
        throw new Error(`Unexpected character: ${ch}`);
    }
    return tokens;
}

// Operator precedence and associativity for the shunting-yard pass.
const PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3 };
const RIGHT_ASSOC = { '^': true };

/**
 * Convert infix tokens to Reverse Polish Notation (shunting-yard).
 * @param {Array} tokens
 * @returns {Array}
 */
function toRPN(tokens) {
    const output = [];
    const stack = [];
    for (const token of tokens) {
        if (token.type === 'number') {
            output.push(token);
        } else if (token.value === '(') {
            stack.push(token);
        } else if (token.value === ')') {
            while (stack.length && stack[stack.length - 1].value !== '(') output.push(stack.pop());
            if (!stack.length) throw new Error('Mismatched parentheses');
            stack.pop();
        } else {
            while (
                stack.length &&
                stack[stack.length - 1].value !== '(' &&
                (PRECEDENCE[stack[stack.length - 1].value] > PRECEDENCE[token.value] ||
                    (PRECEDENCE[stack[stack.length - 1].value] === PRECEDENCE[token.value] && !RIGHT_ASSOC[token.value]))
            ) {
                output.push(stack.pop());
            }
            stack.push(token);
        }
    }
    while (stack.length) {
        const op = stack.pop();
        if (op.value === '(') throw new Error('Mismatched parentheses');
        output.push(op);
    }
    return output;
}

/**
 * Evaluate an RPN token stream into a number.
 * @param {Array} rpn
 * @returns {number}
 */
function evalRPN(rpn) {
    const stack = [];
    for (const token of rpn) {
        if (token.type === 'number') { stack.push(token.value); continue; }
        const b = stack.pop();
        const a = stack.pop();
        if (a === undefined || b === undefined) throw new Error('Invalid expression');
        switch (token.value) {
            case '+': stack.push(a + b); break;
            case '-': stack.push(a - b); break;
            case '*': stack.push(a * b); break;
            case '/': stack.push(a / b); break;
            case '%': stack.push(a % b); break;
            case '^': stack.push(Math.pow(a, b)); break;
            default: throw new Error('Unknown operator');
        }
    }
    if (stack.length !== 1) throw new Error('Invalid expression');
    return stack[0];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('calc')
        .setDescription('Evaluate a math expression safely')
        .addStringOption(option =>
            option.setName('expression')
                .setDescription('e.g. (2 + 3) * 4 ^ 2')
                .setRequired(true)),

    async execute(interaction) {
        const expr = interaction.options.getString('expression');
        try {
            const result = evalRPN(toRPN(tokenize(expr)));
            if (!Number.isFinite(result)) throw new Error('Result is not finite (division by zero?)');

            const embed = new EmbedBuilder()
                .setTitle('🧮 Calculator')
                .setColor('#3b82f6')
                .addFields(
                    { name: 'Expression', value: `\`${expr.slice(0, 200)}\``, inline: false },
                    { name: 'Result', value: `**${result}**`, inline: false }
                )
                .setFooter({ text: `Requested by ${interaction.user.tag}` });
            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
        }
    }
};

// End of file: calc.js
