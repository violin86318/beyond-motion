import {buildPrompt} from './prompt.js';
const $=s=>document.querySelector(s);
const dialog=$('#editor');
let data,current,trigger,onlySaved=false,category='all';
const key='shiliu-favorites-v1-'+document.body.className;
let saved=new Set();
try{const stored=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(stored))saved=new Set(stored.filter(x=>typeof x==='string'));}catch{}
const labels={announce:'婚礼预告',invite:'邀请函',retouch:'婚纱照焕新',women:'女性写真',men:'男性写真',couple:'双人写真',family:'家庭写真',kids:'儿童写真',editorial:'杂志写真',portrait:'人物肖像',other:'其他'};
const store=()=>{try{localStorage.setItem(key,JSON.stringify([...saved]));}catch{$('#status').textContent='浏览器未允许保存收藏，本次收藏仍可使用。';}};
function filter(){
 const q=$('#search').value.trim().toLowerCase();let count=0;
 for(const card of document.querySelectorAll('.card')){const item=data.items.find(x=>x.id===card.dataset.id);const show=(category==='all'||item.category===category)&&(!onlySaved||saved.has(item.id))&&(`${item.name} ${item.description}`.toLowerCase().includes(q));card.hidden=!show;if(show)count++;}
 $('#count').textContent=`${count} / ${data.items.length} 款精选风格`;$('#empty').hidden=count>0;
}
function favoriteState(){$('#favorite').setAttribute('aria-pressed',String(saved.has(current.id)));$('#favorite').textContent=saved.has(current.id)?'已收藏 · 点击取消':'收藏这个风格';}
function addField(key,def){
 const label=document.createElement('label');label.textContent=def.label+(def.required?' *':'');
 const input=document.createElement(def.type==='textarea'?'textarea':'input');input.name=key;input.id='field-'+key;
 if(def.type==='textarea'){input.rows=3;label.className='wide';}else input.type=['date','time'].includes(def.type)?def.type:'text';
 input.required=!!def.required;if(def.max)input.maxLength=def.max;input.placeholder=def.placeholder||'';label.append(input);$('#fields').append(label);
}
function open(item,button){
 current=item;trigger=button;$('#dialog-title').textContent=item.name;$('#description').textContent=item.description;$('#sample').src=item.image;$('#sample').alt=item.name+'参考样片';$('#fields').replaceChildren();$('#result').hidden=true;$('#prompt-output').value='';$('#status').textContent='';$('#variant').replaceChildren();
 const wedding=data.kind==='wedding';$('#variant-label').hidden=wedding;
 if(wedding){for(const key of item.fields)addField(key,data.shared.fields[key]||{label:key});$('#photo-note').textContent=item.photo==='required'?'此风格需要参考照片。生成图片时，请在你选择的图像工具中附上照片；本站不收取照片。':'可以直接带走文字提示词，无需上传照片。';}
 else{item.variants.forEach((v,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=v.title;$('#variant').append(option);});addField('notes',{label:'你的画面与文案要求',type:'textarea',max:1000,placeholder:'例如：柔和窗光，保留自然肤色；封面标题…'});$('#photo-note').textContent='如需保留人物身份，请在你选择的图像工具中添加自己的参考照片。';}
 favoriteState();dialog.showModal();
}
$('#close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>trigger?.focus());
$('#variant').addEventListener('change',()=>{$('#sample').src=current.variants[Number($('#variant').value)].image;$('#result').hidden=true;});
$('#favorite').addEventListener('click',()=>{saved.has(current.id)?saved.delete(current.id):saved.add(current.id);store();favoriteState();filter();});
$('#saved').addEventListener('click',()=>{onlySaved=!onlySaved;$('#saved').setAttribute('aria-pressed',String(onlySaved));filter();});
$('#clear-saved').addEventListener('click',()=>{saved.clear();store();filter();});
$('#search').addEventListener('input',filter);
$('#prompt-form').addEventListener('submit',e=>{
 e.preventDefault();const input=Object.fromEntries(new FormData(e.currentTarget));
 const prompt=data.kind==='wedding'?buildPrompt(current,input,data.shared,{hasPhoto:current.photo==='required'}).prompt:current.variants[Number($('#variant').value)].prompt+(String(input.notes||'').trim()?'\n\n我的要求：\n'+String(input.notes).trim():'');
 $('#prompt-output').value=prompt;$('#result').hidden=false;$('#status').textContent='提示词已组装，可编辑后复制。';$('#prompt-output').focus();
});
$('#copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#prompt-output').value);$('#status').textContent='已复制。请到你选择的图像工具中粘贴。';}catch{$('#prompt-output').focus();$('#prompt-output').select();$('#status').textContent='未取得剪贴板权限，文字已选中，请手动复制。';}});
$('#download').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([$('#prompt-output').value],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=current.name+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
try{
 const response=await fetch('/data.json');if(!response.ok)throw new Error('catalog');data=await response.json();
 for(const cat of ['all',...new Set(data.items.map(i=>i.category))]){const b=document.createElement('button');b.textContent=cat==='all'?'全部':labels[cat]||cat;b.setAttribute('aria-pressed',String(cat==='all'));b.addEventListener('click',()=>{category=cat;$('#filters').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));filter();});$('#filters').append(b);}
 for(const card of document.querySelectorAll('.card')){const item=data.items.find(x=>x.id===card.dataset.id);const a=card.querySelector('a');a.addEventListener('click',e=>{e.preventDefault();open(item,a);});const b=document.createElement('button');b.textContent='使用这个风格 ↗';b.addEventListener('click',()=>open(item,b));card.querySelector('.card-actions').prepend(b);}
 $('.tools').hidden=false;
}catch{$('#count').textContent='编辑工具暂时未加载，请刷新重试；样片仍可浏览。';}
