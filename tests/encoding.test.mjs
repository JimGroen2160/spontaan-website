import assert from 'node:assert/strict';
import test from 'node:test';
import {assertNoMojibake, checkProjectEncoding, findMojibake} from '../scripts/check-encoding.mjs';

test('correcte Nederlandse accenten en leestekens blijven geldig', () => {
  const valid = '[TEST] Voorbeeldvideo één met foto’s en video’s; café, reünie en naïef.';
  assert.deepEqual(findMojibake(valid), []);
  assert.doesNotThrow(() => assertNoMojibake(valid, 'geldige Nederlandse tekst'));
});

test('bekende mojibakepatronen worden afgewezen', () => {
  const brokenAccent = `[TEST] Voorbeeldvideo ${String.fromCodePoint(0xc3, 0xa9, 0xc3, 0xa9)}n`;
  const brokenApostrophe = `foto${String.fromCodePoint(0xe2, 0x20ac, 0x2122)}s`;
  assert.throws(() => assertNoMojibake(brokenAccent), /Mojibake aangetroffen/);
  assert.throws(() => assertNoMojibake(brokenApostrophe), /Mojibake aangetroffen/);
});

test('projectbrede tekstbronnen zijn vrij van mojibake', async () => {
  await assert.doesNotReject(checkProjectEncoding());
});
