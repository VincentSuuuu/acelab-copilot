# Ace Lab Max v2 Productized Workbench Design

Date: 2026-06-19
Branch: v2-productized-workbench
Scope: upgrade the existing static Ace Lab Max page into a more polished, reliable, personal content workbench while keeping GitHub Pages deployment simple.

## 1. Goal

Ace Lab Max v2 should remain a lightweight personal tool for Laura, but feel less like a generic AI demo and more like Ace Lab's own content studio. The main job is still fast conversion from client photos to Xiaohongshu-ready ideas, titles, and copy.

The upgrade will focus on three outcomes:

- Better brand fit: white, bright, soft, refined, warm, and photo-first.
- Better daily workflow: keep useful drafts, compare versions, recover from mistakes, and reuse preferred settings.
- Better model reliability: support Gemini and OpenAI models through one provider layer, with Laura choosing the engine she prefers.

## 2. Constraints

- Keep the app deployable as static files on GitHub Pages.
- Do not introduce a build system unless the implementation becomes too hard to maintain without one.
- Preserve the current 1-6 image upload flow and browser-side image compression.
- Preserve personal-only API key behavior. This version may store Gemini and OpenAI API keys in the browser because the user confirmed the tool is for Laura's own use only.
- Show a clear personal-device warning near key inputs: keys stay in this browser and should not be used on shared devices.
- Do not route OpenAI through a backend proxy in v2 unless the user later asks for team/shared deployment.

## 3. Product Direction

The current one-page workflow is correct, so v2 should not replace it with a complex dashboard. The app should become a three-step creative desk with persistent side context:

1. Photo board and context setup.
2. Idea exploration and drill-down.
3. Title and copy drafting with compliance and version controls.

The signature interaction should be a soft photo-studio workbench: photos remain visible, the selected theme is pinned, and generated content feels like collected studio notes rather than disposable AI output.

## 4. Visual Design

### Tone

Primary tone: refined personal studio, soft editorial, white-bright-transparent.

### Palette

- Base: warm white, pearl white, very light gray.
- Accent: muted rose, soft champagne, warm slate.
- Risk states: muted red and amber, not aggressive unless copy is blocked.
- Success states: soft emerald.

### Layout

- Left panel: photo contact sheet and context chips.
- Right panel: current workflow stage.
- Top bar: product identity, model status, settings.
- Mobile: single-column flow with sticky bottom action when useful.

### UI Details

- Replace heavy black CTAs with softer primary buttons, preserving contrast.
- Use photo-card previews with subtle borders and hover actions.
- Use quieter section dividers instead of many nested cards.
- Keep microcopy short and operational. Avoid tutorial-like text once the flow is clear.

## 5. Model Provider Design

### Provider Selector

Settings modal becomes an Engine Center with:

- Provider: Gemini or OpenAI.
- API key input for selected provider.
- Model dropdown.
- Default model preference.
- Short model descriptions focused on Laura's decision: fast, balanced, detailed.

### Gemini Defaults

- Recommended fast model: Gemini Flash family.
- Keep the current multimodal request shape, but centralize the model ID in configuration.
- Validate that the configured Gemini model receives image input.

### OpenAI Defaults

- Use the OpenAI Responses API directly from the browser with Authorization Bearer key, per user's personal-use decision.
- Recommended options should include one lower-cost model and one higher-quality model.
- OpenAI model calls must support text + image input and text or JSON output.
- Store OpenAI key separately from Gemini key.

### Storage

Use local browser storage for provider settings. Cookie storage is acceptable if specifically preferred, but localStorage is simpler for a static single-page app. The implementation should hide keys after saving and provide clear delete/reset controls.

## 6. Unified AI Interface

Create one internal interface:

```js
callAI({ provider, model, prompt, systemInstruction, images, expectJson })
```

Provider modules convert this request into provider-specific payloads:

- `providers/gemini.js`
- `providers/openai.js`

Both return either plain text or parsed JSON. The workflow code should not know provider-specific request details.

## 7. Workflow Enhancements

### Idea Stage

- Keep current 5-6 idea output.
- Keep drill-down and breadcrumb behavior.
- Add a small save action for good idea paths.
- Keep "change batch" behavior, but avoid discarding saved paths.

### Title Stage

- Keep 6-8 titles.
- Add lightweight labels: emotional, visual, curiosity, gentle conversion.
- Keep blocking risky titles.
- Add title length display when useful.

### Copy Stage

- Keep under-150-word target.
- Add version history for each generated/refined copy.
- Add compare/restore for previous copy versions.
- Add quick refinement chips: softer, shorter, more premium, more like a friend, fewer emoji.

## 8. Compliance Shield

Replace one flat sensitive-word array with grouped rules:

- `absolute`: must block selection/copy.
- `risk`: warn and suggest replacements.
- `platform`: likely Xiaohongshu limitation or traffic risk.
- `contact`: direct off-platform transaction or contact guidance.

The UI should show:

- Which group triggered.
- The specific word.
- Suggested replacements when available.
- A one-click clean action.

The final copy button remains disabled when absolute/contact violations are present.

## 9. Draft Library

Add lightweight local draft storage:

- Save selected photo context, idea path, title, copy, provider/model, timestamp.
- Show recent drafts in a compact drawer or panel.
- Allow restore into the current workspace.
- Keep everything local in Laura's browser.

This should be optional and not interrupt the main flow.

## 10. Error Handling

Keep the existing warm error translations, but move them into a reusable error mapper.

Add provider-specific cases:

- Missing key.
- Invalid key.
- Rate limit.
- Model not found or model unavailable.
- CORS/network/browser-blocked request.
- JSON parse failure with one automatic repair attempt for structured outputs.

## 11. Engineering Plan Shape

Keep static deployment but split the code for maintainability:

- `index.html`: shell and root containers.
- `src/app.js`: state and orchestration.
- `src/render.js`: DOM rendering helpers.
- `src/providers/gemini.js`: Gemini API calls.
- `src/providers/openai.js`: OpenAI Responses API calls.
- `src/compliance.js`: grouped compliance rules and highlighting.
- `src/storage.js`: keys, preferences, drafts.
- `src/image.js`: compression and image conversion.

If GitHub Pages static module loading creates compatibility friction, use a simpler multi-script layout without a build step.

## 12. Version Management

- Keep `main` unchanged until v2 is verified.
- Develop on `v2-productized-workbench`.
- Use commits with clear scope: design, structure, provider layer, visual refresh, workflow features, verification fixes.
- After verification, merge the v2 branch into `main` so GitHub Pages updates to v2.
- If tag creation is available later, tag the current main as `v1-stable` before merge. If tag tooling is not available, preserve v1 by branch history and commit references.

## 13. Verification

Manual verification should cover:

- Page loads on GitHub Pages/static local file.
- Mobile and desktop layout.
- Upload 1 image and 6 images.
- Gemini idea/title/copy path.
- OpenAI idea/title/copy path.
- Missing-key and invalid-key errors.
- Compliance block and auto-clean.
- Draft save/restore.
- Copy button disabled for blocked copy and enabled for safe copy.

## 14. Open Questions

- Exact OpenAI model list can be tuned during implementation based on current official model availability.
- Whether to use cookie or localStorage for keys will be finalized in implementation. Current recommendation is localStorage because it matches the existing Gemini key pattern and is simpler for a static app.
- Whether to add an explicit "danger zone" reset all settings button depends on space in the settings modal.

## 15. Approval Status

Approved direction from user:

- Use B plan: static v2 productized workbench.
- Manage work on GitHub and merge to main after upgrade.
- Add OpenAI / ChatGPT model selection.
- Store OpenAI key in the front-end browser for Laura's personal-use workflow, with a key input modal.
