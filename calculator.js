// SPDX-License-Identifier: GPL-3.0-or-later
// Shared with the Node tests; never execute expressions as JavaScript.
export function evaluate(expression) {
    const input = String(expression).replace(/\s/g, '');
    if (input.length > 512)
        throw new Error('Expression is too long (maximum 512 characters)');
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
    const tokens = input.match(/(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[()+\-*/%]/gi);
    if (!tokens || tokens.join('') !== input)
        throw new Error('Invalid expression');
    let position = 0;
    const peek = () => tokens[position];
    const take = () => tokens[position++];
    function primary() {
        if (peek() === '(') {
            take();
            const value = sum();
            if (take() !== ')')
                throw new Error('Missing closing parenthesis');
            return value;
        }
        const token = take();
        if (!token || !number.test(token))
            throw new Error('Expected a number');
        return Number(token);
    }
    function unary() {
        if (peek() === '+' || peek() === '-') {
            const sign = take();
            const value = unary();
            return sign === '-' ? -value : value;
        }
        return primary();
    }
    function product() {
        let value = unary();
        while (['*', '/', '%'].includes(peek())) {
            const operator = take();
            const right = unary();
            if (right === 0 && operator !== '*')
                throw new Error('Cannot divide by zero');
            if (operator === '*')
                value *= right;
            else if (operator === '/')
                value /= right;
            else
                value %= right;
        }
        return value;
    }
    function sum() {
        let value = product();
        while (['+', '-'].includes(peek())) {
            const operator = take();
            const right = product();
            value = operator === '+' ? value + right : value - right;
        }
        return value;
    }
    const value = sum();
    if (position !== tokens.length || !Number.isFinite(value))
        throw new Error('Invalid result');
    return String(Number(value.toPrecision(12)));
}
