export const COMPLIANCE_RULES = {
  absolute: [
    ['全网首发', '这组新片'],
    ['顶级', '高质感'],
    ['天花板', '很出彩'],
    ['唯一', '少见'],
    ['首家', '这一次'],
    ['独家', '专属感'],
    ['绝版', '很特别'],
    ['史无前例', '难得'],
    ['绝无仅有', '很少见'],
    ['第一', '靠前'],
    ['最强', '很有力量'],
    ['最高级', '很高级'],
    ['最好', '很适合'],
    ['最美', '很美'],
    ['最便宜', '更轻松'],
    ['最划算', '更合适'],
    ['绝对', '很确定'],
    ['百分之百', '尽量'],
    ['100%', '尽量'],
    ['极品', '很特别'],
    ['巅峰', '高光']
  ],
  contact: [
    ['加微信', '留言'],
    ['加vx', '留言'],
    ['威信', '留言'],
    ['薇信', '留言'],
    ['私聊我', '评论区告诉我'],
    ['加V', '留言'],
    ['支付宝', '后续沟通'],
    ['转账', '后续确认'],
    ['汇款', '后续确认']
  ],
  risk: [
    ['很美', '很动人'],
    ['爆款', '更容易被喜欢'],
    ['高级感', '清透质感'],
    ['氛围感拉满', '氛围很足']
  ],
  platform: [
    ['引流', '互动'],
    ['限时优惠', '近期安排'],
    ['下单', '预约沟通']
  ]
};

const GROUP_SEVERITY = {
  absolute: 'block',
  contact: 'block',
  risk: 'warn',
  platform: 'warn'
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function scanCompliance(text) {
  const source = String(text ?? '');
  const hits = [];
  for (const [group, entries] of Object.entries(COMPLIANCE_RULES)) {
    for (const [word, suggestion] of entries) {
      if (source.includes(word)) {
        hits.push({ group, word, suggestion, severity: GROUP_SEVERITY[group] });
      }
    }
  }
  return hits;
}

export function isBlocked(hits) {
  return hits.some((hit) => hit.group === 'absolute' || hit.group === 'contact');
}

export function highlightText(text, hits) {
  const words = [...new Set(hits.map((hit) => hit.word))]
    .sort((a, b) => b.length - a.length);
  const source = String(text ?? '');
  if (words.length === 0) return escapeHtml(source);

  const groupByWord = new Map(hits.map((hit) => [hit.word, hit.group]));
  const regex = new RegExp(words.map(escapeRegExp).join('|'), 'g');
  let output = '';
  let lastIndex = 0;

  for (const match of source.matchAll(regex)) {
    output += escapeHtml(source.slice(lastIndex, match.index));
    const word = match[0];
    output += `<mark class="risk-word risk-${groupByWord.get(word)}">${escapeHtml(word)}</mark>`;
    lastIndex = match.index + word.length;
  }

  output += escapeHtml(source.slice(lastIndex));
  return output;
}

export function buildCleanInstruction(hits) {
  if (!hits.length) return '请保持当前文案自然、合规、精简。';
  const lines = hits.map((hit) => `- ${hit.word}：建议替换为「${hit.suggestion}」`);
  return `请删除或替换以下风险表达，保持文案温柔自然，不要解释修改过程：\n${lines.join('\n')}`;
}
