# violin · Beyond-Motion

个人创作门户 + 石榴婚礼、石榴写真两个精选小站。主站采用 Astro 静态构建；小站为原生 HTML/CSS/JS，不需要数据库或图像 API。

## 线上地址

| 网站 | 正式域名 | Pages 备用地址 |
|---|---|---|
| 个人门户 | https://beyondmotion.net | https://beyond-motion.pages.dev |
| 石榴婚礼（30 款） | https://wedding.beyondmotion.net | https://shiliu-wedding.pages.dev |
| 石榴写真（24 组） | https://portrait.beyondmotion.net | https://shiliu-portrait.pages.dev |

音乐继续由 https://music.1986318.xyz 承载，主站提供入口；视频作品提供《定影》播放与 Bilibili 入口。海报小站保留在原工作区，暂不部署。

## 开发与检查

```sh
npm ci
npm run dev -- --port 7101
npm run build:all
npm run check
```

`dist/` 为主站产物；`.studio-dist/wedding/` 与 `.studio-dist/portrait/` 为两个小站的独立产物，均忽略进 Git。检查涵盖内部链接、图片路径、草稿排除、RSS、所有模板及 Pages 文件限制。

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
