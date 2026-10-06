import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {buildPrompt} from '../studio-sites/shared/prompt.js';
const root=path.resolve(import.meta.dirname,'..');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
for(const folder of ['dist','.studio-dist/wedding','.studio-dist/portrait']){
 const dir=path.join(root,folder),files=walk(dir);assert(files.length<20000);
 for(const file of files){assert(fs.statSync(file).size<=25*1024*1024,file);assert(!file.includes('.env'),file);
  if(/\.(html|js|json)$/.test(file))assert(!/\/Users\/|Bearer |CLOUDFLARE_API_TOKEN|api\/generate|api\/object/.test(fs.readFileSync(file,'utf8')),`private or server reference: ${file}`);
 }
 for(const file of files.filter(f=>f.endsWith('.html'))){const html=fs.readFileSync(file,'utf8');for(const [,ref]of html.matchAll(/(?:href|src)="([^"#?]+)(?:[?#][^"]*)?"/g)){
  if(/^(https?:|data:|mailto:)/.test(ref))continue;const target=path.join(dir,ref.replace(/^\//,''));assert(fs.existsSync(target)||fs.existsSync(path.join(target,'index.html')),`${folder}: missing ${ref}`);
 }}
 console.log(`${folder}: assets, links and Pages limits passed (${files.length} files)`);
}
for(const draft of ['signal-study','untitled-mv'])assert(!fs.existsSync(path.join(root,'dist/works',draft)),`draft published: ${draft}`);
const feed=fs.readFileSync(path.join(root,'dist/rss.xml'),'utf8');assert.equal((feed.match(/<item>/g)||[]).length,5);
for(const kind of ['wedding','portrait']){
 const dir=path.join(root,'.studio-dist',kind),data=JSON.parse(fs.readFileSync(path.join(dir,'data.json'),'utf8'));assert.equal(data.items.length,kind==='wedding'?30:24);
 assert.equal(new Set(data.items.map(i=>i.id)).size,data.items.length);
 for(const item of data.items){for(const p of [item.image,item.thumb,...(item.variants||[]).flatMap(v=>[v.image,v.thumb])])assert(fs.existsSync(path.join(dir,p)),p);
  if(kind==='wedding'){
   const input=Object.fromEntries(item.fields.map(k=>[k,k==='date'?'2026-11-21':k==='time'?'18:30':k==='name1'?'林知远':k==='name2'?'陈晚晴':k==='name1En'?'Zhiyuan':k==='name2En'?'Wanqing':'测试内容']));const result=buildPrompt(item,input,data.shared,{hasPhoto:item.photo==='required'}).prompt;
   assert(result.length>150);assert(!/\{\{|当一组样张/.test(result));
   if(item.fields.includes('name1'))assert(result.includes('林知远')||result.includes('Zhiyuan'),`names missing: ${item.id}`);
  }else for(const v of item.variants)assert(v.prompt.length>150);
 }
}
console.log('Draft exclusion, RSS articles and all 54 prompt templates passed.');

const wedding=JSON.parse(fs.readFileSync(path.join(root,'studio-sites/wedding/data.json'),'utf8'));
const partial=buildPrompt(wedding.items.find(i=>i.id==='announce-premiere'),{name1:'林知远',name2:'陈晚晴',date:'2026-11-21'},wedding.shared,{hasPhoto:true}).prompt;
assert(partial.includes('2026年11月21日'),'Required date disappears when optional location is empty');
console.log('Optional location keeps required wedding date.');
