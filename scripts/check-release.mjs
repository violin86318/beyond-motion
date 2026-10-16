import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {buildPrompt} from '../studio-sites/shared/prompt.js';
import {checkSiteCatalogue} from './check-sites.mjs';
import {checkDiscovery} from './check-discovery.mjs';
import {
  checkContentPublication,
  inspectHtmlLinks,
  readSiteOrigin,
  summarizeExternals,
  walkFiles,
} from './release-check-lib.mjs';

const BUNDLES = ['dist', '.studio-dist/wedding', '.studio-dist/portrait'];
const SECRET = /\/Users\/|Bearer |CLOUDFLARE_API_TOKEN|api\/generate|api\/object/;

function checkBundles(root) {
  const siteOrigin = readSiteOrigin(root);
  const externals = [];
  const counts = [];
  for (const folder of BUNDLES) {
    const dir = path.join(root, folder);
    if (!fs.existsSync(dir)) throw new Error(`缺少构建目录 ${folder}。先运行 npm run build:all。`);
    const files = walkFiles(dir);
    assert(files.length < 20000, `${folder} 文件过多`);
    for (const file of files) {
      assert(fs.statSync(file).size <= 25 * 1024 * 1024, file);
      assert(!file.includes('.env'), file);
      if (/\.(html|js|json)$/.test(file)) {
        assert(!SECRET.test(fs.readFileSync(file, 'utf8')), `private or server reference: ${file}`);
      }
    }
    const problems = [];
    for (const file of files.filter((item) => item.endsWith('.html'))) {
      const html = fs.readFileSync(file, 'utf8');
      const result = inspectHtmlLinks(html, file, dir, {siteOrigin: folder === 'dist' ? siteOrigin : null});
      externals.push(...result.externals);
      problems.push(...result.problems);
    }
    if (problems.length > 0) {
      const shown = problems.slice(0, 40).map((item) => item.message);
      const rest = problems.length > shown.length ? `\n另有 ${problems.length - shown.length} 条` : '';
      throw new Error(`${shown.join('\n')}${rest}`);
    }
    counts.push({folder, files: files.length});
    console.log(`${folder}: assets, links and Pages limits passed (${files.length} files)`);
  }
  return {counts, externals, hosts: summarizeExternals(externals)};
}

function checkStudios(root) {
  for (const kind of ['wedding', 'portrait']) {
    const dir = path.join(root, '.studio-dist', kind);
    const data = JSON.parse(fs.readFileSync(path.join(dir, 'data.json'), 'utf8'));
    assert.equal(data.items.length, kind === 'wedding' ? 30 : 24);
    assert.equal(new Set(data.items.map((item) => item.id)).size, data.items.length);
    for (const item of data.items) {
      for (const asset of [item.image, item.thumb, ...(item.variants || []).flatMap((variant) => [variant.image, variant.thumb])]) {
        assert(fs.existsSync(path.join(dir, asset)), asset);
      }
      if (kind === 'wedding') {
        const input = Object.fromEntries(item.fields.map((key) => [key, key === 'date' ? '2026-11-21' : key === 'time' ? '18:30' : key === 'name1' ? '林知远' : key === 'name2' ? '陈晚晴' : key === 'name1En' ? 'Zhiyuan' : key === 'name2En' ? 'Wanqing' : '测试内容']));
        const result = buildPrompt(item, input, data.shared, {hasPhoto: item.photo === 'required'}).prompt;
        assert(result.length > 150);
        assert(!/\{\{|当一组样张/.test(result));
        if (item.fields.includes('name1')) assert(result.includes('林知远') || result.includes('Zhiyuan'), `names missing: ${item.id}`);
      } else {
        for (const variant of item.variants) assert(variant.prompt.length > 150);
      }
    }
  }
  const wedding = JSON.parse(fs.readFileSync(path.join(root, 'studio-sites/wedding/data.json'), 'utf8'));
  const partial = buildPrompt(
    wedding.items.find((item) => item.id === 'announce-premiere'),
    {name1: '林知远', name2: '陈晚晴', date: '2026-11-21'},
    wedding.shared,
    {hasPhoto: true},
  ).prompt;
  assert(partial.includes('2026年11月21日'), 'Required date disappears when optional location is empty');
  console.log('Optional location keeps required wedding date.');
}

export function runReleaseChecks(root = path.resolve(import.meta.dirname, '..')) {
  const errors = [];
  let bundles;
  let content;
  let catalogue;
  try {
    bundles = checkBundles(root);
  } catch (error) {
    errors.push(error.message);
  }
  try {
    content = checkContentPublication(root);
    console.log(`Draft exclusion (${content.drafts.length} from frontmatter), RSS articles (${content.expectedRss}) passed.`);
  } catch (error) {
    errors.push(error.message);
  }
  try {
    catalogue = checkSiteCatalogue(root);
  } catch (error) {
    errors.push(error.message);
  }
  try {
    checkDiscovery(root);
  } catch (error) {
    errors.push(error.message);
  }
  try {
    checkStudios(root);
    console.log('All 54 prompt templates passed.');
  } catch (error) {
    errors.push(error.message);
  }
  if (errors.length > 0) throw new Error(errors.join('\n\n'));
  return {bundles, content, catalogue};
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  try {
    runReleaseChecks();
  } catch (error) {
    console.error(error.message ?? error);
    process.exit(1);
  }
}
