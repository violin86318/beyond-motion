"""Import a bounded, public-only selection. Usage: python3 scripts/curate-studios.py PATH_TO_XXD_WORKSPACE"""
import json, sys, re
from pathlib import Path
from PIL import Image, ImageOps
root=Path(sys.argv[1]); out=Path(__file__).resolve().parents[1]
def save(path,data):
 path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
def image(src,dest,size):
 dest.parent.mkdir(parents=True,exist_ok=True)
 with Image.open(src) as original:
  im=ImageOps.exif_transpose(original).convert('RGB');im.thumbnail((size,size));im.save(dest,'WEBP',quality=82)
for kind in ['wedding','portrait']:
 target=out/'studio-sites'/kind;items=[]
 if kind=='wedding':
  w=root/'wedding-site';shared=json.loads((w/'templates/_shared.json').read_text());shared['fields']['city'].pop('default',None);shared['fields']['city']['placeholder']='婚礼所在城市'
  templates=sorted([json.loads(p.read_text()) for p in (w/'templates').glob('*.json') if not p.name.startswith(('vip-','_'))],key=lambda x:(x.get('order',999),x['id']))
  for cat in ['announce','invite','retouch']:
   chosen=[t for t in templates if t['category']==cat][:10]
   for t in chosen:
    src=next((w/'public/samples').glob(t['id']+'.*'))
    t={k:t[k] for k in ['id','category','name','description','photo','fields','prompt']}
    overrides={
     'announce-la-retro-travel':('海风复古字弧','海风、胶片与跳动的弧线标题，做一张明亮轻松的婚讯卡。'),
     'announce-magazine':('杂志大字叠影','香槟色留白与大字标题，让婚礼主视觉像一本纪念杂志。'),
     'announce-cn-red-gold':('金字帘幕','深色帘幕与浅金字，把正式邀约写得隆重而克制。'),
     'announce-giant-flower':('巨花留白','放大的花与轻盈留白，让戒指和相拥的细节成为故事主角。'),
     'invite-cn-classic':('端庄圆窗','喜红、浅金与圆窗合影，适合正式的中式电子请柬。'),
     'invite-ivory-letterpress':('留白手写','清水蓝线描与近白纸面，把姓名写成请柬的主角。'),
     'invite-bilingual-modern':('晨光胶片分格','浅杏色胶片切片与生活细节，让牵手的瞬间跨过画面边界。'),
     'invite-triptych-bold':('晴日三幕','三张晴日片段拼成一封请柬，留出清楚的姓名、日期与地点。'),
     'invite-old-journal':('旧纸黑白','旧纸与黑白大照，安静的墨色字，记录一场有年代感的婚礼。'),
     'retouch-hollywood-bw':('黑白面纱','黑白纪实、轻纱和拱廊，保留自然笑颜与瞬间的亲密。'),
     'retouch-oil-painting':('花影油彩','用明净油彩描绘携手穿过花影的瞬间，轻盈而有纪念感。'),
     'retouch-garden-glimpse':('墨绿庭园','老建筑、墨绿庭园与三幕旧影，捕捉新人走动时的自然神情。'),
    }
    if t['id'] in overrides:t['name'],t['description']=overrides[t['id']]
    for key,value in t['prompt'].items():
     if isinstance(value,str):t['prompt'][key]=re.sub(r'当一组样张风格的提示词不足4个的时候，请补充到4个。保留源风格，不改变根提示词。\s*','',value)
    t.update(image=f"images/{t['id']}.webp",thumb=f"thumbs/{t['id']}.webp")
    image(src,target/t['image'],1200);image(src,target/t['thumb'],480);items.append(t)
  save(target/'data.json',{'kind':kind,'items':items,'shared':shared})
  # The shared prompt assembler is maintained in this repository.
  image(w/'public/samples/invite-frame-doodle.jpg',out/'public/studio/wedding.webp',1000)
 else:
  p=root/'photography-site/public';catalog=json.loads((p/'catalog.json').read_text())
  for t in [i for i in catalog['items'] if i.get('curated')]:
   detail=json.loads((p/'prompts'/f"{t['id']}.json").read_text());variants=[]
   for i,v in enumerate([v for v in detail['variants'] if v.get('image') and (p/v['image']).is_file()][:2]):
    name=f"{t['id']}-{i+1}";full=f'images/{name}.webp';thumb=f'thumbs/{name}.webp'
    image(p/v['image'],target/full,1200);image(p/v['image'],target/thumb,480)
    variants.append({'title':v['title'],'image':full,'thumb':thumb,'prompt':v.get('content') or '\n\n'.join([v.get('basePrompt') or detail['basePrompt'],v.get('scenario','')])})
   assert variants,t['id']
   items.append({'id':t['id'],'name':t['name'],'category':t['category'],'description':t['topic']+' · '+t['visualType'],'image':variants[0]['image'],'thumb':variants[0]['thumb'],'variants':variants})
  save(target/'data.json',{'kind':kind,'items':items})
  image(target/items[0]['image'],out/'public/studio/portrait.webp',1000)
 print(kind,len(items),'styles')
