import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import { sites, getSites, validateSites, resolveSiteLink, allowedExternalHosts, isAllowedSiteHost } from '../src/lib/sites.mjs';

// Address, status, and dedupe rules. They do not read dist.
export function assertSiteLinkRules() {
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
  const entry = (id, url) => ({ ...sample, id, url, cover: null, coverSmall: null, coverAlt: '', featured: false });
  assert.throws(() => validateSites([entry('tomato-music', 'https://music.beyondmotion.net/')]), /明确排除/);
  assert.throws(() => validateSites([{ ...sample, name: '番茄音乐报' }]), /明确排除/);
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
    ['https://www.beyondmotion.net/about/', true, 'https://www.beyondmotion.net/about/'],
    ['https://music.1986318.xyz/', true, 'https://music.1986318.xyz/'],
    ['https://style.1986318.xyz/', true, 'https://style.1986318.xyz/'],
    ['https://horizon.1986318.xyz/', true, 'https://horizon.1986318.xyz/'],
    ['https://aihot.1986318.xyz/', true, 'https://aihot.1986318.xyz/'],
  ]) {
    const link = resolveSiteLink(url);
    assert.equal(link.external, external, url);
    assert.equal(link.href, href, url);
    if (external) assert.equal(link.host, new URL(url).hostname, url);
  }
  for (const url of [
    'https://tomato.1986318.xyz/',
    'https://example.com/outside/',
    'https://beyond-motion.pages.dev/reading/',
    'https://evil.pages.dev/',
    'https://evil.1986318.xyz/',
    'https://notbeyondmotion.net/',
    'https://beyondmotion.net.evil.example/',
    'https://zine-1986318.pages.dev.evil.example/a',
  ]) {
    assert.equal(isAllowedSiteHost(new URL(url).hostname), false, url);
    assert.throws(() => resolveSiteLink(url), /白名单/, url);
    assert.throws(() => validateSites([entry('blocked-host', url)]), /白名单/, url);
  }
  for (const host of allowedExternalHosts) assert.doesNotThrow(() => resolveSiteLink(`https://${host}/`), host);
  assert.equal(
    resolveSiteLink('https://music.beyondmotion.net//album//').normalized,
    resolveSiteLink('https://music.beyondmotion.net/album').normalized,
    '重复斜杠在去重前折叠',
  );
  assert.equal(
    resolveSiteLink('https://every.beyondmotion.net/posts/').normalized,
    resolveSiteLink('https://every.beyondmotion.net/posts').normalized,
    '尾斜杠在去重前去掉',
  );
  assert.equal(
    resolveSiteLink('https://music.beyondmotion.net//').normalized,
    'https://music.beyondmotion.net',
  );
  assert.equal(
    resolveSiteLink('/reading//notes/').normalized,
    resolveSiteLink('https://beyondmotion.net/reading/notes').normalized,
  );
  assert.equal(
    resolveSiteLink('https://beyondmotion.net/notes//?kind=piece').normalized,
    resolveSiteLink('/notes?kind=piece').normalized,
  );
  assert.throws(() => validateSites([
    entry('slash-a', 'https://music.beyondmotion.net/album//'),
    entry('slash-b', 'https://music.beyondmotion.net/album'),
  ]), /地址重复/);
  assert.throws(() => validateSites([
    entry('trail-a', 'https://wedding.beyondmotion.net/'),
    entry('trail-b', 'https://wedding.beyondmotion.net'),
  ]), /地址重复/);
  assert.throws(() => validateSites([
    entry('path-a', '/works//dingying-fix/'),
    entry('path-b', 'https://beyondmotion.net/works/dingying-fix'),
  ]), /地址重复/);
  assert.doesNotThrow(() => validateSites([
    entry('kept-a', 'https://music.beyondmotion.net/album'),
    entry('kept-b', 'https://music.beyondmotion.net/other'),
  ]));
  assert.doesNotThrow(() => validateSites([entry('internal-path', '/reading/')]));
  assert.doesNotThrow(() => validateSites([entry('same-origin', 'https://beyondmotion.net/reading/')]));
  assert.doesNotThrow(() => validateSites([entry('independent-site', 'https://music.beyondmotion.net/')]));
  assert.throws(() => validateSites([
    entry('internal-path', '/reading/'),
    entry('same-origin', 'https://beyondmotion.net/reading'),
  ]), /地址重复/);
  assert.doesNotThrow(() => validateSites([{ ...sample, cover: null, coverSmall: null, coverAlt: '' }]));
}

function readDist(root, relativePosix) {
  const file = path.join(root, 'dist', ...relativePosix.split('/').filter(Boolean));
  if (!fs.existsSync(file)) throw new Error(`缺少构建页面 dist/${relativePosix}。先运行 npm run build:all。`);
  return fs.readFileSync(file, 'utf8');
}

function assertCardLink(html, site) {
  const at = html.indexOf(`data-site-id="${site.id}"`);
  assert(at >= 0, `缺少卡片：${site.id}`);
  const end = html.indexOf('</article>', at);
  const slice = html.slice(at, end === -1 ? at + 2000 : end);
  if (site.cover) assert(slice.includes(`src="${site.cover}"`), `${site.id}封面未统一输出`);
  if (site.coverSmall) assert(slice.includes(`${site.coverSmall} 600w, ${site.cover} 1200w`), `${site.id}封面未统一输出两档资源`);
  const link = resolveSiteLink(site.url);
  const href = link.href.replaceAll('&', '&amp;');
  assert(slice.includes(`href="${href}"`), `${site.id} 链接未按站内规则输出`);
  if (link.external) {
    assert(slice.includes('target="_blank"'), `${site.id} 外站应新窗口打开`);
    assert(slice.includes('rel="noopener noreferrer"'), `${site.id} 外站缺少 rel`);
    assert(slice.includes('（在新窗口打开）'), `${site.id} 外站缺少新窗口提示`);
    assert(slice.includes('进入小站 ↗'), `${site.id} 外站文案有误`);
    const hostPattern = link.host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert(new RegExp(`<span class="site-host"[^>]*>${hostPattern}</span>`).test(slice), `${site.id} 外站应显示主机名`);
  } else {
    assert(!slice.includes('target='), `${site.id} 站内链接不应新窗口打开`);
    assert(!slice.includes('（在新窗口打开）'), `${site.id} 站内链接不应提示新窗口`);
    assert(!slice.includes('class="site-host"'), `${site.id} 站内链接不应显示外链主机`);
    assert(slice.includes('打开页面 →'), `${site.id} 站内文案有误`);
  }
}

export function assertPortalExclusions(text, context = '公开内容') {
  assert(!/番茄音乐报|tomato-music|tomato\.1986318\.xyz/i.test(text), `${context}包含主站明确排除的小站`);
}

export function checkPortalExclusions(root) {
  assertPortalExclusions(JSON.stringify(sites), '站点清单');
  const visit = dir => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      assertPortalExclusions(path.relative(root, file), '公开资源路径');
      if (item.isDirectory()) visit(file);
      else if (/\.(?:html|xml|json|js|css|svg|txt)$/i.test(item.name)) assertPortalExclusions(fs.readFileSync(file, 'utf8'), path.relative(root, file));
    }
  };
  visit(path.join(root, 'dist'));
}

// Generated pages, covers, nav highlight, and sitemap. Requires npm run build:all.
export function checkSiteCatalogue(root = path.resolve(import.meta.dirname, '..')) {
  assertSiteLinkRules();
  for (const site of getSites()) {
    if (!site.cover) continue;
    const cover = path.join(root, 'public', String(site.cover).replace(/^\/+/, ''));
    assert(fs.existsSync(cover), `封面不存在：${site.id}`);
    if (site.coverSmall) assert(fs.existsSync(path.join(root, 'public', site.coverSmall.replace(/^\/+/, ''))), `小尺寸封面不存在：${site.id}`);
  }

  const directory = readDist(root, 'sites/index.html');
  for (const site of getSites()) assertCardLink(directory, site);
  for (const site of sites.filter(site => site.status === 'draft')) {
    assert(!directory.includes(`data-site-id="${site.id}"`), `目录泄露草稿：${site.id}`);
  }
  const readPage = route => readDist(root, `${route ? `${route}/` : ''}index.html`);
  const cardIds = html => [...html.matchAll(/data-site-id="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(cardIds(readPage('')), [], '首页不再混排小站内容');
  assert(!/data-(?:work|note)-id=/.test(readPage('')), '首页不再混排作品或文章明细');
  for (const route of ['works', 'visuals', 'music']) assert(readPage('').includes(`data-medium-entry=`) && readPage('').includes(`href="/${route}/"`), `首页缺少${route}分类入口`);
  assert.deepEqual(cardIds(readPage('works')), [], '影像页不得混排音乐和日刊小站');
  for (const [category, route] of [['visual', 'visuals'], ['music', 'music'], ['reading', 'reading'], ['tools', 'tools'], ['tools', 'studio']]) {
    const html = readPage(route);
    assert.deepEqual(cardIds(html), getSites({ category }).map(site => site.id), `${route}须与目录同源`);
    for (const site of getSites({ category })) assertCardLink(html, site);
  }
  const music = readPage('music');
  assert.deepEqual([...music.matchAll(/data-music-entry-id="([^"]+)"/g)].map(match => match[1]), getSites({ category: 'music' }).map(site => site.id), '音乐首屏三个同级入口须与清单一致');
  assert(music.includes('class="disc"'), '音乐页须保留唱片Hero');
  checkPortalExclusions(root);
  for (const [route, label] of [['works','影像'], ['works/dingying-fix','影像'], ['visuals','图像'], ['music','音乐'], ['projects/ashi','阿拾'], ['notes','阅读'], ['reading','阅读'], ['studio','工具'], ['tools','工具'], ['sites','全部小站']]) {
    const html = readPage(route);
    assert(new RegExp(`<a[^>]+aria-current="page"[^>]*>${label}</a>`).test(html), `栏目高亮有误：${route}`);
  }
  const sitemap = readDist(root, 'sitemap.xml');
  for (const route of ['visuals', 'projects/ashi', 'reading', 'tools', 'sites']) assert(sitemap.includes(`https://beyondmotion.net/${route}</loc>`), `sitemap缺少${route}`);
  const entries = getSites().length;
  console.log(`Site catalogue: ${entries} entries, status/URL/cover checks passed.`);
  return {entries};
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  try {
    checkSiteCatalogue();
  } catch (error) {
    console.error(error.message ?? error);
    process.exit(1);
  }
}
