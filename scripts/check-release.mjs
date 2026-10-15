import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {buildPrompt} from '../studio-sites/shared/prompt.js';
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

const PUBLIC_RECIPE_KEYS = ['prompt', 'soup', 'photoUse', 'noPhoto', 'slots', 'photoLock', 'textRule', 'globalNegative'];

function recipeKeyHits(value, trail = '') {
  const hits = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => hits.push(...recipeKeyHits(item, `${trail}[${index}]`)));
    return hits;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const next = trail ? `${trail}.${key}` : key;
      if (PUBLIC_RECIPE_KEYS.includes(key)) hits.push(next);
      else hits.push(...recipeKeyHits(child, next));
    }
  }
  return hits;
}

function recipeMarkers(source) {
  const markers = [];
  const push = (text) => {
    if (typeof text === 'string' && text.length >= 12) markers.push(text);
  };
  for (const item of source.items) {
    const prompt = item.prompt;
    if (typeof prompt === 'string') push(prompt.slice(0, 80));
    if (prompt && typeof prompt === 'object') {
      push(prompt.soup?.slice(0, 80));
      push(prompt.photoUse);
      push(prompt.noPhoto);
      for (const line of prompt.slots || []) if (line.includes('{{')) push(line);
    }
    for (const variant of item.variants || []) push(variant.prompt?.slice(0, 80));
  }
  for (const key of ['photoLock', 'textRule', 'globalNegative']) push(source.shared?.[key]);
  return markers;
}

function checkStudios(root) {
  for (const kind of ['wedding', 'portrait']) {
    const dir = path.join(root, '.studio-dist', kind);
    const source = JSON.parse(fs.readFileSync(path.join(root, 'studio-sites', kind, 'data.json'), 'utf8'));
    const data = JSON.parse(fs.readFileSync(path.join(dir, 'data.json'), 'utf8'));
    assert.equal(data.items.length, kind === 'wedding' ? 30 : 24);
    assert.equal(new Set(data.items.map((item) => item.id)).size, data.items.length);
    const hits = recipeKeyHits(data);
    assert.equal(hits.length, 0, `${kind} public data.json still has recipe fields: ${hits.join(', ')}`);
    assert.equal(fs.existsSync(path.join(dir, 'prompt.js')), false, `${kind} still publishes prompt.js`);
    const published = walkFiles(dir).filter((file) => /\.(html|js|json|txt|xml)$/.test(file));
    const blob = published.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    for (const key of PUBLIC_RECIPE_KEYS) assert(!blob.includes(`"${key}"`), `${kind} public file still contains "${key}"`);
    for (const marker of recipeMarkers(source)) assert(!blob.includes(marker), `${kind} public bundle still contains a recipe fragment`);
    for (const item of data.items) {
      assert(item.id && item.name && item.description && item.category && item.image && item.thumb, item.id || kind);
      for (const asset of [item.image, item.thumb, ...(item.variants || []).flatMap((variant) => [variant.image, variant.thumb])]) {
        assert(fs.existsSync(path.join(dir, asset)), asset);
      }
      for (const variant of item.variants || []) {
        assert(variant.title && variant.image && variant.thumb && !('prompt' in variant), `${item.id} variant`);
      }
      if (kind === 'wedding') {
        const input = Object.fromEntries(source.items.find((entry) => entry.id === item.id).fields.map((key) => [key, key === 'date' ? '2026-11-21' : key === 'time' ? '18:30' : key === 'name1' ? '林知远' : key === 'name2' ? '陈晚晴' : key === 'name1En' ? 'Zhiyuan' : key === 'name2En' ? 'Wanqing' : '测试内容']));
        const result = buildPrompt(source.items.find((entry) => entry.id === item.id), input, source.shared, {hasPhoto: item.photo === 'required'}).prompt;
        assert(result.length > 150);
        assert(!/\{\{|当一组样张/.test(result));
        if (item.fields.includes('name1')) assert(result.includes('林知远') || result.includes('Zhiyuan'), `names missing: ${item.id}`);
      } else {
        const sourceItem = source.items.find((entry) => entry.id === item.id);
        for (const variant of sourceItem.variants) assert(variant.prompt.length > 150);
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
}

export function runReleaseChecks(root = path.resolve(import.meta.dirname, '..')) {
  const errors = [];
  let bundles;
  let content;
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
    checkStudios(root);
    console.log('Public studio catalogs omit prompt recipes; source templates still assemble.');
  } catch (error) {
    errors.push(error.message);
  }
  if (errors.length > 0) throw new Error(errors.join('\n\n'));
  return {bundles, content};
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
