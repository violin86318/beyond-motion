import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {assertSiteLinkRules} from './check-sites.mjs';
import {discoveryUrls} from './check-discovery.mjs';
import {
  assertFixedNpmScripts,
  assertHtmlLinks,
  checkContentPublication,
  decideAstroCheck,
  entryIdFromRelative,
  inspectHtmlLinks,
  isAcceptableAstroCheck,
  listContentEntries,
  segmentSlug,
} from './release-check-lib.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const failures = [];

function expectFail(label, fn, pattern) {
  try {
    const value = fn();
    if (value && typeof value.then === 'function') {
      throw new Error('expectFail 不支持异步');
    }
    failures.push(label);
    console.error(`仍然通过（应当失败）：${label}`);
  } catch (error) {
    const message = String(error.message);
    if (pattern && !pattern.test(message)) {
      failures.push(label);
      console.error(`失败原因不对：${label}\n  ${message.split('\n')[0]}`);
      return;
    }
    console.log(`已拦住：${label}\n  ${message.split('\n')[0]}`);
  }
}

function expectPass(label, fn) {
  fn();
  console.log(`已通过：${label}`);
}

function writeFile(file, contents) {
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, contents);
}

function withTemp(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-check-'));
  try {
    return run(dir);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
}

function pageStubs(dir) {
  writeFile(path.join(dir, 'src/pages/works/[slug].astro'), "getCollection('works', ({data}) => !data.draft)\n");
  writeFile(path.join(dir, 'src/pages/notes/[slug].astro'), 'getCollection("notes", ({data}) => !data.draft)\n');
  writeFile(path.join(dir, 'src/pages/sketches/[slug].astro'), "getCollection('sketches')\n");
  writeFile(path.join(dir, 'src/pages/rss.xml.ts'), "getCollection('notes',({data})=>!data.draft)\n");
}

function note(title, extra = '') {
  return `---\ntitle: ${title}\ndate: "2026-10"\nkind: log\ndescription: 摘要\n${extra}---\n\n正文\n`;
}

function feed(ids) {
  const items = ids.map((id) => `<item><title>${id}</title><link>https://example.test/notes/${id}</link><guid>https://example.test/notes/${id}</guid><description>摘要</description></item>`).join('');
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title><link>https://example.test/notes</link>${items}</channel></rss>`;
}

function validContentTree(dir) {
  pageStubs(dir);
  writeFile(path.join(dir, 'src/content/works/published-work/index.md'), '---\ndraft: false\ntitle: 已发布\n---\n');
  writeFile(path.join(dir, 'src/content/works/brand-new-draft/index.md'), '---\ndraft: true\ntitle: 新草稿\n---\n');
  writeFile(path.join(dir, 'src/content/notes/public-one.md'), note('一'));
  writeFile(path.join(dir, 'src/content/notes/public-two.md'), note('二', 'draft: false\n'));
  writeFile(path.join(dir, 'src/content/notes/body-mention.md'), `${note('三')}正文里出现 draft: true 也不算草稿。\n`);
  writeFile(path.join(dir, 'src/content/notes/hidden-note.md'), note('隐藏', 'draft: "true"\n'));
  writeFile(path.join(dir, 'src/content/sketches/secret-sketch.md'), '---\ndraft: yes\ntitle: 草图\n---\n');
  for (const id of ['public-one', 'public-two', 'body-mention']) {
    writeFile(path.join(dir, 'dist/notes', id, 'index.html'), '<p>ok</p>');
  }
  writeFile(path.join(dir, 'dist/works/published-work/index.html'), '<p>ok</p>');
  writeFile(path.join(dir, 'dist/rss.xml'), feed(['public-one', 'public-two', 'body-mention']));
}

function linkFile(bundle, relativePath, html) {
  const file = path.join(bundle, relativePath);
  writeFile(file, html);
  return file;
}

function runLinkFixtures() {
  withTemp((bundle) => {
    writeFile(path.join(bundle, 'ghost.html'), '<p>root</p>');
    writeFile(path.join(bundle, 'notes/real.html'), '<p>real</p>');
    writeFile(path.join(bundle, 'ok.webp'), '');
    const notesIndex = linkFile(bundle, 'notes/index.html', '<a href="ghost.html">ghost</a>');
    expectFail('notes/index.html 的 href="ghost.html" 被根目录同名文件放过', () => {
      assertHtmlLinks(fs.readFileSync(notesIndex, 'utf8'), notesIndex, bundle);
    }, /notes\/ghost\.html/);
    const quoted = linkFile(bundle, 'notes/quoted.html', "<a href='missing.html'>x</a>");
    expectFail('单引号 href 被忽略', () => {
      assertHtmlLinks(fs.readFileSync(quoted, 'utf8'), quoted, bundle);
    });
    const poster = linkFile(bundle, 'player.html', '<video poster="/nope.jpg" src="/ghost.html"></video>');
    expectFail('poster="/nope.jpg" 被忽略', () => {
      assertHtmlLinks(fs.readFileSync(poster, 'utf8'), poster, bundle);
    }, /nope\.jpg/);
    const posterQuoted = linkFile(bundle, 'player-quoted.html', "<video poster='/nope.jpg'></video>");
    expectFail('单引号 poster 被忽略', () => {
      assertHtmlLinks(fs.readFileSync(posterQuoted, 'utf8'), posterQuoted, bundle);
    }, /nope\.jpg/);
    const srcset = linkFile(bundle, 'picture.html', '<img src="/ghost.html" srcset="/ok.webp 1x, /nope.webp 2x">');
    expectFail('srcset 里缺失的图片被忽略', () => {
      assertHtmlLinks(fs.readFileSync(srcset, 'utf8'), srcset, bundle);
    }, /nope\.webp/);
    const srcsetQuoted = linkFile(bundle, 'picture-quoted.html', `<img src='/ghost.html' srcset='/ok.webp 1x, /missing.webp 2x'>`);
    expectFail('单引号 srcset 被忽略', () => {
      assertHtmlLinks(fs.readFileSync(srcsetQuoted, 'utf8'), srcsetQuoted, bundle);
    });
    for (const [index, [label, html, pattern]] of [
      ['href 中的 data:', '<a href="data:text/html,hi">x</a>', /不允许 data:/],
      ['iframe src 中的 data:', '<iframe src="data:text/html,hi"></iframe>', /不允许 data:/],
      ['img src 中的 data:', '<img src="data:image/gif;base64,R0lGODlh">', /不允许 data:/],
      ['空 data: 图标', '<link rel="icon" href="data:,">', /不允许 data:/],
      ['javascript:', '<a href="javascript:alert(1)">x</a>', /不允许 javascript:/],
      ['实体编码的 javascript:', '<a href="javascript&#58;alert(1)">x</a>', /不允许 javascript:/],
      ['双重编码的 data:', '<a href="data&amp;#58;text/html,hi">x</a>', /不允许 data:/],
    ].entries()) {
      const file = linkFile(bundle, `bad-${index}.html`, html);
      expectFail(label, () => assertHtmlLinks(html, file, bundle), pattern);
    }
    expectPass('根路径 /ghost.html 仍指向构建根目录', () => {
      const file = linkFile(bundle, 'notes/abs.html', '<a href="/ghost.html">ok</a>');
      assertHtmlLinks(fs.readFileSync(file, 'utf8'), file, bundle);
    });
    expectPass('相对链接指向 HTML 所在目录', () => {
      const file = linkFile(bundle, 'notes/sib.html', '<a href="real.html">ok</a>');
      assertHtmlLinks(fs.readFileSync(file, 'utf8'), file, bundle);
    });
    expectPass('mailto 与纯锚点跳过', () => {
      const file = linkFile(bundle, 'notes/mail.html', '<a href="mailto:a@b.c">m</a><a href="#top">t</a>');
      assertHtmlLinks(fs.readFileSync(file, 'utf8'), file, bundle);
    });
    expectPass('外链图片记入主机而不是当成缺失本地文件', () => {
      const file = linkFile(bundle, 'notes/ext.html', '<img src="https://cdn.example/missing.png"><a href="https://space.bilibili.com/1">b</a>');
      const {problems, externals} = inspectHtmlLinks(fs.readFileSync(file, 'utf8'), file, bundle);
      assert.equal(problems.length, 0);
      assert.deepEqual(externals.map((item) => item.host).sort(), ['cdn.example', 'space.bilibili.com']);
    });
    expectFail('同站绝对地址按本地路径检查', () => {
      const file = linkFile(bundle, 'notes/origin.html', '<a href="https://beyondmotion.net/notes/ghost.html">x</a>');
      assertHtmlLinks(fs.readFileSync(file, 'utf8'), file, bundle, {siteOrigin: 'https://beyondmotion.net'});
    });
    expectPass('存在的同站绝对地址可以通过', () => {
      const file = linkFile(bundle, 'notes/origin-ok.html', '<a href="https://beyondmotion.net/ghost.html">x</a>');
      assertHtmlLinks(fs.readFileSync(file, 'utf8'), file, bundle, {siteOrigin: 'https://beyondmotion.net'});
    });
    expectPass('未提供站点源时，工作室页面上的主站链接保持为外链', () => {
      const file = linkFile(bundle, 'studio.html', '<a href="https://beyondmotion.net/privacy">p</a>');
      const {problems, externals} = inspectHtmlLinks(fs.readFileSync(file, 'utf8'), file, bundle);
      assert.equal(problems.length, 0);
      assert.equal(externals[0].host, 'beyondmotion.net');
    });
  });
}

function runContentFixtures() {
  withTemp((dir) => {
    validContentTree(dir);
    expectPass('新 slug 的草稿不在产物里，RSS 条数等于非草稿手记而不是 5', () => {
      const report = checkContentPublication(dir);
      assert.equal(report.expectedRss, 3);
      assert.deepEqual(report.drafts.map((entry) => entry.id).sort(), ['brand-new-draft', 'hidden-note', 'secret-sketch']);
    });
  });
  withTemp((dir) => {
    validContentTree(dir);
    writeFile(path.join(dir, 'dist/works/brand-new-draft/index.html'), '<p>leaked</p>');
    expectFail('新的作品草稿 brand-new-draft 进入 dist（不依赖写死的 signal-study）', () => checkContentPublication(dir));
  });
  withTemp((dir) => {
    validContentTree(dir);
    writeFile(path.join(dir, 'dist/notes/hidden-note/index.html'), '<p>leaked</p>');
    expectFail('手记草稿 hidden-note 进入 dist', () => checkContentPublication(dir));
  });
  withTemp((dir) => {
    validContentTree(dir);
    writeFile(path.join(dir, 'dist/sketches/secret-sketch/index.html'), '<p>leaked</p>');
    expectFail('第三个集合 sketches 的草稿进入 dist', () => checkContentPublication(dir));
  });
  withTemp((dir) => {
    validContentTree(dir);
    writeFile(path.join(dir, 'dist/rss.xml'), feed(['public-one', 'public-two', 'body-mention', 'extra-a', 'extra-b']));
    expectFail('RSS 写成 5 条但源码只有 3 篇非草稿手记', () => checkContentPublication(dir));
  });
  withTemp((dir) => {
    validContentTree(dir);
    writeFile(path.join(dir, 'dist/rss.xml'), feed(['public-one', 'public-two']));
    expectFail('RSS 少了一篇非草稿手记', () => checkContentPublication(dir));
  });
  withTemp((dir) => {
    validContentTree(dir);
    writeFile(path.join(dir, 'dist/rss.xml'), feed(['public-one', 'public-two', 'hidden-note']));
    expectFail('RSS 用草稿手记顶替一篇已发布手记', () => checkContentPublication(dir));
  });
  withTemp((dir) => {
    validContentTree(dir);
    writeFile(path.join(dir, 'src/content/notes/hidden-note.md'), note('换 slug', 'draft: true\nslug: totally-other\n'));
    writeFile(path.join(dir, 'dist/notes/totally-other/index.html'), '<p>leaked</p>');
    expectFail('frontmatter slug 覆盖文件名后，草稿仍按实际输出路径检查', () => checkContentPublication(dir));
  });
  withTemp((dir) => {
    writeFile(path.join(dir, 'src/content/orphan/secret.md'), '---\ndraft: true\ntitle: x\n---\n');
    writeFile(path.join(dir, 'src/pages/rss.xml.ts'), "getCollection('notes')\n");
    writeFile(path.join(dir, 'dist/rss.xml'), feed([]));
    expectFail('有内容集合但没有动态路由时不能静默跳过', () => checkContentPublication(dir));
  });
}

function runAstroFixtures() {
  const absent = {script: undefined, dependency: false, lock: false, history: false};
  expectPass('三个标记都不存在时，类型检查尚未引入', () => {
    assert.equal(decideAstroCheck(absent).action, 'not-introduced');
  });
  for (const [label, signals] of [
    ['脚本写成 true', {...absent, script: 'true'}],
    ['脚本写成 exit 0', {...absent, script: 'exit 0'}],
    ['脚本用 || true 吞掉失败', {...absent, script: 'astro check || true'}],
    ['脚本用分号改掉退出码', {...absent, script: 'astro check; exit 0'}],
    ['历史里有过 check:astro 但脚本被删掉', {...absent, history: true}],
    ['依赖还在但脚本被删掉', {...absent, dependency: true}],
    ['锁文件还在但脚本被删掉', {...absent, lock: true}],
  ]) {
    expectFail(label, () => {
      const decision = decideAstroCheck(signals);
      if (decision.action === 'fail') throw new Error(decision.reason);
    });
  }
  expectPass('脚本正好是 astro check 时会执行', () => {
    assert.equal(isAcceptableAstroCheck('astro check'), true);
    assert.equal(decideAstroCheck({...absent, script: 'astro check', dependency: true}).action, 'run');
  });
  expectFail('npm 的 check 脚本被改成 true', () => {
    assertFixedNpmScripts({scripts: {check: 'true', verify: 'node scripts/verify.mjs'}});
  });
}

async function runRepoGuards() {
  const {slug} = await import('github-slugger');
  expectPass('当前内容文件的 id 与 Astro 使用的 github-slugger 一致', () => {
    const entries = listContentEntries(path.join(repoRoot, 'src/content'));
    assert.ok(entries.length >= 7);
    for (const entry of entries) {
      const relative = entry.file.split('/').slice(1).join('/');
      const withoutExt = relative.replace(/\.[^./]+$/, '');
      const expected = withoutExt.split('/').filter(Boolean).map((part) => slug(part)).join('/').replace(/\/index$/, '');
      assert.equal(entry.id, expected, entry.file);
    }
    assert.equal(segmentSlug('Untitled MV'), slug('Untitled MV'));
    assert.equal(entryIdFromRelative('Brand New/index.md', {}), 'brand-new');
  });
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  expectPass('package.json 的 check 与 verify 都指向 verify.mjs', () => assertFixedNpmScripts(pkg));
  const ci = fs.readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
  expectPass('CI 直接运行 verify.mjs，不再探测脚本是否存在', () => {
    assert.match(ci, /node scripts\/verify\.mjs/);
    assert.match(ci, /npm run build:all/);
    assert.match(ci, /fetch-depth:\s*0/);
    assert.doesNotMatch(ci, /has no check:astro/);
    assert.doesNotMatch(ci, /skipping/);
  });
  const deploy = fs.readFileSync(path.join(repoRoot, 'scripts/deploy-all.sh'), 'utf8');
  expectPass('deploy-all 与 CI 使用同一条检查命令', () => {
    assert.match(deploy, /npm run build:all/);
    assert.match(deploy, /node scripts\/verify\.mjs/);
    assert.doesNotMatch(deploy, /^npm run check$/m);
  });
  const release = fs.readFileSync(path.join(repoRoot, 'scripts/check-release.mjs'), 'utf8');
  const sitesCheck = fs.readFileSync(path.join(repoRoot, 'scripts/check-sites.mjs'), 'utf8');
  expectPass('小站清单挂在发布检查上，并覆盖页面、封面、导航和 sitemap', () => {
    assert.match(release, /checkSiteCatalogue\(/);
    assert.doesNotMatch(release, /signal-study/);
    assert.match(sitesCheck, /data-site-id/);
    assert.match(sitesCheck, /aria-current="page"/);
    assert.match(sitesCheck, /sitemap\.xml/);
    assert.match(sitesCheck, /封面不存在/);
    assertSiteLinkRules();
  });
}

export async function runSelfTest() {
  failures.length = 0;
  const origin = 'https://example.test';
  const sitemap = '<urlset><url><loc>https://example.test/notes/public-one/</loc></url></urlset>';
  const rss = '<rss><channel><link>https://example.test/notes/</link><item><link>https://example.test/notes/public-one/</link><guid isPermaLink="false">https://example.test/notes/public-one</guid><pubDate>Thu, 01 Oct 2026 00:00:00 GMT</pubDate></item></channel></rss>';
  expectPass('发现文档使用最终地址，同时保留历史不透明 GUID', () => discoveryUrls(sitemap, rss, origin));
  expectFail('sitemap 无尾斜杠', () => discoveryUrls(sitemap.replace('public-one/', 'public-one'), rss, origin), /尾斜杠/);
  expectFail('RSS 无尾斜杠', () => discoveryUrls(sitemap, rss.replace('notes/</link>', 'notes</link>'), origin), /尾斜杠/);
  expectFail('RSS permalink GUID 无尾斜杠', () => discoveryUrls(sitemap, rss.replace(' isPermaLink="false"', ''), origin), /尾斜杠/);
  expectFail('发现文档误用 www', () => discoveryUrls(sitemap.replace('example.test', 'www.example.test'), rss, origin), /主域/);
  expectFail('RSS 缺少日期', () => discoveryUrls(sitemap, rss.replace(/<pubDate>.*?<\/pubDate>/, ''), origin), /pubDate/);
  expectFail('RSS 无效日期', () => discoveryUrls(sitemap, rss.replace('Thu, 01 Oct 2026 00:00:00 GMT', 'Invalid Date'), origin), /pubDate/);
  runLinkFixtures();
  runContentFixtures();
  runAstroFixtures();
  await runRepoGuards();
  if (failures.length > 0) {
    throw new Error(`自测未拦住：\n${failures.map((label) => `- ${label}`).join('\n')}`);
  }
  console.log('自测通过：上面每一条「已拦住」都是从前能绕过、现在会让检查失败的情况。');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  runSelfTest().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
