# violin · Beyond-Motion

个人创作门户 + 石榴婚礼、石榴写真两个精选小站。主站采用 Astro 静态构建；小站为原生 HTML/CSS/JS，不需要数据库或图像 API。

## 线上地址

| 网站 | 正式域名 | Pages 备用地址 |
|---|---|---|
| 个人门户 | https://beyondmotion.net | https://beyond-motion.pages.dev |
| 石榴婚礼（30 款） | https://wedding.beyondmotion.net | https://shiliu-wedding.pages.dev |
| 石榴写真（24 组） | https://portrait.beyondmotion.net | https://shiliu-portrait.pages.dev |

门户音乐页是 `/music/`。页内「专辑听室」指向 https://music.beyondmotion.net ，写明 4 组主题选集、合计 16 首：六月之后 4 首、便利店，夜还亮着 6 首、记忆的暗房 3 首、尚未说出口 3 首。另有 6 首带手记的曲目链到同一听室。灵感音乐、番茄音乐报和风格听室继续独立运行，地址分别是 https://music.1986318.xyz/ 、https://tomato.1986318.xyz/ 、https://style.1986318.xyz/ 。首页的音乐按钮进入站内 `/music/`，不直接打开听室。视频作品已接入《定影》、蓝晒相册、《退格键》和《零点前三十秒》。视觉日刊「纸上片刻」以公开外站列入小站清单，地址为 https://zine-1986318.pages.dev/ 。

## 开发与检查

```sh
npm ci
npm run dev -- --port 7101
npm run build:all
npm run check
npm run check:astro
```

`npm run dev -- --port 7101` 是开发入口，改完页面可以立即查看。`dist/` 为主站产物；`.studio-dist/wedding/` 与 `.studio-dist/portrait/` 为两个小站的独立产物，均忽略进 Git。`npm run check` 检查已经构建的页面：内部链接、图片路径、草稿排除、RSS、所有模板及 Pages 文件限制。`npm run check:astro` 另做 Astro 类型诊断，覆盖 `.astro` 模板和相关脚本；它不读取 `dist/`，也不代替发布检查。

### 7102 静态预览

静态预览打开的是已经构建好的主站，地址为 http://127.0.0.1:7102 。在前台启动即可，不要注册开机启动项、后台服务或进程守护。

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 7102
```

需要连同两个石榴小站的产物一起准备时，把 `npm run build` 换成 `npm run build:all`。预览进程只提供主站 `dist/`。

停止：回到运行预览的那个终端，按 Ctrl+C。进程结束后即停止，不需要另外的停止命令。

重启电脑之后：预览不会自己恢复。进入项目目录，重新执行上面的构建和预览命令。`dist/` 还在且源码没有改动时，只执行预览那一行即可。

## 门户结构与新增小站

首页保留个人介绍、代表作品、最近文章与音乐，并从清单中取最多三个精选小站。导航固定为创作 `/works/`、阅读 `/reading/`、工具 `/tools/`、全部小站 `/sites/`、关于 `/about/`。旧文章、音乐、工作室和详情地址继续使用。

新增独立小站时，只需在 `src/data/sites.json` 添加一条资料：

```json
{
  "id": "new-site",
  "name": "小站名称",
  "description": "告诉访问者这里能看什么、做什么。",
  "category": "reading",
  "tags": ["编译"],
  "url": "https://notes.beyondmotion.net/",
  "cover": null,
  "coverAlt": "",
  "status": "draft",
  "featured": false,
  "order": 110
}
```

- `category` 为 `creative`（创作）、`reading`（阅读）或 `tools`（工具）。对应栏目和总目录自动收录，无需增加一级导航。
- 图片放进 `public/sites/`，引用如 `/sites/new-site.webp`，并填写 `coverAlt`。封面以 3:2 容器完整显示；`cover: null` 会生成站名排字封面。现有日刊、音乐和编译封面为固定的公开选图，不自动更新。
- `status` 为 `public` 时公开；`draft` 不展示；`archived` 在目录与栏目中标记“已归档”，不进入首页精选。
- `featured: true` 进入首页候选；按 `order` 从小到大取前三条，同序按 ID 排序。条目在所有页面共用 `SiteCard`。
- URL 采用站内路径（如 `/reading/`）或完整 HTTPS 地址。`https://beyondmotion.net/...`（不含 `www` 和其他子域名）与主站同域，卡片转成站内路径，并在当前窗口打开。外链主机必须在白名单内：`beyondmotion.net` 及其子域名，以及清单里已经在用的 `zine-1986318.pages.dev`、`aihot.1986318.xyz`、`horizon.1986318.xyz`、`music.1986318.xyz`、`style.1986318.xyz`、`tomato.1986318.xyz`。不在白名单里的主机会让构建和 `npm run check` 失败；`pages.dev` 不是整段后缀放行。外链卡片在新窗口打开，保留“在新窗口打开”的提示，并显示目标主机名。去重前会折叠路径中的重复斜杠并去掉尾斜杠，因此 `https://music.beyondmotion.net/album//` 与 `https://music.beyondmotion.net/album` 视为同一地址。重复 ID、重复地址或非法 URL 会使构建失败。检查还覆盖封面存在、分类与首页一致、导航高亮，以及相对地址、同域完整地址、白名单外链和被拒绝的主机。

修改后执行 `npm run build:all && npm run check`，再用 `npm run check:astro` 看类型诊断。开发时用 `npm run dev -- --port 7101`；要看构建结果时，按上面的 7102 静态预览启动。子站的内容和功能继续在各自项目维护；单篇文章、单首歌和单件作品仍使用原集合。代码提交与正式发布分开执行。

## 发布文章

在 `src/content/notes/` 创建英文短文件名的 Markdown，例如 `a-new-question.md`：

```yaml
---
title: "文章标题"
date: "2026-10"
kind: piece # piece 文章 / log 创作手记
description: "一句简短摘要，供文章列表、分享卡片和 RSS 使用。"
draft: true
---

正文从这里开始。
```

写完并检查后，把 `draft` 改为 `false`。文章目录、首页最近文章、RSS 和 sitemap 会随构建更新。图片放在 `public/notes/<文章名>/`，正文以 `/notes/<文章名>/cover.webp` 引用。请先压缩图片，优先 WebP。

只更新主站时：

```sh
npm run build
npm run check
wrangler whoami
npm run deploy:main
```

如果刚克隆仓库，先执行一次 `npm run build:all`，让检查所需的两个小站产物就绪。当前采用命令部署，**Git push 本身不会触发 Pages 发布**。

## 新增作品

建立 `src/content/works/<slug>/index.md`：

```yaml
---
title: "作品标题"
type: live # live / video / image / music
date: "2026-10"
description: "作品介绍"
tech: [创作方法]
draft: true
url: https://example.com # 网页作品或外部视频地址，可选
poster: /w/example/cover-bilibili.jpg
posterAlt: "主题封面的画面说明"
stagePoster: /w/example/cover-portrait.jpg # 可选，竖屏播放区域使用
duration: "03:14" # 可选
orientation: landscape # landscape 横屏 / portrait 竖屏
---

创作手记。
```

图片、音频等放到 `public/w/<slug>/`。网页作品可用外部 `url` 或本地 `index.html`；视频可用外部 `url` 或本地 `video.mp4`；音乐可用本地 `audio.mp3`。只在作品可用后移除草稿状态。首页《定影》主视觉为人工编排；其他 `featured: true` 的作品自动进入「继续看片」区域。

封面采用独立的主题构图，不从音乐时间线任意截帧。首页与作品列表统一用 16:9；竖屏作品另用 `stagePoster` 的 9:16 构图。播放按钮在封面之外，加载前后保留画面比例。「返回封面」会移除 iframe 并停止内嵌作品。分享图使用同一横版 JPEG。

四张封面的可编辑构图在 `scripts/build-work-covers.mjs`；运行 `node scripts/build-work-covers.mjs` 会重新生成 `public/w/` 中的 `cover-bilibili.svg` 与 JPEG，并生成本机 `.local-deploy/bilibili-covers/` 的上传成品、裁切预览与离线对照页。需要本机有中文字体。页面上这些图是标题封面，不是 MV 截帧。

横版成品为 1920×1080（16:9）。重要标题、说明与主题主体位于居中的 1440×1080（4:3）安全区内：左右各 240 像素用于延伸背景。作品列表与播放器仍按作品本身的比例展示。B站上传用名称含 `16x9` 的 JPG，`4x3预览` 用于检查中心裁切。安全区虚线仅出现在对照页，不进入成品。

### 原作品页的封面

`player-sites/<slug>/index.html` 保存四个作品页的新首屏与播放控制；`player-sites/title-cover.css` 共用封面样式。原 MV 引擎、音频与影像继续使用原工程中的公开文件，部署时按清单复制，不复制任何父目录。

本机 `.local-deploy/player-sources.json` 保存原站点目录映射（不提交 Git）。新机器需要自行创建同结构 JSON，四个键为 `dingying-fix`、`dingying-lanshai`、`tuigejian-mv`、`lingdian-mv`，值为各原站点目录。

```sh
python3 scripts/build-player-sites.py .local-deploy/player-sources.json
wrangler pages deploy .local-deploy/players/dingying-fix --project-name=dingying-mv --branch=main
wrangler pages deploy .local-deploy/players/dingying-lanshai --project-name=dingying-lanshai --branch=main
wrangler pages deploy .local-deploy/players/tuigejian-mv --project-name=tuigejian-mv --branch=main
wrangler pages deploy .local-deploy/players/lingdian-mv --project-name=lingdian-mv --branch=main
```

原作品页独立打开时显示主题封面；门户点击播放时用 `autoplay=1` 请求从头播放。如果浏览器限制声音，保留封面按钮供再次点击。蓝晒相册字体随站点发布，避免依赖在线字体请求。

蓝晒相册原始中文字体约 25 MB，发布的 WOFF2 字形子集约 152 KB，另附 30 KB 的英文斜体与 OFL 许可。修改蓝晒歌词或字幕后，用安装了 `fonttools`、`brotli` 的 Python 运行 `scripts/subset-cyanotype-fonts.py <蓝晒原站点目录>` 更新子集，再构建原作品页。

## 石榴精选版

`studio-sites/wedding/`、`studio-sites/portrait/` 保存已选定的公开数据与压缩样片；`studio-sites/shared/` 保存共用页面、样式与提示词组装逻辑。构建不依赖原始素材库。

婚礼版：3 个分类，每类 10 款。写真版：24 组，每组最多 2 张参考样片。浏览、搜索、收藏和提示词复制均在浏览器中完成，无登录、照片上传或在线图像生成。收藏只保存在当前设备，输入刷新后清除。

重新从本地原项目整理选集（需要 Pillow）：

```sh
python3 scripts/curate-studios.py /path/to/小小东工作区
npm run build:all
npm run check
```

脚本读取婚礼原项目和写真原项目的既有精选项，生成缩略图和最大边 1200px 的 WebP；不修改原始文件。精选资料保留小小东来源说明。新增素材应核对授权和公开范围。

## 免费部署与费用

三个项目部署到 Cloudflare Pages，当前内容不需要额外付费服务、R2、数据库、服务器或 Product Pass。域名仍需按注册商规则续费；独立音乐站的原有托管及存储费用另算。外部图像工具由访问者自行选择。

部署所有网站：

```sh
npm run deploy:all
```

使用现有 Cloudflare 登录或从环境读取 API Token；不要把令牌写进仓库。脚本先核对账号，再构建检查并发布。单独发布小站使用 `npm run deploy:wedding` 或 `npm run deploy:portrait`。

## 迁移与恢复

主站和两个小站都是可复制的静态文件，可迁移至其他免费静态托管。迁移时创建新项目、上传对应产物、绑定同一域名、切换 DNS 并验证 HTTPS。浏览器收藏按网站域名保存，继续使用同一正式域名通常可保留；Pages 备用地址中的收藏不与正式域名同步。

网站不依赖试用积分或首次注册优惠。Product Pass 应按服务商当前条款使用，更换账号不等于重新获得首次用户资格。优惠结束后，先检查实际用量；静态门户无需为了优惠每年迁移账号。

Pages 控制台保留部署版本，可回滚上一版。上线前记录的旧 DNS 在本机 `.local-deploy/dns-before.json`，该目录不上传到 Git。
