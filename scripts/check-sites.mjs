import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sites, getSites, validateSites, resolveSiteLink } from '../src/lib/sites.mjs';

const sample = sites[0];
// Given a non-public record, publishing lists must not expose it, even if featured.
const draft = { ...sample, id: 'hidden-example', url: 'https://draft.example/', name: 'PRIVATE DRAFT', status: 'draft', featured: true };
const archived = { ...sample, id: 'old-example', url: 'https://archive.example/', status: 'archived', featured: true };
assert.equal(getSites({}, [draft]).length, 0, 'Given草稿，When生成目录，Then不公开');
assert.equal(getSites({ featured: true }, [draft, archived]).length, 0, 'Given草稿或归档，When生成精选，Then不推荐');
assert.equal(getSites({}, [archived])[0].status, 'archived');
assert.equal(getSites({ category: 'tools' }, [sample]).length, 0, 'Given空分类，Then返回空列表');
assert.throws(() => validateSites([sample, { ...sample, url: 'https://other.example/' }]), /ID无效或重复/);
assert.throws(() => validateSites([sample, { ...sample, id: 'duplicate-address', url: sample.url.replace(/\/$/, '') }]), /地址重复/);
for (const url of ['javascript:alert(1)', '//unsafe.example/', 'https://user:pass@example.com/', 'https://example.com/#hidden']) {
  assert.throws(() => validateSites([{ ...sample, url }]), /地址|HTTPS/);
}
const entry = (id, url) => ({ ...sample, id, url, cover: null, coverAlt: '', featured: false });
for (const [url, external, href] of [
  ['/reading/', false, '/reading/'],
  ['/works/dingying-fix', false, '/works/dingying-fix'],
  ['https://beyondmotion.net/works/', false, '/works/'],
  ['https://BeyondMotion.net/about/', false, '/about/'],
  ['https://beyondmotion.net:443/sites/', false, '/sites/'],
  ['https://beyondmotion.net/notes/?kind=piece', false, '/notes/?kind=piece'],
  ['https://beyondmotion.net', false, '/'],
  ['https://music.beyondmotion.net/', true, 'https://music.beyondmotion.net/'],
  ['https://wedding.beyondmotion.net/', true, 'https://wedding.beyondmotion.net/'],
  ['https://zine-1986318.pages.dev/', true, 'https://zine-1986318.pages.dev/'],
  ['https://beyond-motion.pages.dev/reading/', true, 'https://beyond-motion.pages.dev/reading/'],
  ['https://www.beyondmotion.net/about/', true, 'https://www.beyondmotion.net/about/'],
  ['https://example.com/outside/', true, 'https://example.com/outside/'],
]) {
  const link = resolveSiteLink(url);
  assert.equal(link.external, external, url);
  assert.equal(link.href, href, url);
}
assert.doesNotThrow(() => validateSites([entry('internal-path', '/reading/')]));
assert.doesNotThrow(() => validateSites([entry('same-origin', 'https://beyondmotion.net/reading/')]));
assert.doesNotThrow(() => validateSites([entry('independent-site', 'https://music.beyondmotion.net/')]));
assert.throws(() => validateSites([
  entry('internal-path', '/reading/'),
  entry('same-origin', 'https://beyondmotion.net/reading'),
]), /地址重复/);
assert.doesNotThrow(() => validateSites([{ ...sample, cover: null, coverAlt: '' }]));
for (const site of getSites()) {
  if (site.cover) assert(fs.existsSync(new URL(`../public${site.cover}`, import.meta.url)), `封面不存在：${site.id}`);
}

const directory = fs.readFileSync(new URL('../dist/sites/index.html', import.meta.url), 'utf8');
function assertCardLink(html, site) {
  const at = html.indexOf(`data-site-id="${site.id}"`);
  assert(at >= 0, `缺少卡片：${site.id}`);
  const end = html.indexOf('</article>', at);
  const slice = html.slice(at, end === -1 ? at + 2000 : end);
  const link = resolveSiteLink(site.url);
  const href = link.href.replaceAll('&', '&amp;');
  assert(slice.includes(`href="${href}"`), `${site.id} 链接未按站内规则输出`);
  if (link.external) {
    assert(slice.includes('target="_blank"'), `${site.id} 外站应新窗口打开`);
    assert(slice.includes('rel="noopener noreferrer"'), `${site.id} 外站缺少 rel`);
    assert(slice.includes('（在新窗口打开）'), `${site.id} 外站缺少新窗口提示`);
    assert(slice.includes('进入小站 ↗'), `${site.id} 外站文案有误`);
  } else {
    assert(!slice.includes('target='), `${site.id} 站内链接不应新窗口打开`);
    assert(!slice.includes('（在新窗口打开）'), `${site.id} 站内链接不应提示新窗口`);
    assert(slice.includes('打开页面 →'), `${site.id} 站内文案有误`);
  }
}
for (const site of getSites()) assertCardLink(directory, site);
for (const site of sites.filter(site => site.status === 'draft')) {
  assert(!directory.includes(`data-site-id="${site.id}"`), `目录泄露草稿：${site.id}`);
}
const readPage = route => fs.readFileSync(new URL(`../dist/${route ? `${route}/` : ''}index.html`, import.meta.url), 'utf8');
const cardIds = html => [...html.matchAll(/data-site-id="([^"]+)"/g)].map(match => match[1]);
assert.deepEqual(cardIds(readPage('')), getSites({ featured: true }).slice(0, 3).map(site => site.id), '首页精选须与清单一致');
for (const [category, route] of [['creative', 'works'], ['reading', 'reading'], ['tools', 'tools']]) {
  const html = readPage(route);
  assert.deepEqual(cardIds(html), getSites({ category }).map(site => site.id), `${route}须与目录同源`);
  for (const site of getSites({ category })) assertCardLink(html, site);
}
for (const site of getSites({ featured: true }).slice(0, 3)) assertCardLink(readPage(''), site);
for (const [route, label] of [['works','创作'], ['works/dingying-fix','创作'], ['music','创作'], ['notes','阅读'], ['reading','阅读'], ['studio','工具'], ['tools','工具'], ['sites','全部小站']]) {
  const html = readPage(route);
  assert(new RegExp(`<a[^>]+aria-current="page"[^>]*>${label}</a>`).test(html), `栏目高亮有误：${route}`);
}
const sitemap = fs.readFileSync(new URL('../dist/sitemap.xml', import.meta.url), 'utf8');
for (const route of ['reading', 'tools', 'sites']) assert(sitemap.includes(`https://beyondmotion.net/${route}</loc>`), `sitemap缺少${route}`);
console.log(`Site catalogue: ${getSites().length} entries, status/URL/cover checks passed.`);
