import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const works = defineCollection({
  loader: glob({ pattern: '*/index.md', base: './src/content/works' }),
  schema: z.object({
    title: z.string(),
    draft: z.boolean().default(false),
    type: z.enum(['live', 'video', 'image', 'music']),
    date: z.string(),
    description: z.string(),
    tech: z.array(z.string()),
    featured: z.boolean().default(false),
    url: z.string().optional(), // 已部署的在线版本（live 作品优先使用）
    source: z.string().optional(),
    poster: z.string().optional(),
  }),
});

const notes = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    draft: z.boolean().default(false),
    date: z.string(),
    kind: z.enum(['log', 'piece']),
    description: z.string(),
  }),
});

export const collections = { works, notes };
