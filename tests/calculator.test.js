// SPDX-License-Identifier: GPL-3.0-or-later
import assert from 'node:assert/strict';
import test from 'node:test';
import {evaluate} from '../calculator.js';

test('precedence, grouping, unary signs, decimals, and remainder', () => {
    for (const [expression, answer] of [
        ['2+3*4', '14'], ['(2+3)*4', '20'], ['-(-2+5)', '-3'],
        ['2*-3', '-6'], ['.5+1.', '1.5'], ['10%3', '1'],
        [' 10 / (2 + 3) ', '2'], ['0.1+0.2', '0.3'], ['-0', '0'],
    ])
        assert.equal(evaluate(expression), answer, expression);
});

test('results in scientific notation can be chained into another calculation', () => {
    const large = evaluate('999999999999*999999999999');
    assert.equal(evaluate(`${large}/1e24`), '0.999999999998');
    const small = evaluate('1/100000000000000');
    assert.equal(evaluate(`${small}*100000000000000`), '1');
    assert.equal(evaluate('1E+3+2e-2'), '1000.02');
});

test('invalid input and non-finite arithmetic are rejected', () => {
    for (const expression of ['', '1/0', '1%0', '1/(2-2)', '(1+2', '1+2)',
        '2(3)', '1..2', '2+', 'NaN', 'Infinity', '1e309', '1e308*10',
        'globalThis.process.exit()', '1;2', '2**3', '1'.repeat(513)])
        assert.throws(() => evaluate(expression), undefined, expression);
});
