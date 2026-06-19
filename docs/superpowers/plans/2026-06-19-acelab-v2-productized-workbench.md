# Ace Lab Max v2 Productized Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v2 Ace Lab Max static workbench with polished Ace Lab styling, Gemini/OpenAI provider selection, OpenAI `gpt-5.5`, browser-cookie OpenAI key storage, grouped compliance, copy versions, and local drafts.

**Architecture:** Keep GitHub Pages static deployment. Replace the single large `index.html` implementation with a small shell plus focused ES modules for app state, providers, storage, compliance, image handling, and rendering. Add Node built-in unit tests for pure modules and provider payload builders.

**Tech Stack:** Static HTML, CSS, vanilla ES modules, Tailwind CDN, Lucide CDN, browser fetch APIs, Node `node:test` for tests.

---

## File Structure

- Modify: `index.html` as the static shell and app root.
- Create: `src/styles.css` for Ace Lab v2 visual system.
- Create: `src/storage.js` for cookies, preferences, and local drafts.
- Create: `src/compliance.js` for grouped compliance scanning and highlighting.
- Create: `src/image.js` for browser-side image compression.
- Create: `src/providers/gemini.js` for Gemini payloads and API calls.
- Create: `src/providers/openai.js` for OpenAI Responses payloads and API calls using `gpt-5.5`.
- Create: `src/app.js` for state, workflow orchestration, rendering, and events.
- Create: `tests/storage.test.mjs`, `tests/compliance.test.mjs`, `tests/providers.test.mjs` for unit tests.
- Create: `package.json` with `npm test` using Node built-in test runner.
- Update: `README.md` with v2 usage and key storage notes.

## Task 1: Test Harness and Pure Utilities

**Files:**
- Create: `package.json`
- Create: `src/storage.js`
- Create: `src/compliance.js`
- Test: `tests/storage.test.mjs`
- Test: `tests/compliance.test.mjs`

- [ ] **Step 1: Write failing storage tests**

Create tests that expect cookie serialization, cookie parsing, preference storage with an injectable localStorage object, and draft save/restore limits.

- [ ] **Step 2: Run storage tests and verify failure**

Run: `npm test -- tests/storage.test.mjs`
Expected: FAIL because `src/storage.js` does not exist yet.

- [ ] **Step 3: Implement storage utilities**

Implement `setCookieValue`, `getCookieValue`, `deleteCookieValue`, `loadSettings`, `saveSettings`, `saveDraft`, `loadDrafts`, `deleteDraft`.

- [ ] **Step 4: Run storage tests and verify pass**

Run: `npm test -- tests/storage.test.mjs`
Expected: PASS.

- [ ] **Step 5: Write failing compliance tests**

Create tests that expect grouped hits for absolute/contact/risk/platform words, safe-copy blocking rules, suggestions, and escaped highlighting.

- [ ] **Step 6: Run compliance tests and verify failure**

Run: `npm test -- tests/compliance.test.mjs`
Expected: FAIL because compliance functions are missing.

- [ ] **Step 7: Implement compliance utilities**

Implement grouped rule dictionaries and `scanCompliance`, `isBlocked`, `highlightText`, `buildCleanInstruction`.

- [ ] **Step 8: Run compliance tests and verify pass**

Run: `npm test -- tests/compliance.test.mjs`
Expected: PASS.

## Task 2: Provider Layer

**Files:**
- Create: `src/providers/gemini.js`
- Create: `src/providers/openai.js`
- Test: `tests/providers.test.mjs`

- [ ] **Step 1: Write failing provider tests**

Test that Gemini payloads include system instruction, JSON mode, and inline images. Test that OpenAI payloads use `gpt-5.5`, `responses` input content with `input_text` and `input_image`, and extract output text from response objects.

- [ ] **Step 2: Run provider tests and verify failure**

Run: `npm test -- tests/providers.test.mjs`
Expected: FAIL because provider files do not exist.

- [ ] **Step 3: Implement provider builders and callers**

Implement `buildGeminiPayload`, `callGemini`, `buildOpenAIResponsePayload`, `extractOpenAIText`, `callOpenAI`, and shared JSON parsing helpers.

- [ ] **Step 4: Run provider tests and verify pass**

Run: `npm test -- tests/providers.test.mjs`
Expected: PASS.

## Task 3: Static Shell and Visual System

**Files:**
- Modify: `index.html`
- Create: `src/styles.css`

- [ ] **Step 1: Replace shell with v2 root containers**

Use `index.html` for metadata, CDN scripts, the header, app root, modal root, toast root, and module script import.

- [ ] **Step 2: Add Ace Lab visual CSS**

Implement the white-bright workbench theme, responsive grid, photo board, workflow cards, buttons, modals, risk states, draft drawer, and mobile behavior.

- [ ] **Step 3: Run static syntax check**

Run: `node --check src/app.js` after Task 4 creates it, and inspect page load manually later.

## Task 4: App Workflow

**Files:**
- Create: `src/image.js`
- Create: `src/app.js`

- [ ] **Step 1: Implement image utility**

Implement `compressImageFile(file, maxSize = 800)` returning `{ data, mimeType, previewUrl, name }`.

- [ ] **Step 2: Implement app state and rendering**

Implement upload board, settings modal, provider/model selection, theme chips, step indicator, idea cards, title cards, copy card, copy version history, draft drawer, toasts, and error modal.

- [ ] **Step 3: Implement workflow actions**

Implement idea generation, drill-down, title generation, copy generation, copy refinement, AI clean, save draft, restore draft, delete draft, copy to clipboard, reset analysis.

- [ ] **Step 4: Wire provider calls**

Use Gemini or OpenAI based on saved settings. OpenAI defaults to `gpt-5.5` and reads `acelab_openai_api_key` from cookie.

- [ ] **Step 5: Run module syntax checks**

Run: `node --check src/app.js`, `node --check src/image.js`, `node --check src/providers/gemini.js`, `node --check src/providers/openai.js`, `node --check src/storage.js`, `node --check src/compliance.js`.
Expected: all exit 0.

## Task 5: Documentation, Full Verification, and Publish

**Files:**
- Update: `README.md`
- Update: `main` after verification by copying branch files over through GitHub.

- [ ] **Step 1: Update README**

Document GitHub Pages URL, Gemini key source, OpenAI key source, personal browser-cookie storage, and default OpenAI model `gpt-5.5`.

- [ ] **Step 2: Run full tests**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 3: Run static syntax checks**

Run all `node --check` commands from Task 4.
Expected: all pass.

- [ ] **Step 4: Verify page with local static server**

Run: `python -m http.server 4173` and open `http://127.0.0.1:4173/` in browser. Verify visible layout and settings modal.

- [ ] **Step 5: Commit branch files to GitHub**

Use GitHub contents API on `v2-productized-workbench` for all modified and created files.

- [ ] **Step 6: Sync v2 to main**

After branch verification, update `main` with the same files so GitHub Pages serves v2.

## Self-Review

- Spec coverage: visual refresh, provider layer, OpenAI `gpt-5.5`, cookie key storage, grouped compliance, draft library, version history, and version management are covered.
- Placeholder scan: no TODO/TBD placeholders are intended in implementation files.
- Type consistency: provider calls use `{ provider, model, prompt, systemInstruction, images, expectJson }`; image objects use `{ data, mimeType, previewUrl, name }`; compliance hits use `{ group, word, suggestion, severity }`.
