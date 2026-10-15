import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// 源码 data.json 仍保留配方，供本地核对。公开产物只留样片与说明。
const PUBLIC_RECIPE_KEYS=new Set(['prompt','soup','photoUse','noPhoto','slots','photoLock','textRule','globalNegative']);
function publicCatalog(value){
 if(Array.isArray(value))return value.map(publicCatalog);
 if(!value||typeof value!=='object')return value;
 const next={};
 for(const [key,child] of Object.entries(value)){
  if(PUBLIC_RECIPE_KEYS.has(key))continue;
  next[key]=publicCatalog(child);
 }
 return next;
}
const configs={wedding:{title:'石榴婚礼',headline:'重要的一天，<br>有自己的样子。',desc:'婚礼预告、邀请函、婚纱照焕新。公开页面展示精选样片、名称和画面说明。',en:'WEDDING',sibling:'portrait',siblingLabel:'石榴写真',credit:'视觉灵感参考小小东，石榴工作室精选整理样片。'},portrait:{title:'石榴写真',headline:'一束光，<br>另一面的自己。',desc:'24 组精选人像风格。从光线、色彩与情绪出发，公开浏览样片和画面说明。',en:'PORTRAIT',sibling:'wedding',siblingLabel:'石榴婚礼',credit:'写真风格资料与参考样片来自小小东，石榴工作室精选整理。'}};
for(const [kind,c] of Object.entries(configs)){
 const src=path.join(root,'studio-sites',kind),dest=path.join(root,'.studio-dist',kind);fs.rmSync(dest,{recursive:true,force:true});fs.mkdirSync(dest,{recursive:true});
 const data=publicCatalog(JSON.parse(fs.readFileSync(path.join(src,'data.json'),'utf8')));
 const published=JSON.stringify(data);
 for(const key of PUBLIC_RECIPE_KEYS){if(published.includes(`"${key}"`))throw new Error(`${kind} public data.json still contains ${key}`);}
 fs.writeFileSync(path.join(dest,'data.json'),published);
 for(const name of ['images','thumbs'])fs.cpSync(path.join(src,name),path.join(dest,name),{recursive:true});
 for(const name of ['styles.css','app.js'])fs.copyFileSync(path.join(root,'studio-sites/shared',name),path.join(dest,name));
 let html=fs.readFileSync(path.join(root,'studio-sites/shared/index.html'),'utf8');
 const cards=data.items.map((i,n)=>`<article class="card" data-id="${escape(i.id)}"><a href="/${escape(i.image)}"><img src="/${escape(i.thumb)}" alt="${escape(i.name)}参考样片" loading="lazy" width="480" height="640"><h3>${escape(i.name)}</h3><p>${escape(i.description)}</p></a><div class="card-actions"><span>NO.${String(n+1).padStart(2,'0')}</span></div></article>`).join('\n');
 const tokens={TITLE:c.title,DESC:c.desc,KIND:kind,EN:c.en,HOST:`${kind}.beyondmotion.net`,HEADLINE:c.headline,COUNT:data.items.length,HERO:data.items[0].image,SIBLING:`https://${c.sibling}.beyondmotion.net`,SIBLING_LABEL:c.siblingLabel,CREDIT:c.credit,CARDS:cards};
 html=html.replace(/__([A-Z_]+)__/g,(_,k)=>tokens[k]);fs.writeFileSync(path.join(dest,'index.html'),html);
 fs.copyFileSync(path.join(root,'public/_headers'),path.join(dest,'_headers'));
 fs.writeFileSync(path.join(dest,'404.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>页面未找到</title><h1>这张灵感页还不存在。</h1><a href="/">返回${c.title}</a></html>`);
 fs.writeFileSync(path.join(dest,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: https://${kind}.beyondmotion.net/sitemap.xml\n`);
 fs.writeFileSync(path.join(dest,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://${kind}.beyondmotion.net/</loc></url></urlset>`);
 console.log(`${kind}: ${data.items.length} styles → ${dest}`);
}
