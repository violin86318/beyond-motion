import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

// 全站源码没有把 data: 图片当作页面内容。player-sites 里的 href="data:,"
// 只是空图标，而且不在 dist / .studio-dist 的扫描范围内。
// 因此 href、src、poster、srcset 里的 data: 一律拒绝，包括 img。
const FORBIDDEN_SCHEMES = new Set(['data', 'javascript', 'vbscript']);
const IGNORED_SCHEMES = new Set(['mailto', 'tel', 'sms']);
const RESOURCE_ATTRS = new Set(['src', 'poster', 'srcset']);
const FIXED_SCRIPT = 'node scripts/verify.mjs';

const ASCII_PUNCTUATION = /[\u0000-\u001f!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~\u007f]+/g;

export function segmentSlug(segment) {
  return segment
    .toLowerCase()
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(ASCII_PUNCTUATION, '')
    .replace(/ /g, '-');
}

export function stripQuotes(value) {
  const trimmed = String(value).trim().replace(/\s+#.*$/, '');
  const quoted = trimmed.match(/^(['"])([\s\S]*)\1$/);
  return quoted ? quoted[2] : trimmed;
}

export function parseFrontmatter(text) {
  const body = String(text).replace(/^\uFEFF/, '');
  const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return {};
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || /^\s/.test(line) || line.trimStart().startsWith('#')) continue;
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!field) continue;
    data[field[1]] = field[2].trim();
  }
  return data;
}

export function isDraft(frontmatter) {
  if (!Object.prototype.hasOwnProperty.call(frontmatter, 'draft')) return false;
  const value = stripQuotes(frontmatter.draft).trim().toLowerCase();
  if (value === 'true' || value === 'yes' || value === 'on') return true;
  if (value === 'false' || value === 'no' || value === 'off' || value === '') return false;
  throw new Error(`无法识别的 draft 值：${frontmatter.draft}`);
}

export function entryIdFromRelative(relativePosix, frontmatter = {}) {
  if (Object.prototype.hasOwnProperty.call(frontmatter, 'slug')) {
    const explicit = stripQuotes(frontmatter.slug).trim();
    if (explicit) return explicit;
  }
  const withoutExt = relativePosix.replace(/\.[^./]+$/, '');
  const segments = withoutExt.split('/').filter(Boolean).map(segmentSlug);
  return segments.join('/').replace(/\/index$/, '');
}

export function walkFiles(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(full) : [full];
  });
}

function isMarkdown(file) {
  return file.endsWith('.md') || file.endsWith('.mdx');
}

function hasIgnoredSegment(relativePosix) {
  return relativePosix.split('/').some((segment) => segment.startsWith('_') || segment.startsWith('.'));
}

export function listContentEntries(contentDir) {
  if (!fs.existsSync(contentDir)) throw new Error(`找不到内容目录 ${contentDir}`);
  const entries = [];
  for (const collection of fs.readdirSync(contentDir, {withFileTypes: true})) {
    if (!collection.isDirectory() || collection.name.startsWith('.') || collection.name.startsWith('_')) continue;
    const base = path.join(contentDir, collection.name);
    for (const file of walkFiles(base).filter(isMarkdown)) {
      const relativePosix = path.relative(base, file).split(path.sep).join('/');
      if (hasIgnoredSegment(relativePosix)) continue;
      const frontmatter = parseFrontmatter(fs.readFileSync(file, 'utf8'));
      const id = entryIdFromRelative(relativePosix, frontmatter);
      if (!id || id.includes('\\') || id.split('/').includes('..')) {
        throw new Error(`${relativePosix} 的条目 id 不能用：${id}`);
      }
      entries.push({
        collection: collection.name,
        id,
        draft: isDraft(frontmatter),
        file: path.relative(contentDir, file).split(path.sep).join('/'),
      });
    }
  }
  return entries;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function dynamicRoutesFor(pagesDir, collection) {
  if (!fs.existsSync(pagesDir)) return [];
  const routes = [];
  const usesCollection = new RegExp(`getCollection\\(\\s*['"]${escapeRegExp(collection)}['"]`);
  for (const file of walkFiles(pagesDir)) {
    if (!/\.(astro|ts|js|mjs)$/.test(file)) continue;
    const route = path.relative(pagesDir, file).split(path.sep).join('/').replace(/\.(astro|ts|js|mjs)$/, '');
    if (!/\[(?:\.\.\.)?[A-Za-z0-9_]+\]$/.test(route)) continue;
    if (!usesCollection.test(fs.readFileSync(file, 'utf8'))) continue;
    routes.push(route);
  }
  return routes;
}

export function outputCandidates(distRoot, route, id) {
  const pathname = route.replace(/\[(?:\.\.\.)?[A-Za-z0-9_]+\]$/, id);
  const base = path.resolve(distRoot, ...pathname.split('/').filter(Boolean));
  const relative = path.relative(distRoot, base);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`条目路径逃出 dist：${pathname}`);
  }
  return [base, `${base}.html`, path.join(base, 'index.html')];
}

function routeLabel(route, id) {
  return route.replace(/\[(?:\.\.\.)?[A-Za-z0-9_]+\]$/, id);
}

export function rssPageFiles(pagesDir) {
  if (!fs.existsSync(pagesDir)) return [];
  return walkFiles(pagesDir).filter((file) => /^rss\./.test(path.basename(file)));
}

function collectionsInSource(text) {
  return [...text.matchAll(/getCollection\(\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

function feedHasEntry(feed, collection, id) {
  const pattern = new RegExp(`/${escapeRegExp(collection)}/${escapeRegExp(id)}(?![A-Za-z0-9_-])`);
  return pattern.test(feed);
}

export function checkContentPublication(repoRoot, distRoot = path.join(repoRoot, 'dist')) {
  const contentDir = path.join(repoRoot, 'src/content');
  const pagesDir = path.join(repoRoot, 'src/pages');
  const entries = listContentEntries(contentDir);
  const problems = [];
  const routesByCollection = new Map();

  for (const collection of new Set(entries.map((entry) => entry.collection))) {
    const routes = dynamicRoutesFor(pagesDir, collection);
    if (routes.length === 0) {
      problems.push(`集合 ${collection} 有内容文件，但 src/pages 里没有调用 getCollection('${collection}') 的动态路由，无法证明草稿不会被构建出去`);
      continue;
    }
    routesByCollection.set(collection, routes);
  }

  for (const entry of entries) {
    const routes = routesByCollection.get(entry.collection) ?? [];
    for (const route of routes) {
      const candidates = outputCandidates(distRoot, route, entry.id);
      const published = candidates.filter((candidate) => fs.existsSync(candidate));
      const label = routeLabel(route, entry.id);
      if (entry.draft && published.length > 0) {
        problems.push(`草稿已进入构建产物：${entry.file}（draft: true）→ ${label}`);
      }
      if (!entry.draft && published.length === 0) {
        problems.push(`非草稿条目没有生成页面：${entry.file} → ${label}`);
      }
    }
  }

  const rssFiles = rssPageFiles(pagesDir);
  if (rssFiles.length === 0) problems.push('src/pages 里没有 rss.* 页面，无法从源码推导 RSS');
  let expectedRss = 0;
  for (const rssFile of rssFiles) {
    const source = fs.readFileSync(rssFile, 'utf8');
    const collections = [...new Set(collectionsInSource(source))];
    if (collections.length === 0) {
      problems.push(`${path.basename(rssFile)} 没有 getCollection(...)，无法推导 RSS 条目`);
      continue;
    }
    const route = path.relative(pagesDir, rssFile).split(path.sep).join('/').replace(/\.(astro|ts|js|mjs)$/, '');
    const output = path.join(distRoot, route);
    if (!fs.existsSync(output)) {
      problems.push(`缺少 RSS 产物 ${route}`);
      continue;
    }
    const feed = fs.readFileSync(output, 'utf8');
    const expected = entries.filter((entry) => !entry.draft && collections.includes(entry.collection));
    expectedRss += expected.length;
    const itemCount = (feed.match(/<item\b/g) ?? []).length;
    if (itemCount !== expected.length) {
      problems.push(`${route} 有 ${itemCount} 条 <item>，源码里 ${collections.join('、')} 的非草稿条目是 ${expected.length}。条数由 frontmatter 决定，不使用写死的数字`);
    }
    for (const entry of expected) {
      if (!feedHasEntry(feed, entry.collection, entry.id)) {
        problems.push(`${route} 缺少非草稿条目 /${entry.collection}/${entry.id}`);
      }
    }
    for (const entry of entries.filter((item) => item.draft)) {
      if (feedHasEntry(feed, entry.collection, entry.id)) {
        problems.push(`${route} 含有草稿 /${entry.collection}/${entry.id}`);
      }
    }
  }

  if (problems.length > 0) {
    const error = new Error(problems.join('\n'));
    error.problems = problems;
    throw error;
  }

  const drafts = entries
    .filter((entry) => entry.draft)
    .sort((a, b) => a.file.localeCompare(b.file, 'en'));
  return {entries, drafts, expectedRss};
}

function decodeEntitiesOnce(value) {
  const fromCode = (raw, radix) => {
    const code = Number.parseInt(raw, radix);
    if (!Number.isInteger(code) || code < 0 || code > 0x10FFFF) return null;
    try {
      return String.fromCodePoint(code);
    } catch {
      return null;
    }
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (entity, hex) => fromCode(hex, 16) ?? entity)
    .replace(/&#([0-9]+);/g, (entity, num) => fromCode(num, 10) ?? entity)
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&');
}

export function decodeEntities(value) {
  return decodeEntitiesOnce(decodeEntitiesOnce(value));
}

function problem(message) {
  return {kind: 'problem', message};
}

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function localExists(bundleRoot, target) {
  const candidates = [target, `${target}.html`, path.join(target, 'index.html')];
  const rootReal = fs.realpathSync(bundleRoot);
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    let real = candidate;
    try {
      real = fs.realpathSync(candidate);
    } catch {
      return false;
    }
    if (isInside(rootReal, real)) return true;
  }
  return false;
}

function resolveLocal(urlPath, htmlFile, bundleRoot, attr) {
  const clean = urlPath.split('#')[0].split('?')[0];
  if (!clean) return {kind: 'skip'};
  let decoded;
  try {
    decoded = decodeURIComponent(clean);
  } catch {
    return problem(`无法解码链接 ${urlPath}`);
  }
  if (decoded.includes('\\') || decoded.includes('\0')) return problem(`链接含有反斜线或空字节：${urlPath}`);
  const target = decoded.startsWith('/')
    ? path.resolve(bundleRoot, decoded.replace(/^\/+/, ''))
    : path.resolve(path.dirname(htmlFile), decoded);
  if (!isInside(bundleRoot, target)) return problem(`链接逃出构建目录：${urlPath}`);
  if (!localExists(bundleRoot, target)) {
    const where = path.relative(bundleRoot, htmlFile).split(path.sep).join('/') || path.basename(htmlFile);
    const resolved = path.relative(bundleRoot, target).split(path.sep).join('/') || '.';
    return problem(`${where}：${attr}="${urlPath}" 应指向 ${resolved}，该文件不存在`);
  }
  return {kind: 'local'};
}

function classifyReference(rawValue, context) {
  const decoded = decodeEntities(rawValue).trim();
  if (!decoded || decoded.startsWith('#') || decoded.startsWith('?')) return {kind: 'skip'};
  if (decoded.startsWith('//')) {
    let host = decoded;
    try {
      host = new URL(`https:${decoded}`).hostname;
    } catch {
      host = decoded;
    }
    return {kind: 'external', url: decoded, host};
  }
  const scheme = decoded.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (scheme) {
    const name = scheme[1].toLowerCase();
    if (FORBIDDEN_SCHEMES.has(name)) {
      const preview = decoded.length > 80 ? `${decoded.slice(0, 80)}…` : decoded;
      return problem(`${context.where}：${context.attr} 不允许 ${name}: URL（${preview}）`);
    }
    if (IGNORED_SCHEMES.has(name)) return {kind: 'skip'};
    if (name === 'http' || name === 'https') {
      let url;
      try {
        url = new URL(decoded);
      } catch {
        return problem(`${context.where}：无法解析 URL ${decoded}`);
      }
      if (context.siteOrigin && url.origin === context.siteOrigin) {
        return resolveLocal(url.pathname, context.htmlFile, context.bundleRoot, context.attr);
      }
      return {kind: 'external', url: decoded, host: url.hostname};
    }
    return problem(`${context.where}：${context.attr} 不允许 ${name}: URL`);
  }
  return resolveLocal(decoded, context.htmlFile, context.bundleRoot, context.attr);
}

function splitSrcset(value) {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split(/\s+/)[0])
    .filter(Boolean);
}

function visibleMarkup(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b([^>]*)>[\s\S]*?<\/script>/gi, '<script$1></script>')
    .replace(/<style\b([^>]*)>[\s\S]*?<\/style>/gi, '<style$1></style>');
}

export function inspectHtmlLinks(html, htmlFile, bundleRoot, options = {}) {
  const problems = [];
  const externals = [];
  const source = visibleMarkup(html);
  const attrRe = /(?:^|[\s/>:])(href|src|poster|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
  const where = path.relative(bundleRoot, htmlFile).split(path.sep).join('/') || path.basename(htmlFile);
  let match;
  while ((match = attrRe.exec(source))) {
    const attr = match[1].toLowerCase();
    const rawValue = match[2] ?? match[3] ?? match[4] ?? '';
    const values = attr === 'srcset' ? splitSrcset(rawValue) : [rawValue];
    for (const value of values) {
      const result = classifyReference(value, {
        attr,
        where,
        htmlFile,
        bundleRoot,
        siteOrigin: options.siteOrigin ?? null,
      });
      if (result.kind === 'problem') problems.push({attr, message: result.message, file: where});
      else if (result.kind === 'external') externals.push({attr, url: result.url, host: result.host, file: where, resource: RESOURCE_ATTRS.has(attr)});
    }
  }
  return {problems, externals};
}

export function assertHtmlLinks(html, htmlFile, bundleRoot, options) {
  const result = inspectHtmlLinks(html, htmlFile, bundleRoot, options);
  if (result.problems.length > 0) {
    const error = new Error(result.problems.map((item) => item.message).join('\n'));
    error.problems = result.problems;
    throw error;
  }
  return result.externals;
}

export function readSiteOrigin(repoRoot) {
  const file = path.join(repoRoot, 'astro.config.mjs');
  if (!fs.existsSync(file)) return null;
  const match = fs.readFileSync(file, 'utf8').match(/\bsite\s*:\s*['"]([^'"]+)['"]/);
  if (!match) return null;
  try {
    return new URL(match[1]).origin;
  } catch {
    return null;
  }
}

export function summarizeExternals(externals) {
  const tally = (items) => {
    const counts = new Map();
    for (const item of items) counts.set(item.host, (counts.get(item.host) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  return {
    resources: tally(externals.filter((item) => item.resource)),
    links: tally(externals.filter((item) => !item.resource)),
  };
}

export function isAcceptableAstroCheck(script) {
  const trimmed = String(script ?? '').trim();
  if (!/^(?:npx\s+|npm\s+exec\s+--\s+)?astro\s+check(?:\s+\S+)*$/.test(trimmed)) return false;
  if (/[;&|`$<>()\\\n\r]/.test(trimmed)) return false;
  if (/\b(?:true|false|echo|exit)\b/.test(trimmed)) return false;
  return true;
}

export function decideAstroCheck(signals) {
  const introduced = Boolean(signals.dependency || signals.lock || signals.history);
  if (signals.script === undefined) {
    if (!introduced) return {action: 'not-introduced'};
    return {action: 'fail', reason: 'check:astro 已经引入（依赖、锁文件或 git 历史），但 package.json 里没有这个脚本'};
  }
  if (!isAcceptableAstroCheck(signals.script)) {
    return {action: 'fail', reason: `check:astro 不是 astro check：${signals.script}`};
  }
  return {action: 'run'};
}

export function loadAstroCheckSignals(root) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const script = pkg.scripts && Object.prototype.hasOwnProperty.call(pkg.scripts, 'check:astro')
    ? pkg.scripts['check:astro']
    : undefined;
  const deps = {...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies};
  const dependency = Object.prototype.hasOwnProperty.call(deps, '@astrojs/check');
  const lockPath = path.join(root, 'package-lock.json');
  const lock = fs.existsSync(lockPath) && fs.readFileSync(lockPath, 'utf8').includes('"node_modules/@astrojs/check"');
  let history = false;
  try {
    const out = execFileSync('git', ['--no-pager', 'log', '-S', 'check:astro', '--format=%H', '--', 'package.json'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    history = out.trim().length > 0;
  } catch (error) {
    if (script !== undefined || dependency || lock || process.env.GITHUB_ACTIONS === 'true') {
      throw new Error(`无法读取 package.json 的 git 历史：${error.message}`);
    }
  }
  return {script, dependency, lock, history};
}

export function assertFixedNpmScripts(pkg) {
  for (const name of ['check', 'verify']) {
    const script = pkg.scripts?.[name];
    if (script !== FIXED_SCRIPT) {
      throw new Error(`package.json 的 scripts.${name} 必须是 ${FIXED_SCRIPT}，当前是 ${script ?? '（缺失）'}`);
    }
  }
}

export function formatHostList(hosts) {
  if (hosts.length === 0) return '无';
  return hosts.map(([host, count]) => `${host}（${count}）`).join('、');
}
