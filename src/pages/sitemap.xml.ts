import {getCollection} from 'astro:content';
export async function GET(){
 const notes=await getCollection('notes',({data})=>!data.draft); const works=await getCollection('works',({data})=>!data.draft);
 const paths=['','works','notes','music','studio','about','privacy',...notes.map(n=>`notes/${n.id}`),...works.map(w=>`works/${w.id}`)];
 return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(p=>`<url><loc>https://beyondmotion.net/${p}</loc></url>`).join('')}</urlset>`,{headers:{'Content-Type':'application/xml'}});
}
