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
poster: /w/example/poster.webp
---

创作手记。
```

图片、音频等放到 `public/w/<slug>/`。网页作品可用外部 `url` 或本地 `index.html`；视频可用外部 `url` 或本地 `video.mp4`；音乐可用本地 `audio.mp3`。只在作品可用后移除草稿状态。首页《定影》为人工编排的编辑精选，更新时修改 `src/pages/index.astro`。

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
