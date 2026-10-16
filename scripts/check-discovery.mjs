import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {readSiteOrigin} from './release-check-lib.mjs';

export function discoveryUrls(sitemap, rss, origin) {
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
  const links = [...rss.matchAll(/<link>([^<]+)<\/link>/g)].map(match => match[1]);
  assert(locs.length > 0 && links.length > 0, 'sitemap/RSS 缺少页面地址');
  const permalinks = [...rss.matchAll(/<guid\b([^>]*)>([^<]+)<\/guid>/g)]
    .filter(match => !/isPermaLink=["']false["']/.test(match[1])).map(match => match[2]);
  const urls = [...new Set([...locs, ...links, ...permalinks])];
  for (const value of urls) {
    const url = new URL(value);
    assert.equal(url.origin, origin, `发现文档不是主域地址：${value}`);
    assert(url.pathname.endsWith('/') && !url.search && !url.hash, `发现文档须使用最终尾斜杠地址：${value}`);
  }
  for (const [item] of rss.matchAll(/<item\b[^>]*>[\s\S]*?<\/item>/g)) {
    const date = item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1];
    assert(date && Number.isFinite(Date.parse(date)) && new Date(date).toUTCString() === date, 'RSS 条目缺少有效 pubDate');
  }
  return {urls, sitemapCount: locs.length, rssLinks: links.length};
}

export function checkDiscovery(root) {
  const dist = path.join(root, 'dist');
  const report = discoveryUrls(fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8'), fs.readFileSync(path.join(dist, 'rss.xml'), 'utf8'), readSiteOrigin(root));
  for (const value of report.urls) {
    const file = path.join(dist, decodeURIComponent(new URL(value).pathname), 'index.html');
    assert(fs.existsSync(file), `发现文档页面未构建：${value}`);
  }
  const headers = fs.readFileSync(path.join(dist, '_headers'), 'utf8');
  assert.match(headers, /\/rss\.xml\r?\n\s+Content-Type: application\/rss\+xml; charset=utf-8/i, 'Pages RSS 媒体类型未配置');
  console.log(`Discovery: ${report.sitemapCount} sitemap URLs, ${report.rssLinks} RSS links, final paths and pubDate passed.`);
  return report;
}

async function request(url) {
  return fetch(url, {redirect: 'manual', signal: AbortSignal.timeout(15000)});
}

export async function checkLiveDiscovery(root) {
  const origin = readSiteOrigin(root);
  const documents = [];
  for (const [route, type] of [['sitemap.xml', 'application/xml'], ['rss.xml', 'application/rss+xml']]) {
    const response = await request(`${origin}/${route}`);
    assert.equal(response.status, 200, `${route} 必须直接返回200，实际${response.status}`);
    assert.equal(response.headers.get('content-type')?.split(';')[0].trim(), type, `${route} 媒体类型错误`);
    documents.push(await response.text());
  }
  const report = discoveryUrls(...documents, origin);
  for (const url of report.urls) {
    const response = await request(url);
    await response.body?.cancel();
    assert.equal(response.status, 200, `${url} 必须无跳转返回200，实际${response.status} ${response.headers.get('location') ?? ''}`);
  }
  const www = new URL(origin);
  www.hostname = `www.${www.hostname}`;
  for (const protocol of ['http:', 'https:']) {
    www.protocol = protocol;
    for (const route of ['/', '/about', '/about/?from=bey146&x=1', '/notes/?from=bey146']) {
      const response = await request(new URL(route, www));
      await response.body?.cancel();
      assert.equal(response.status, 301, `www 必须返回301：${protocol}${route}`);
      assert.equal(response.headers.get('location'), `${origin}${route}`, 'www 必须保留路径和查询串');
    }
  }
  console.log(`Live discovery: ${report.urls.length} final URLs returned 200 without redirects; 8 www redirects passed.`);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const root = path.resolve(import.meta.dirname, '..');
  try {
    if (process.argv.includes('--live')) await checkLiveDiscovery(root);
    else checkDiscovery(root);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
