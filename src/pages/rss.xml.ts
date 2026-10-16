import { getCollection } from 'astro:content';
const xml=(s:string)=>s.replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]!));
export async function GET(){
 // Month-only dates use the first day of that month at 00:00 UTC.
 // Keep historical GUIDs opaque and unchanged so readers do not re-import posts.
 const notes=(await getCollection('notes',({data})=>!data.draft)).sort((a,b)=>b.data.date.localeCompare(a.data.date));
 return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>violin · 文章与手记</title><link>https://beyondmotion.net/notes/</link><description>影像、音乐与 AI 协作的创作手记</description><language>zh-CN</language>${notes.map(n=>`<item><title>${xml(n.data.title)}</title><link>https://beyondmotion.net/notes/${n.id}/</link><guid isPermaLink="false">https://beyondmotion.net/notes/${n.id}</guid><pubDate>${new Date(n.data.date).toUTCString()}</pubDate><description>${xml(n.data.description)}</description></item>`).join('')}</channel></rss>`,{headers:{'Content-Type':'application/rss+xml; charset=utf-8'}});
}
