import assert from 'node:assert/strict';
import { test } from 'node:test';
import { choosePlural } from './plural.ts';

const days = '{1} :count day left|[2,*] :count days left';

await test('an exact count and an open range pick their own sentence', () => {
    assert.equal(choosePlural(days, 1, 'en'), ':count day left');
    assert.equal(choosePlural(days, 2, 'en'), ':count days left');
    assert.equal(choosePlural(days, 40, 'en'), ':count days left');
});

await test('zero, closed ranges and ranges open below are honoured', () => {
    const line = '{0} Nothing yet|[1,3] A few|[*,10] Several|[11,*] Many';

    assert.equal(choosePlural(line, 0, 'en'), 'Nothing yet');
    assert.equal(choosePlural(line, 3, 'en'), 'A few');
    assert.equal(choosePlural(line, 7, 'en'), 'Several');
    assert.equal(choosePlural(line, 11, 'en'), 'Many');
});

await test('forms without conditions follow the language plural rule', () => {
    const en = 'one day|many days';
    const fr = 'un jour|des jours';

    assert.equal(choosePlural(en, 0, 'en'), 'many days');
    assert.equal(choosePlural(en, 1, 'en'), 'one day');
    assert.equal(choosePlural(fr, 0, 'fr'), 'un jour');
    assert.equal(choosePlural(fr, 1, 'fr'), 'un jour');
    assert.equal(choosePlural(fr, 2, 'fr'), 'des jours');
});

await test('an unmatched count falls back to the forms in order', () => {
    assert.equal(choosePlural(days, 0, 'en'), ':count days left');
    assert.equal(choosePlural(days, 0, 'fr'), ':count day left');
    assert.equal(choosePlural('Only one form', 5, 'en'), 'Only one form');
});
