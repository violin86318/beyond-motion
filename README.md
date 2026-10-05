# violin · beyondmotion — 个人网站

代码即作品。Astro 5 静态站，139 线性编码视觉系统。

## 开发

```bash
npm install
npm run dev        # 本地开发预览
npm run build      # 产出静态文件到 dist/
npm run preview    # 预览构建产物
```

## 新增一件作品

1. 建目录 `src/content/works/<slug>/index.md`，frontmatter：

```yaml
---
title: 作品名
type: live        # live 网页直接运行 | video 成片 | image 图像 | music 音乐
date: "2026-10"
description: 一句话说明
tech: [技术栈, 逐项列出]
featured: true    # 是否上首页精选
source: https://...   # 源码链接，可选
---

创作手记正文（Markdown）。
```

2. 把作品文件放进 `public/w/<slug>/`：
   - live 类：`index.html` + 资产（相对路径引用）
   - video 类：`video.mp4`（可选 `poster` 海报帧）
   - music 类：`audio.mp3`
3. `npm run build` 即可，无需改任何代码。

新增手记：在 `src/content/notes/` 加一个 `.md` 文件（frontmatter: `title, date, kind: log|piece, description`）。

## 部署

构建产物 `dist/` 是纯静态文件，可放到任何静态托管：

- **Vercel**：`npm i -g vercel && vercel deploy dist --prod`
- **GitHub Pages**：把 `dist/` 推到仓库 `gh-pages` 分支，或用 Actions 自动构建
- **Cloudflare Pages / Netlify**：拖入 `dist/` 或连接仓库（构建命令 `npm run build`，输出目录 `dist`）
