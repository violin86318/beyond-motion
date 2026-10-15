import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sites, getSites, validateSites } from '../src/lib/sites.mjs';

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
assert.doesNotThrow(() => validateSites([{ ...sample, cover: null, coverAlt: '' }]));
for (const site of getSites()) {
  if (site.cover) assert(fs.existsSync(new URL(`../public${site.cover}`, import.meta.url)), `封面不存在：${site.id}`);
}

const directory = fs.readFileSync(new URL('../dist/sites/index.html', import.meta.url), 'utf8');
for (const site of getSites()) {
  assert(directory.includes(`data-site-id="${site.id}"`), `目录缺少：${site.id}`);
  assert(directory.includes(site.url.replaceAll('&', '&amp;')), `目录入口不一致：${site.id}`);
}
for (const site of sites.filter(site => site.status === 'draft')) {
  assert(!directory.includes(`data-site-id="${site.id}"`), `目录泄露草稿：${site.id}`);
}
console.log(`Site catalogue: ${getSites().length} entries, status/URL/cover checks passed.`);
