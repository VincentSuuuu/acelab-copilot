import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCookieString,
  readCookieValue,
  loadSettings,
  saveSettings,
  saveDraft,
  loadDrafts,
  deleteDraft
} from '../src/storage.js';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    }
  };
}

test('buildCookieString serializes encoded value with path and expiration', () => {
  const cookie = buildCookieString('acelab_openai_api_key', 'sk-test/value', 30);

  assert.match(cookie, /^acelab_openai_api_key=sk-test%2Fvalue;/);
  assert.match(cookie, /path=\//);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /expires=/);
});

test('readCookieValue decodes a named cookie from a cookie header', () => {
  const value = readCookieValue('theme=light; acelab_openai_api_key=sk-test%2Fvalue; other=1', 'acelab_openai_api_key');

  assert.equal(value, 'sk-test/value');
});

test('settings round trip through storage with defaults', () => {
  const store = memoryStorage();
  const defaults = loadSettings(store);

  assert.equal(defaults.provider, 'gemini');
  assert.equal(defaults.openaiModel, 'gpt-5.5');

  saveSettings(store, { provider: 'openai', openaiModel: 'gpt-5.5', geminiModel: 'gemini-2.5-flash' });

  assert.deepEqual(loadSettings(store), {
    provider: 'openai',
    openaiModel: 'gpt-5.5',
    geminiModel: 'gemini-2.5-flash'
  });
});

test('drafts are newest first and capped at 12 entries', () => {
  const store = memoryStorage();

  for (let index = 0; index < 15; index += 1) {
    saveDraft(store, {
      id: `draft-${index}`,
      title: `Title ${index}`,
      copy: `Copy ${index}`,
      createdAt: `2026-06-19T00:${String(index).padStart(2, '0')}:00.000Z`
    });
  }

  const drafts = loadDrafts(store);
  assert.equal(drafts.length, 12);
  assert.equal(drafts[0].id, 'draft-14');
  assert.equal(drafts.at(-1).id, 'draft-3');
});

test('deleteDraft removes the matching draft only', () => {
  const store = memoryStorage();
  saveDraft(store, { id: 'a', title: 'A', copy: 'A', createdAt: '2026-06-19T00:00:00.000Z' });
  saveDraft(store, { id: 'b', title: 'B', copy: 'B', createdAt: '2026-06-19T00:01:00.000Z' });

  deleteDraft(store, 'a');

  assert.deepEqual(loadDrafts(store).map((draft) => draft.id), ['b']);
});
