import rawSites from '../data/sites.json' with { type: 'json' };

export const categories = [
  { id: 'creative', name: '创作', description: '影像之外，还有音乐、纸面与不断生长的创作实验。' },
  { id: 'reading', name: '阅读', description: '编译长文与科技资讯，沿着不同的视角继续追问。' },
  { id: 'tools', name: '工具', description: '把想法做成可使用的小产品，从一次具体的需要开始。' },
];

// Run during static build as well as release checks. Nothing fetches a live site.
export function validateSites(records) {
  if (!Array.isArray(records)) throw new Error('站点清单必须是数组');
  const ids = new Set(), urls = new Set();
  for (const site of records) {
    const fail = message => { throw new Error(`站点 ${site?.id ?? '(无ID)'}：${message}`); };
    if (!site || typeof site !== 'object') fail('资料无效');
    if (typeof site.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(site.id) || ids.has(site.id)) fail('ID无效或重复');
    ids.add(site.id);
    for (const key of ['name', 'description']) if (typeof site[key] !== 'string' || !site[key].trim()) fail(`缺少${key}`);
    if (!categories.some(category => category.id === site.category)) fail('未知分类');
    if (!['public', 'draft', 'archived'].includes(site.status)) fail('未知状态');
    if (typeof site.featured !== 'boolean' || !Number.isFinite(site.order)) fail('精选或排序配置无效');
    if (!Array.isArray(site.tags) || !site.tags.every(tag => typeof tag === 'string' && tag.trim())) fail('标签无效');
    if (typeof site.url !== 'string' || !site.url.trim() || /[\s\\]/.test(site.url)) fail('地址无效');
    let address;
    try { address = new URL(site.url, 'https://beyondmotion.net'); } catch { fail('地址无效'); }
    const internal = site.url.startsWith('/') && !site.url.startsWith('//');
    if ((!internal && !site.url.startsWith('https://')) || address.protocol !== 'https:' || address.username || address.password || address.hash) fail('只接受站内路径或HTTPS地址，不含身份信息与片段');
    const normalized = address.href.replace(/\/$/, '');
    if (urls.has(normalized)) fail('地址重复');
    urls.add(normalized);
    if (site.cover !== null && (typeof site.cover !== 'string' || !/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:webp|jpg|jpeg|png|svg)$/.test(site.cover))) fail('封面须为public内的图片路径，缺图填null');
    if (site.cover && (typeof site.coverAlt !== 'string' || !site.coverAlt.trim())) fail('封面缺少文字说明');
  }
  return records;
}

export const sites = validateSites(rawSites);
export function getSites({ category, featured = false } = {}, records = sites) {
  return records.filter(site => site.status !== 'draft' && (!category || site.category === category) && (!featured || (site.featured && site.status === 'public')))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
