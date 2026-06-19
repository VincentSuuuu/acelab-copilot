import { scanCompliance, isBlocked, highlightText, buildCleanInstruction, escapeHtml } from './compliance.js';
import { compressImageFile } from './image.js';
import {
  loadSettings,
  saveSettings,
  loadDrafts,
  saveDraft,
  deleteDraft,
  getCookieValue,
  setCookieValue,
  deleteCookieValue
} from './storage.js';
import { callGemini, DEFAULT_GEMINI_MODEL } from './providers/gemini.js';
import { callOpenAI, DEFAULT_OPENAI_MODEL } from './providers/openai.js';

const OPENAI_COOKIE = 'acelab_openai_api_key';
const GEMINI_COOKIE = 'acelab_gemini_api_key';
const LEGACY_GEMINI_KEY = 'acelab_api_key';

const els = {
  photoPanel: document.getElementById('photo-panel'),
  stagePanel: document.getElementById('stage-panel'),
  modalRoot: document.getElementById('modal-root'),
  toastRoot: document.getElementById('toast-root'),
  enginePill: document.getElementById('engine-pill'),
  settingsButton: document.getElementById('settings-button'),
  draftsButton: document.getElementById('drafts-button')
};

const state = {
  settings: loadSettings(),
  images: [],
  photoContext: '',
  currentStep: 1,
  brainstormHistory: [],
  currentIdeas: [],
  activeIdea: null,
  titles: [],
  selectedTitle: '',
  finalCopy: '',
  complianceHits: [],
  versions: [],
  loading: false,
  modal: null
};

const CONTEXT_TAGS = ['婚纱照', '婚礼跟拍', '宝宝满月宴', '孕妇照', '室内主纱', '草坪婚礼'];

function icon(name, size = 16) {
  return `<i data-lucide="${name}" style="width:${size}px;height:${size}px"></i>`;
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function refreshIcons() {
  window.lucide?.createIcons();
}

function showToast(message) {
  els.toastRoot.innerHTML = `<div class="toast">${icon('info', 15)}<span>${escapeHtml(message)}</span></div>`;
  refreshIcons();
  window.setTimeout(() => {
    els.toastRoot.innerHTML = '';
  }, 2800);
}

function openError(message) {
  state.modal = { type: 'error', message };
  renderModal();
}

function closeModal() {
  state.modal = null;
  renderModal();
}

function getGeminiKey() {
  return getCookieValue(GEMINI_COOKIE) || localStorage.getItem(LEGACY_GEMINI_KEY) || '';
}

function getOpenAIKey() {
  return getCookieValue(OPENAI_COOKIE);
}

function providerLabel() {
  if (state.settings.provider === 'openai') return `OpenAI ${state.settings.openaiModel || DEFAULT_OPENAI_MODEL}`;
  return `Gemini ${state.settings.geminiModel || DEFAULT_GEMINI_MODEL}`;
}

function renderEnginePill() {
  els.enginePill.innerHTML = `${icon(state.settings.provider === 'openai' ? 'bot' : 'sparkles', 15)}<span>${escapeHtml(providerLabel())}</span>`;
}

function renderPhotoPanel() {
  const uploadClass = state.images.length === 0 ? 'upload-tile' : 'upload-tile compact';
  const photos = state.images.map((image, index) => `
    <div class="photo-tile">
      <img src="${image.previewUrl}" alt="${escapeHtml(image.name)}">
      <button class="photo-remove" type="button" data-action="remove-image" data-index="${index}" aria-label="删除照片">${icon('x', 14)}</button>
    </div>
  `).join('');

  const upload = state.images.length < 6 ? `
    <label class="${uploadClass}">
      <input id="file-input" type="file" accept="image/*" multiple>
      <span class="upload-copy">${icon('image-plus', 25)}<span>添加照片</span><small>${state.images.length}/6</small></span>
    </label>
  ` : '';

  els.photoPanel.innerHTML = `
    <div class="panel-heading">
      <div>
        <h2>选片板</h2>
        <span>上传 1-6 张客片，长边自动压缩到 800px</span>
      </div>
      <span class="soft-pill">${state.images.length}/6</span>
    </div>
    <div class="photo-grid">${photos}${upload}</div>
    <div class="context-block">
      <div class="input-row">
        ${icon('tag', 16)}
        <input id="photo-context-input" type="text" value="${escapeHtml(state.photoContext)}" placeholder="设定照片主题，例如 室内主纱">
      </div>
      <div class="chips">
        ${CONTEXT_TAGS.map((tag) => `<button class="chip ${state.photoContext === tag ? 'active' : ''}" type="button" data-action="context-tag" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('')}
      </div>
      ${renderPrimaryPhotoAction()}
    </div>
  `;

  const fileInput = document.getElementById('file-input');
  fileInput?.addEventListener('change', handleImageUpload);
  const contextInput = document.getElementById('photo-context-input');
  contextInput?.addEventListener('input', (event) => {
    state.photoContext = event.target.value;
  });
}

function renderPrimaryPhotoAction() {
  if (state.images.length === 0) {
    return `<button class="primary-button" type="button" disabled>${icon('sparkles', 16)}先添加照片</button>`;
  }
  if (state.currentIdeas.length || state.currentStep > 1 || state.loading) {
    return `<button class="soft-button" type="button" data-action="reset-flow">${icon('rotate-ccw', 16)}更换主题或重新分析</button>`;
  }
  return `<button class="primary-button" type="button" data-action="start-brainstorm">${icon('sparkles', 16)}提取灵感切入点</button>`;
}

function renderSteps() {
  const steps = [
    [1, 'lightbulb', '灵感脑暴'],
    [2, 'type', '敲定标题'],
    [3, 'file-text', '极简文案']
  ];
  return `<div class="steps">${steps.map(([num, name, label]) => {
    const className = state.currentStep === num ? 'step active' : state.currentStep > num ? 'step done' : 'step';
    return `<span class="${className}">${icon(state.currentStep > num ? 'check' : name, 14)}${label}</span>`;
  }).join('')}</div>`;
}

function renderStage() {
  if (state.images.length === 0) {
    els.stagePanel.innerHTML = `${renderSteps()}<div class="empty-state">${icon('camera', 44)}<div><strong>先放进一组 Ace Lab 客片</strong><p>照片、主题和模型会共同决定灵感方向。</p></div></div>`;
    return;
  }

  if (state.loading) {
    els.stagePanel.innerHTML = `${renderSteps()}<div class="loading-state"><div><div class="loader"></div><strong>正在整理灵感</strong><p>${state.settings.provider === 'openai' ? 'OpenAI gpt-5.5' : 'Gemini'} 正在阅读照片和语境。</p></div></div>`;
    return;
  }

  if (state.currentStep === 1) {
    renderIdeasStage();
  } else if (state.currentStep === 2) {
    renderTitlesStage();
  } else {
    renderCopyStage();
  }
}

function renderIdeasStage() {
  if (!state.currentIdeas.length) {
    els.stagePanel.innerHTML = `${renderSteps()}<div class="empty-state">${icon('sparkles', 44)}<div><strong>准备开始灵感脑暴</strong><p>输入主题后点击左侧按钮，系统会给出不同内容切入点。</p></div></div>`;
    return;
  }

  const breadcrumbs = state.brainstormHistory.length ? `
    <div class="breadcrumb">
      <button type="button" data-action="breadcrumb" data-index="-1">核心灵感</button>
      ${state.brainstormHistory.map((item, index) => `${icon('chevron-right', 13)}<button type="button" data-action="breadcrumb" data-index="${index}">${escapeHtml(item.title)}</button>`).join('')}
    </div>
  ` : '';

  els.stagePanel.innerHTML = `
    ${renderSteps()}
    ${breadcrumbs}
    <div class="stage-heading">
      <div>
        <h2>${state.brainstormHistory.length ? '深挖这个方向' : `关于「${escapeHtml(state.photoContext)}」的切入方向`}</h2>
        <span>保留好方向，继续向下钻，直到能直接写成一篇笔记。</span>
      </div>
      <button class="soft-button" type="button" data-action="refresh-ideas">${icon('refresh-cw', 15)}换一批</button>
    </div>
    <div class="idea-grid">
      ${state.currentIdeas.map((idea, index) => `
        <article class="idea-card">
          <h3>${escapeHtml(idea.title)}</h3>
          <p>${escapeHtml(idea.desc)}</p>
          <div class="card-actions">
            <button class="soft-button" type="button" data-action="drill-idea" data-index="${index}">${icon('corner-down-right', 15)}进一步发散</button>
            <button class="ghost-button" type="button" data-action="save-idea" data-index="${index}">${icon('bookmark', 15)}保存方向</button>
            <button class="primary-button" type="button" data-action="select-idea" data-index="${index}">${icon('check', 15)}就选这个</button>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderTitlesStage() {
  const ideaPath = [...state.brainstormHistory, state.activeIdea].filter(Boolean).map((item) => item.title).join(' / ');
  els.stagePanel.innerHTML = `
    ${renderSteps()}
    <div class="summary-strip">
      <small>已选定创作核心</small>
      <strong>${escapeHtml(ideaPath)}</strong>
      <small>主题：${escapeHtml(state.photoContext)} · 引擎：${escapeHtml(providerLabel())}</small>
    </div>
    <div class="stage-heading">
      <div>
        <h2>挑一个小红书标题</h2>
        <span>红色标题会被阻断选择，避免误发风险词。</span>
      </div>
      <button class="soft-button" type="button" data-action="refresh-titles">${icon('refresh-cw', 15)}换一批</button>
    </div>
    <div class="title-list">
      ${state.titles.map((item, index) => {
        const title = typeof item === 'string' ? item : item.title;
        const label = typeof item === 'string' ? '情绪共鸣' : item.label || '情绪共鸣';
        const hits = scanCompliance(title);
        const blocked = isBlocked(hits);
        return `
          <button class="title-card ${blocked ? 'blocked' : ''}" type="button" ${blocked ? 'disabled' : ''} data-action="select-title" data-index="${index}">
            <strong>${String(index + 1).padStart(2, '0')}</strong>
            <span class="title-body">
              <span>${escapeHtml(title)}</span>
              <span class="title-tags"><span>${escapeHtml(label)}</span><span>${title.length} 字</span>${hits.map((hit) => `<span>${escapeHtml(hit.word)}</span>`).join('')}</span>
            </span>
            ${blocked ? icon('shield-alert', 16) : icon('chevron-right', 16)}
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function renderCopyStage() {
  const hasCopy = Boolean(state.finalCopy);
  const blocked = isBlocked(state.complianceHits);
  const safeBanner = !hasCopy ? '' : blocked ? `
    <div class="risk-banner danger">
      <span>${icon('shield-alert', 16)}检测到阻断词：${state.complianceHits.map((hit) => escapeHtml(hit.word)).join('、')}</span>
      <button class="danger-button" type="button" data-action="clean-copy">${icon('sparkles', 15)}让 AI 自动净化</button>
    </div>
  ` : `
    <div class="risk-banner safe"><span>${icon('shield-check', 16)}小红书合规检测通过，可以复制。</span></div>
  `;

  els.stagePanel.innerHTML = `
    ${renderSteps()}
    <div class="summary-strip">
      <small>标题</small>
      <strong>${escapeHtml(state.selectedTitle)}</strong>
      <small>主题：${escapeHtml(state.photoContext)} · 引擎：${escapeHtml(providerLabel())}</small>
    </div>
    ${safeBanner}
    <article class="copy-card">
      <div class="copy-toolbar">
        <div class="copy-meta">
          <strong>小红书文案</strong><br>
          <small>${state.versions.length} 个版本</small>
        </div>
        <div class="top-actions">
          <button class="soft-button" type="button" data-action="regenerate-copy">${icon('refresh-cw', 15)}换一种</button>
          <button class="primary-button" type="button" data-action="copy-final" ${blocked || !hasCopy ? 'disabled' : ''}>${icon('copy', 15)}复制全文</button>
        </div>
      </div>
      <div class="copy-body">${hasCopy ? highlightText(state.finalCopy, state.complianceHits) : '还没有文案。'}</div>
      <div class="copy-footer">
        <textarea class="copy-input" id="feedback-input" placeholder="输入修改意见，如：语气再温柔一点、缩短到两句"></textarea>
        <button class="primary-button" type="button" data-action="refine-copy">${icon('send', 15)}优化</button>
      </div>
    </article>
    <div class="chips" style="margin-top:12px">
      ${['再温柔一点', '缩短到两句', '更像朋友随笔', '减少 emoji', '更有高级感'].map((text) => `<button class="chip" type="button" data-action="quick-refine" data-feedback="${escapeHtml(text)}">${escapeHtml(text)}</button>`).join('')}
      <button class="chip" type="button" data-action="save-draft">${icon('bookmark', 14)}保存草稿</button>
    </div>
    ${renderVersions()}
  `;

  document.getElementById('feedback-input')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      refineCopy();
    }
  });
}

function renderVersions() {
  if (!state.versions.length) return '';
  return `
    <section class="version-panel">
      <div class="panel-heading"><h2>版本记录</h2><span>可随时恢复旧版本</span></div>
      <div class="version-list">
        ${state.versions.map((version, index) => `
          <div class="version-item">
            <span>${escapeHtml(version.label)} · ${new Date(version.createdAt).toLocaleString('zh-CN')}</span>
            <button class="ghost-button" type="button" data-action="restore-version" data-index="${index}">恢复</button>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderModal() {
  if (!state.modal) {
    els.modalRoot.innerHTML = '';
    return;
  }

  if (state.modal.type === 'settings') {
    const geminiKey = getGeminiKey();
    const openaiKey = getOpenAIKey();
    els.modalRoot.innerHTML = `
      <div class="modal-backdrop" role="dialog" aria-modal="true">
        <div class="modal">
          <header>
            <div><h2>引擎配置中心</h2><p class="hint">Laura 私人使用模式：Key 只保存在当前浏览器。</p></div>
            <button class="icon-button" type="button" data-action="close-modal">${icon('x', 16)}</button>
          </header>
          <section class="form-grid">
            <div class="field">
              <label for="provider-select">默认引擎</label>
              <select id="provider-select">
                <option value="gemini" ${state.settings.provider === 'gemini' ? 'selected' : ''}>Gemini Flash - 快速省心</option>
                <option value="openai" ${state.settings.provider === 'openai' ? 'selected' : ''}>OpenAI gpt-5.5 - 更细腻</option>
              </select>
            </div>
            <div class="field">
              <label for="gemini-key-input">Gemini API Key</label>
              <input id="gemini-key-input" type="password" placeholder="${geminiKey ? '已保存，输入新 Key 可覆盖' : 'AIzaSy...'}">
            </div>
            <div class="field">
              <label for="gemini-model-select">Gemini 模型</label>
              <select id="gemini-model-select">
                <option value="gemini-2.5-flash" ${state.settings.geminiModel === 'gemini-2.5-flash' ? 'selected' : ''}>gemini-2.5-flash</option>
                <option value="gemini-3.5-flash" ${state.settings.geminiModel === 'gemini-3.5-flash' ? 'selected' : ''}>gemini-3.5-flash</option>
              </select>
            </div>
            <div class="field">
              <label for="openai-key-input">OpenAI API Key</label>
              <input id="openai-key-input" type="password" placeholder="${openaiKey ? '已保存到 cookie，输入新 Key 可覆盖' : 'sk-...'}">
              <p class="hint">OpenAI 默认使用 gpt-5.5，Key 存入 cookie：${OPENAI_COOKIE}。</p>
            </div>
          </section>
          <footer>
            <button class="danger-button" type="button" data-action="clear-keys">${icon('trash-2', 15)}清除 Key</button>
            <div class="top-actions">
              <button class="ghost-button" type="button" data-action="close-modal">取消</button>
              <button class="primary-button" type="button" data-action="save-settings">${icon('check', 15)}保存</button>
            </div>
          </footer>
        </div>
      </div>
    `;
  } else if (state.modal.type === 'drafts') {
    const drafts = loadDrafts();
    els.modalRoot.innerHTML = `
      <div class="modal-backdrop" role="dialog" aria-modal="true">
        <div class="modal">
          <header>
            <div><h2>本机草稿库</h2><p class="hint">只保存在 Laura 当前浏览器。</p></div>
            <button class="icon-button" type="button" data-action="close-modal">${icon('x', 16)}</button>
          </header>
          <section>
            <div class="draft-list">
              ${drafts.length ? drafts.map((draft) => `
                <article class="draft-card">
                  <h3>${escapeHtml(draft.title || '未命名草稿')}</h3>
                  <p>${escapeHtml((draft.copy || '').slice(0, 90))}${draft.copy?.length > 90 ? '...' : ''}</p>
                  <div class="card-actions">
                    <button class="primary-button" type="button" data-action="restore-draft" data-id="${escapeHtml(draft.id)}">${icon('corner-up-left', 15)}恢复</button>
                    <button class="danger-button" type="button" data-action="delete-draft" data-id="${escapeHtml(draft.id)}">${icon('trash-2', 15)}删除</button>
                  </div>
                </article>
              `).join('') : '<p class="hint">还没有保存草稿。</p>'}
            </div>
          </section>
        </div>
      </div>
    `;
  } else {
    els.modalRoot.innerHTML = `
      <div class="modal-backdrop" role="dialog" aria-modal="true">
        <div class="modal">
          <header><h2>诊断报告</h2><button class="icon-button" type="button" data-action="close-modal">${icon('x', 16)}</button></header>
          <section><p style="white-space:pre-wrap;line-height:1.8">${escapeHtml(state.modal.message)}</p></section>
          <footer><button class="primary-button" type="button" data-action="close-modal">我知道了</button></footer>
        </div>
      </div>
    `;
  }
  refreshIcons();
}

function renderAll() {
  renderEnginePill();
  renderPhotoPanel();
  renderStage();
  renderModal();
  refreshIcons();
}

async function handleImageUpload(event) {
  const files = Array.from(event.target.files || []).slice(0, 6 - state.images.length);
  if (!files.length) return;
  state.loading = true;
  renderStage();
  try {
    for (const file of files) {
      state.images.push(await compressImageFile(file));
    }
    showToast(`已添加 ${files.length} 张照片`);
  } catch {
    openError('照片读取失败，请换一张照片重试。');
  } finally {
    state.loading = false;
    event.target.value = '';
    renderAll();
  }
}

function ensureReady() {
  if (!state.images.length) {
    showToast('请先添加照片');
    return false;
  }
  if (!state.photoContext.trim()) {
    showToast('请先设定照片主题');
    document.getElementById('photo-context-input')?.focus();
    return false;
  }
  if (state.settings.provider === 'openai' && !getOpenAIKey()) {
    state.modal = { type: 'settings' };
    renderModal();
    showToast('请先填写 OpenAI API Key');
    return false;
  }
  if (state.settings.provider === 'gemini' && !getGeminiKey()) {
    state.modal = { type: 'settings' };
    renderModal();
    showToast('请先填写 Gemini API Key');
    return false;
  }
  return true;
}

async function callSelectedAI({ prompt, systemInstruction, expectJson = false }) {
  const request = {
    model: state.settings.provider === 'openai' ? state.settings.openaiModel : state.settings.geminiModel,
    prompt,
    systemInstruction,
    images: state.images,
    expectJson
  };

  try {
    if (state.settings.provider === 'openai') {
      return await callOpenAI({ ...request, apiKey: getOpenAIKey() });
    }
    return await callGemini({ ...request, apiKey: getGeminiKey() });
  } catch (error) {
    throw mapAIError(error);
  }
}

function mapAIError(error) {
  const message = String(error?.message || error);
  if (message.includes('MISSING')) return new Error('请先在右上角配置对应的 API Key。');
  if (message.includes('401') || message.includes('403')) return new Error('API Key 可能无效或没有权限，请检查后重新保存。');
  if (message.includes('429')) return new Error('AI 引擎请求太频繁了，请稍等一分钟再试。');
  if (message.includes('404')) return new Error('当前模型不可用，请换一个模型或稍后再试。');
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) return new Error('浏览器网络请求被拦截。请确认不在微信内置浏览器，或检查网络代理/CORS 限制。');
  return new Error(`AI 请求失败：${message}`);
}

function parseJsonText(text) {
  const cleaned = String(text || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

async function fetchIdeas(targetHistory = state.brainstormHistory) {
  if (!ensureReady()) return;
  state.loading = true;
  state.currentIdeas = [];
  state.currentStep = 1;
  renderAll();

  try {
    const parentIdea = targetHistory.at(-1);
    const prompt = parentIdea ? `基于我提供的【${state.photoContext}】照片，发文大方向路径是：【${targetHistory.map((item) => item.title).join(' -> ')}】。当前思路：${parentIdea.desc}。\n请延伸出 3-5 个更具体、可以直接作为小红书笔记核心立意的细分发散点。必须具体到画面中的动作、微表情、光线细节或情绪状态。\n返回 JSON 数组：[{"title":"细分角度标题","desc":"具体展开描写什么细节或情绪"}]` : `请深度分析我提供的这组照片。\n主题/场景：“${state.photoContext}”。\nAce Lab 品牌核心：白亮透的画面质感、细腻柔美的人物刻画、自然松弛有温度的情绪捕捉。\n请结合小红书受众偏好，给出 5-6 个截然不同的发文头脑风暴切入点，涵盖情绪共鸣、人物魅力、质感审美、幕后故事。\n返回 JSON 数组：[{"title":"切入点标题","desc":"为什么这个角度能打动受众，以及具体写画面的什么细节"}]`;
    const text = await callSelectedAI({
      prompt,
      systemInstruction: '你是高级摄影工作室的小红书内容策划专家，表达温柔、具体、克制。',
      expectJson: true
    });
    state.brainstormHistory = targetHistory;
    state.currentIdeas = parseJsonText(text).slice(0, 6);
  } catch (error) {
    openError(error.message);
  } finally {
    state.loading = false;
    renderAll();
  }
}

async function generateTitles(idea) {
  state.activeIdea = idea;
  state.currentStep = 2;
  state.loading = true;
  state.titles = [];
  renderAll();

  try {
    const fullIdea = [...state.brainstormHistory, idea].map((item) => item.title).join(' -> ');
    const text = await callSelectedAI({
      prompt: `结合照片（主题：【${state.photoContext}】），我要写一篇小红书。核心切入点：【${fullIdea}】。具体思路：${idea.desc}。\n请生成 6-8 个有网感但合规的短标题。字数必须在 20 字以内，严禁广告法极限词和导流词。\n返回 JSON 数组：[{"title":"标题","label":"情绪共鸣/画面悬念/温柔转化/质感审美"}]`,
      systemInstruction: '你是小红书标题编辑，擅长摄影行业、女性受众、温柔而不营销的表达。',
      expectJson: true
    });
    const parsed = parseJsonText(text);
    state.titles = parsed.map((item) => typeof item === 'string' ? { title: item, label: '情绪共鸣' } : item).slice(0, 8);
  } catch (error) {
    state.currentStep = 1;
    openError(error.message);
  } finally {
    state.loading = false;
    renderAll();
  }
}

function pushVersion(label, copy) {
  if (!copy) return;
  state.versions = [{ label, copy, createdAt: new Date().toISOString() }, ...state.versions].slice(0, 8);
}

async function generateCopy(title = state.selectedTitle, label = '生成') {
  state.selectedTitle = title;
  state.currentStep = 3;
  state.loading = true;
  renderAll();

  try {
    const fullIdea = [...state.brainstormHistory, state.activeIdea].filter(Boolean).map((item) => item.title).join(' -> ');
    const text = await callSelectedAI({
      prompt: `结合照片，为 Ace Lab 摄影工作室写一篇关于【${state.photoContext}】的小红书正文。\n切入点：【${fullIdea}】。标题：【${title}】。\n要求：不超过 150 字；像朋友圈随笔一样自然；每句话独立成行；温柔、细腻、有呼吸感；文末加 5-8 个精准 Hashtag，必须包含 #AceLab定制 和 #AceLab摄影。\n严禁广告法极限词和违规导流词。直接输出文案，不要解释。`,
      systemInstruction: '你是 Ace Lab 主理人 Laura，也是一位克制、细腻、有高级审美的小红书内容主编。'
    });
    if (state.finalCopy) pushVersion(label, state.finalCopy);
    state.finalCopy = text.trim();
    state.complianceHits = scanCompliance(state.finalCopy);
    pushVersion('当前版本', state.finalCopy);
  } catch (error) {
    state.currentStep = 2;
    openError(error.message);
  } finally {
    state.loading = false;
    renderAll();
  }
}

async function refineCopy(feedback = null) {
  const input = document.getElementById('feedback-input');
  const request = feedback || input?.value.trim();
  if (!request) return;
  state.loading = true;
  renderAll();

  try {
    const text = await callSelectedAI({
      prompt: `当前文案：\n${state.finalCopy}\n\nLaura 的修改意见：${request}\n\n请按意见优化。保持 150 字以内、自然、温柔、有留白。严禁广告法极限词和导流词。直接输出新文案。`,
      systemInstruction: '你是 Ace Lab 的小红书文案编辑，擅长保留品牌温度并压低营销感。'
    });
    pushVersion('修改前', state.finalCopy);
    state.finalCopy = text.trim();
    state.complianceHits = scanCompliance(state.finalCopy);
    pushVersion(`按「${request}」优化`, state.finalCopy);
  } catch (error) {
    openError(error.message);
  } finally {
    state.loading = false;
    renderAll();
  }
}

function saveCurrentDraft() {
  if (!state.finalCopy) {
    showToast('还没有可保存的文案');
    return;
  }
  saveDraft(localStorage, {
    id: createId('draft'),
    provider: state.settings.provider,
    model: providerLabel(),
    photoContext: state.photoContext,
    ideaPath: [...state.brainstormHistory, state.activeIdea].filter(Boolean),
    title: state.selectedTitle,
    copy: state.finalCopy,
    createdAt: new Date().toISOString()
  });
  showToast('草稿已保存到本机');
}

function restoreDraft(id) {
  const draft = loadDrafts().find((item) => item.id === id);
  if (!draft) return;
  state.photoContext = draft.photoContext || '';
  state.brainstormHistory = draft.ideaPath?.slice(0, -1) || [];
  state.activeIdea = draft.ideaPath?.at(-1) || null;
  state.selectedTitle = draft.title || '';
  state.finalCopy = draft.copy || '';
  state.complianceHits = scanCompliance(state.finalCopy);
  state.versions = [{ label: '恢复草稿', copy: state.finalCopy, createdAt: new Date().toISOString() }];
  state.currentStep = 3;
  closeModal();
  renderAll();
  showToast('草稿已恢复');
}

async function copyFinal() {
  if (isBlocked(state.complianceHits)) return;
  try {
    await navigator.clipboard.writeText(state.finalCopy);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = state.finalCopy;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
  showToast('已复制全文');
}

function resetFlow() {
  state.currentStep = 1;
  state.brainstormHistory = [];
  state.currentIdeas = [];
  state.activeIdea = null;
  state.titles = [];
  state.selectedTitle = '';
  state.finalCopy = '';
  state.complianceHits = [];
  state.versions = [];
  renderAll();
}

function saveSettingsFromModal() {
  const provider = document.getElementById('provider-select')?.value || 'gemini';
  const geminiModel = document.getElementById('gemini-model-select')?.value || DEFAULT_GEMINI_MODEL;
  const geminiKey = document.getElementById('gemini-key-input')?.value.trim();
  const openaiKey = document.getElementById('openai-key-input')?.value.trim();

  if (geminiKey) {
    setCookieValue(GEMINI_COOKIE, geminiKey, 180);
    localStorage.setItem(LEGACY_GEMINI_KEY, geminiKey);
  }
  if (openaiKey) {
    setCookieValue(OPENAI_COOKIE, openaiKey, 180);
  }

  state.settings = saveSettings(localStorage, {
    provider,
    geminiModel,
    openaiModel: DEFAULT_OPENAI_MODEL
  });
  closeModal();
  renderAll();
  showToast('引擎配置已保存');
}

function handleClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  const index = Number(target.dataset.index);

  if (action === 'context-tag') {
    state.photoContext = target.dataset.tag;
    renderAll();
  } else if (action === 'remove-image') {
    state.images.splice(index, 1);
    if (!state.images.length) resetFlow();
    renderAll();
  } else if (action === 'start-brainstorm') {
    fetchIdeas([]);
  } else if (action === 'refresh-ideas') {
    fetchIdeas(state.brainstormHistory);
  } else if (action === 'drill-idea') {
    fetchIdeas([...state.brainstormHistory, state.currentIdeas[index]]);
  } else if (action === 'select-idea') {
    generateTitles(state.currentIdeas[index]);
  } else if (action === 'save-idea') {
    const idea = state.currentIdeas[index];
    saveDraft(localStorage, {
      id: createId('idea'),
      title: idea.title,
      copy: idea.desc,
      photoContext: state.photoContext,
      ideaPath: [...state.brainstormHistory, idea],
      createdAt: new Date().toISOString()
    });
    showToast('方向已保存');
  } else if (action === 'breadcrumb') {
    fetchIdeas(index < 0 ? [] : state.brainstormHistory.slice(0, index + 1));
  } else if (action === 'refresh-titles') {
    generateTitles(state.activeIdea);
  } else if (action === 'select-title') {
    const item = state.titles[index];
    generateCopy(typeof item === 'string' ? item : item.title);
  } else if (action === 'regenerate-copy') {
    generateCopy(state.selectedTitle, '换写前');
  } else if (action === 'refine-copy') {
    refineCopy();
  } else if (action === 'quick-refine') {
    refineCopy(target.dataset.feedback);
  } else if (action === 'clean-copy') {
    refineCopy(buildCleanInstruction(state.complianceHits));
  } else if (action === 'copy-final') {
    copyFinal();
  } else if (action === 'save-draft') {
    saveCurrentDraft();
  } else if (action === 'restore-version') {
    const version = state.versions[index];
    if (version) {
      state.finalCopy = version.copy;
      state.complianceHits = scanCompliance(state.finalCopy);
      renderAll();
    }
  } else if (action === 'reset-flow') {
    resetFlow();
  } else if (action === 'close-modal') {
    closeModal();
  } else if (action === 'save-settings') {
    saveSettingsFromModal();
  } else if (action === 'clear-keys') {
    deleteCookieValue(OPENAI_COOKIE);
    deleteCookieValue(GEMINI_COOKIE);
    localStorage.removeItem(LEGACY_GEMINI_KEY);
    showToast('Key 已清除');
    renderModal();
  } else if (action === 'restore-draft') {
    restoreDraft(target.dataset.id);
  } else if (action === 'delete-draft') {
    deleteDraft(localStorage, target.dataset.id);
    renderModal();
  }
}

els.settingsButton.addEventListener('click', () => {
  state.modal = { type: 'settings' };
  renderModal();
});

els.draftsButton.addEventListener('click', () => {
  state.modal = { type: 'drafts' };
  renderModal();
});

document.addEventListener('click', handleClick);
renderAll();
