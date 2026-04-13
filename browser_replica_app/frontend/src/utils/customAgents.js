const STORAGE_KEY = 'curio_custom_agents_v1';

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

export function getCustomAgents() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const data = safeParse(raw, []);
  return Array.isArray(data) ? data : [];
}

export function saveCustomAgents(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function createCustomAgent(prompt) {
  const trimmed = (prompt || '').trim();
  if (!trimmed) return null;

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const title = buildTitleFromPrompt(trimmed);
  const item = {
    id,
    title,
    prompt: trimmed,
    createdAt: new Date().toISOString(),
  };

  const current = getCustomAgents();
  const next = [item, ...current];
  saveCustomAgents(next);
  return item;
}

export function getCustomAgentById(agentId) {
  return getCustomAgents().find((x) => x.id === agentId) || null;
}

export function deleteCustomAgentById(agentId) {
  const next = getCustomAgents().filter((x) => x.id !== agentId);
  saveCustomAgents(next);
}

function buildTitleFromPrompt(prompt) {
  const words = prompt
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 7);

  if (!words.length) return 'Custom Agent';
  const title = words.join(' ');
  return title.length > 48 ? `${title.slice(0, 45)}...` : title;
}

export function extractKeywords(prompt) {
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'from', 'about', 'that', 'this', 'into', 'like', 'want', 'news',
    'based', 'research', 'related', 'latest', 'update', 'updates', 'over', 'under', 'between', 'all',
    'top', 'you', 'your', 'are', 'was', 'were', 'have', 'has', 'had', 'will', 'shall', 'would',
    'can', 'could', 'should', 'get', 'give', 'take', 'make', 'more', 'less', 'very', 'just',
  ]);

  return (prompt || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .filter((w) => !stopWords.has(w))
    .slice(0, 20);
}

export function scoreArticleByPrompt(article, keywords) {
  const text = `${article?.title || ''} ${article?.summary || ''} ${article?.content || ''}`.toLowerCase();
  if (!text || !keywords.length) return 0;

  let score = 0;
  keywords.forEach((k) => {
    if (text.includes(k)) score += 1;
  });

  return score;
}
