import test from 'node:test';
import assert from 'node:assert/strict';

import {
  scanCompliance,
  isBlocked,
  highlightText,
  buildCleanInstruction
} from '../src/compliance.js';

test('scanCompliance returns grouped hits with suggestions', () => {
  const hits = scanCompliance('这组是全网首发，想了解可以加微信，真的很美。');

  assert.deepEqual(hits.map((hit) => [hit.group, hit.word]), [
    ['absolute', '全网首发'],
    ['contact', '加微信'],
    ['risk', '很美']
  ]);
  assert.equal(hits[0].suggestion, '这组新片');
});

test('isBlocked only blocks absolute and contact groups', () => {
  assert.equal(isBlocked(scanCompliance('全网首发作品')), true);
  assert.equal(isBlocked(scanCompliance('欢迎加微信了解')), true);
  assert.equal(isBlocked(scanCompliance('氛围很美')), false);
});

test('highlightText escapes html and wraps risky words', () => {
  const html = highlightText('<script>最美</script>', scanCompliance('<script>最美</script>'));

  assert.equal(html, '&lt;script&gt;<mark class="risk-word risk-absolute">最美</mark>&lt;/script&gt;');
});

test('buildCleanInstruction lists words and replacement hints', () => {
  const instruction = buildCleanInstruction(scanCompliance('全网首发，加微信'));

  assert.match(instruction, /全网首发/);
  assert.match(instruction, /这组新片/);
  assert.match(instruction, /加微信/);
  assert.match(instruction, /留言/);
});
