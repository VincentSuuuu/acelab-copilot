const SETTINGS_KEY = 'acelab_v2_settings';
const DRAFTS_KEY = 'acelab_v2_drafts';
const MAX_DRAFTS = 12;

export const DEFAULT_SETTINGS = {
  provider: 'gemini',
  geminiModel: 'gemini-2.5-flash',
  openaiModel: 'gpt-5.5'
};

export function buildCookieString(name, value, days = 180) {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  const secure = typeof window !== 'undefined' && window.location?.protocol === 'https:' ? '; Secure' : '';
  return `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${secure}`;
}

export function readCookieValue(cookieHeader, name) {
  const encodedName = `${encodeURIComponent(name)}=`;
  const parts = String(cookieHeader || '').split(';').map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(encodedName));
  if (!match) return '';
  return decodeURIComponent(match.slice(encodedName.length));
}

export function setCookieValue(name, value, days = 180, doc = document) {
  doc.cookie = buildCookieString(name, value, days);
}

export function getCookieValue(name, doc = document) {
  return readCookieValue(doc.cookie, name);
}

export function deleteCookieValue(name, doc = document) {
  doc.cookie = `${encodeURIComponent(name)}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

export function loadSettings(storage = localStorage) {
  const raw = storage.getItem(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(storage = localStorage, settings) {
  const next = { ...loadSettings(storage), ...settings };
  storage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export function loadDrafts(storage = localStorage) {
  const raw = storage.getItem(DRAFTS_KEY);
  if (!raw) return [];
  try {
    const drafts = JSON.parse(raw);
    if (!Array.isArray(drafts)) return [];
    return drafts;
  } catch {
    return [];
  }
}

export function saveDraft(storage = localStorage, draft) {
  const drafts = loadDrafts(storage).filter((item) => item.id !== draft.id);
  const next = [draft, ...drafts]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, MAX_DRAFTS);
  storage.setItem(DRAFTS_KEY, JSON.stringify(next));
  return next;
}

export function deleteDraft(storage = localStorage, draftId) {
  const next = loadDrafts(storage).filter((draft) => draft.id !== draftId);
  storage.setItem(DRAFTS_KEY, JSON.stringify(next));
  return next;
}
