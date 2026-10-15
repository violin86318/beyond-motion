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
function showSample(item,variantIndex=0){
 const variant=item.variants?.[variantIndex];
 $('#sample').src=variant?.image||item.image;
 $('#sample').alt=(variant?.title||item.name)+'参考样片';
}
function open(item,button){
 current=item;trigger=button;$('#dialog-title').textContent=item.name;$('#description').textContent=item.description;$('#status').textContent='';$('#variant').replaceChildren();
 const variants=item.variants||[];$('#variant-label').hidden=variants.length<2;
 variants.forEach((v,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=v.title;$('#variant').append(option);});
 showSample(item,0);favoriteState();dialog.showModal();
}
$('#close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>trigger?.focus());
$('#variant').addEventListener('change',()=>showSample(current,Number($('#variant').value)));
$('#favorite').addEventListener('click',()=>{saved.has(current.id)?saved.delete(current.id):saved.add(current.id);store();favoriteState();filter();});
$('#saved').addEventListener('click',()=>{onlySaved=!onlySaved;$('#saved').setAttribute('aria-pressed',String(onlySaved));filter();});
$('#clear-saved').addEventListener('click',()=>{saved.clear();store();filter();});
$('#search').addEventListener('input',filter);
try{
 const response=await fetch('/data.json');if(!response.ok)throw new Error('catalog');data=await response.json();
 for(const cat of ['all',...new Set(data.items.map(i=>i.category))]){const b=document.createElement('button');b.textContent=cat==='all'?'全部':labels[cat]||cat;b.setAttribute('aria-pressed',String(cat==='all'));b.addEventListener('click',()=>{category=cat;$('#filters').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));filter();});$('#filters').append(b);}
 for(const card of document.querySelectorAll('.card')){const item=data.items.find(x=>x.id===card.dataset.id);const a=card.querySelector('a');a.addEventListener('click',e=>{e.preventDefault();open(item,a);});const b=document.createElement('button');b.textContent='查看样片';b.addEventListener('click',()=>open(item,b));card.querySelector('.card-actions').prepend(b);}
 $('.tools').hidden=false;
}catch{$('#count').textContent='风格库暂时未加载，请刷新重试；样片仍可浏览。';}
