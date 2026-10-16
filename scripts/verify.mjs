import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {runReleaseChecks} from './check-release.mjs';
import {runSelfTest} from './release-check.selftest.mjs';
import {checkSiteCoverArtwork} from './check-site-covers.mjs';
import {
  assertFixedNpmScripts,
  decideAstroCheck,
  formatHostList,
  loadAstroCheckSignals,
} from './release-check-lib.mjs';

const root = path.resolve(import.meta.dirname, '..');

function runAstroPolicy() {
  const signals = loadAstroCheckSignals(root);
  const decision = decideAstroCheck(signals);
  if (decision.action === 'not-introduced') {
    return {
      ok: true,
      title: 'Astro 类型检查还没成为必过项',
      detail: '本分支的 package.json 没有 check:astro，锁文件和当前分支历史里也没有 @astrojs/check。合并草稿 PR #1 之后，删掉这个脚本、把它写成 true / exit 0，或从 package.json 里拿掉但留下依赖，都会让本次检查失败。在那之前这里不会假装已经跑过类型检查。',
    };
  }
  if (decision.action === 'fail') return {ok: false, title: 'Astro 类型检查被跳过或替换', detail: decision.reason};
  const result = spawnSync('npm', ['run', 'check:astro'], {cwd: root, stdio: 'inherit'});
  if (result.status !== 0) {
    return {ok: false, title: 'Astro 类型检查失败', detail: `npm run check:astro 退出码 ${result.status ?? '未知'}`};
  }
  return {ok: true, title: 'Astro 类型检查已通过', detail: '已执行 npm run check:astro，并且脚本内容就是 astro check。'};
}

function advisoryLines(parsed) {
  const lines = [];
  for (const vuln of Object.values(parsed?.vulnerabilities ?? {})) {
    for (const via of vuln.via ?? []) {
      if (typeof via !== 'object') continue;
      if (via.severity !== 'high' && via.severity !== 'critical') continue;
      lines.push(`- ${via.severity} ${via.title ?? vuln.name}（${via.range ?? vuln.name}）`);
    }
  }
  return lines;
}

function runAudit() {
  const result = spawnSync('npm', ['audit', '--audit-level=high', '--json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout || '');
  } catch {
    parsed = null;
  }
  const counts = parsed?.metadata?.vulnerabilities;
  const highs = advisoryLines(parsed);
  const status = result.status;
  const detail = [];
  if (result.error) detail.push(`审计命令没有跑起来：${result.error.message}`);
  if (!parsed) detail.push('没有解析到 npm audit 的 JSON。构建仍然继续。');
  if (counts) {
    detail.push(`合计 info ${counts.info}、low ${counts.low}、moderate ${counts.moderate}、high ${counts.high}、critical ${counts.critical}。退出码 ${status}，不阻断构建。`);
  }
  if (highs.length > 0) detail.push(highs.slice(0, 30).join('\n'));
  if (counts && counts.high === 0 && counts.critical === 0) detail.push('没有 high 或 critical。');
  detail.push('Astro 5 的已知公告留到单独的升级，这次只报告。');
  return {title: 'npm audit --audit-level=high（不阻断）', detail: detail.join('\n')};
}

function writeSummary(sections) {
  const markdown = sections.map((section) => `## ${section.title}\n\n${section.detail}`).join('\n\n') + '\n';
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) fs.appendFileSync(summary, markdown);
  console.log(`\n${markdown}`);
}

async function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assertFixedNpmScripts(pkg);
  const sections = [];
  let failed = false;

  try {
    await runSelfTest();
    sections.push({title: '检查器自测', detail: '链接、草稿、RSS、小站清单和类型检查脚本的夹具都按预期失败或通过。'});
  } catch (error) {
    failed = true;
    sections.push({title: '检查器自测失败', detail: error.message});
  }

  try {
    const report = runReleaseChecks(root);
    const hosts = report.bundles.hosts;
    if (!report.catalogue || typeof report.catalogue.entries !== 'number') {
      throw new Error('发布检查没有返回小站清单结果');
    }
    sections.push({
      title: '发布检查',
      detail: [
        `草稿 ${report.content.drafts.length} 篇，来自各集合 frontmatter 的 draft: true：${report.content.drafts.map((entry) => `${entry.collection}/${entry.id}`).join('、') || '无'}。`,
        `RSS 条数 ${report.content.expectedRss}，等于 RSS 页面所引用集合里的非草稿条目。`,
        `小站清单 ${report.catalogue.entries} 条公开或归档条目：状态、地址、封面、生成页面、导航高亮和 sitemap 已核对。`,
        `外链资源主机（src / poster / srcset，只列出，不请求）：${formatHostList(hosts.resources)}。`,
        `外链 href 主机（只列出，不请求）：${formatHostList(hosts.links)}。`,
      ].join('\n'),
    });
  } catch (error) {
    failed = true;
    sections.push({title: '发布检查失败', detail: error.message});
  }

  try {
    const covers = await checkSiteCoverArtwork(root);
    sections.push({title: '入口封面', detail: `${covers.entries} 站 / ${covers.images} 张图片实际解码通过，1200×800 与 600×400。`});
  } catch (error) {
    failed = true;
    sections.push({title: '入口封面失败', detail: error.message});
  }

  const astro = runAstroPolicy();
  if (!astro.ok) failed = true;
  sections.push(astro);

  sections.push(runAudit());
  writeSummary(sections);
  if (failed) process.exit(1);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
