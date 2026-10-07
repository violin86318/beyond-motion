// Crop-safe title covers: 1920×1080, with all key information inside the
// centered 1440×1080 (4:3) area. Side bands contain only background.
// Editable coordinates use a 1280×720 viewBox; x=160…1120 is the safe area.
import fs from 'node:fs/promises';
import sharp from 'sharp';

const serif = 'Songti SC, Noto Serif CJK SC, serif';
const sans = 'Hiragino Sans GB, Noto Sans CJK SC, sans-serif';
const mono = 'Menlo, monospace';
const text = (s, x, y, size, color, font = sans, extra = '') => `<text x="${x}" y="${y}" fill="${color}" font-family="${font}" font-size="${size}" ${extra}>${s}</text>`;
const frame = (title, content, bg, w = 1280, h = 720) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img"><title>${title}</title><defs><radialGradient id="glow"><stop stop-color="#ef914b" stop-opacity=".65"/><stop offset="1" stop-color="#ef914b" stop-opacity="0"/></radialGradient><linearGradient id="key" x2=".2" y2="1"><stop stop-color="#ff713a"/><stop offset="1" stop-color="#e34216"/></linearGradient></defs><rect width="${w}" height="${h}" fill="${bg}"/>${content}</svg>`;
const footer = (left, right, color) => `<path d="M228 618H1052" stroke="${color}" opacity=".3"/>${text(left,228,652,16,color,mono)}${text(right,1052,652,16,color,sans,'text-anchor="end"')}`;

// Film negative with contact-sheet perforations and the light of a darkroom.
const film = `<ellipse cx="1010" cy="350" rx="470" ry="470" fill="url(#glow)"/><g transform="translate(868 350) rotate(-14) scale(.73)"><rect x="-210" y="-470" width="430" height="950" rx="12" fill="#0c0b0a" stroke="#986447" stroke-width="2"/>${Array.from({length:14},(_,i)=>`<rect x="-190" y="${-440+i*65}" width="22" height="34" rx="3" fill="#c79870"/><rect x="178" y="${-440+i*65}" width="22" height="34" rx="3" fill="#c79870"/>`).join('')}<rect x="-145" y="-325" width="292" height="565" fill="#391e16" stroke="#ec9b61" stroke-width="2"/><circle cx="0" cy="-50" r="146" fill="#a14c28"/><circle cx="0" cy="-50" r="116" fill="none" stroke="#f6c092" stroke-width="2" opacity=".6"/><path d="M-105 -50H105M0 -155V55" stroke="#f6c092" opacity=".4"/><rect x="-110" y="290" width="220" height="100" fill="#c97b42"/>${text('FIX / 01',-130,220,17,'#f4c39e',mono)}</g>`;
const fix = frame('定影 · FIX：胶片、暗房与显影的光',`${film}${text('A FILM MADE OF CODE',228,92,18,'#cc9b79',mono)}${text('定影',222,346,158,'#efe7d9',serif)}${text('FIX',230,472,98,'#f79652',mono)}${text('让时间，停在这一秒。',232,551,28,'#d1b8a3',serif)}${footer('VIOLIN / ORIGINAL MV','实时视听','#c99a77')}`,'#15100d');

// A sun print: the botanical silhouette, paper border and Prussian blue are the subject.
const leaf = `<g transform="translate(919 490) rotate(-22) scale(1.02)" fill="#d9e8ec" stroke="#d9e8ec"><path d="M0 150C-4 10 -2 -240 10 -380" stroke-width="5" fill="none"/>${Array.from({length:16},(_,i)=>{const y=100-i*28, len=105*Math.sin((i+1)/18*Math.PI)+18;return `<path d="M0 ${y}Q${-len*.7} ${y-5} ${-len} ${y-64}Q${-len*.35} ${y-69} 0 ${y-15}M0 ${y}Q${len*.7} ${y-10} ${len} ${y-72}Q${len*.3} ${y-70} 0 ${y-15}" stroke-width="1"/>`;}).join('')}</g>`;
const blue = frame('定影 · 蓝晒相册：普鲁士蓝上的植物日光印痕',`<rect x="28" y="28" width="1224" height="664" fill="#174a82" stroke="#d7e3e9" stroke-width="2"/><g stroke="#aac9db" fill="none" opacity=".2"><circle cx="914" cy="242" r="156"/><circle cx="914" cy="242" r="172"/><path d="M710 242H1180M914 40V470"/></g>${leaf}${text('SUN PRINTS / SUMMER MEMORY',228,92,17,'#b7d1e2',mono)}${text('定影',225,342,158,'#edf1e8',serif)}${text('蓝晒相册',232,443,54,'#d4e6ea',serif)}${text('把一个夏天，留在蓝里。',232,551,28,'#bfd6e2',serif)}${footer('VIOLIN / CYANOTYPE','音乐影像','#c6dce8')}`,'#e6ece7');

// One large sculptural backspace key rather than the small HUD of an arbitrary shot.
const key = `<g transform="translate(755 390) rotate(-10) scale(.78)"><path d="M-82 -112L314 -112L370 -65V135L315 188H-82L-130 142V-62Z" fill="#7a2215"/><rect x="-130" y="-155" width="500" height="300" rx="32" fill="url(#key)"/><rect x="-111" y="-136" width="462" height="260" rx="23" fill="none" stroke="#ffb58e" stroke-width="2"/><path d="M-40 -6L12 -53H226V45H12Z" fill="none" stroke="#24120e" stroke-width="9" stroke-linejoin="round"/><path d="M89 -31L137 21M137 -31L89 21" stroke="#24120e" stroke-width="9"/>${text('BACKSPACE',-82,95,22,'#32140c',mono)}</g>`;
const backspace = frame('退格键：一枚黑橙色的巨大退格按键',`<g stroke="#d2cbc1" opacity=".07">${Array.from({length:25},(_,i)=>`<path d="M${i*56} 0V720"/>`).join('')}${Array.from({length:14},(_,i)=>`<path d="M0 ${i*56}H1280"/>`).join('')}</g>${key}${text('BKSP—01 / CODE MUSIC VIDEO',228,92,17,'#a9a39b',mono)}${text('退格键',223,334,128,'#eee9df',sans,'font-weight="700"')}${text('BACKSPACE',232,434,40,'#ff713a',mono)}${text('有些话，删掉以后还在。',232,551,28,'#aaa39a',serif)}${footer('VIOLIN / WEBGL × MUSIC','代码 MV','#aaa39a')}`,'#121212');

const windows = (cx,cy,cols,rows,step) => `<g>${Array.from({length:cols*rows},(_,i)=>{const c=i%cols,r=Math.floor(i/cols),on=(i*17+7)%19<9;return `<rect x="${cx+c*step}" y="${cy+r*step}" width="${step*.34}" height="${step*.45}" fill="${on?'#d9bc77':'#5a6570'}" opacity="${on?.55:.16}"/>`;}).join('')}</g>`;
const clock = (x,y,r) => `<g transform="translate(${x} ${y})"><circle r="${r}" fill="#121923" stroke="#9d854e" stroke-width="2"/><circle r="${r-20}" fill="none" stroke="#59606a" opacity=".35"/>${Array.from({length:60},(_,i)=>`<path d="M0 ${-r+8}V${-r+(i%5?16:25)}" transform="rotate(${i*6})" stroke="${i%5?'#52606b':'#d4b66b'}" stroke-width="${i%5?1:2}"/>`).join('')}<path d="M0 0L-18 -${r*.56}M0 0L-12 -${r*.78}" stroke="#e7eceb" stroke-width="5" stroke-linecap="round"/><path d="M0 ${r*.23}V-${r*.81}" stroke="#e5b765" stroke-width="2"/><circle r="6" fill="#e5b765"/></g>`;
const midnight = frame('零点前三十秒：城市灯火与零点倒计时',`${windows(674,90,24,24,24)}${clock(890,320,176)}${text('THIRTY SECONDS TO MIDNIGHT',228,92,17,'#9caab6',mono)}${text('零点前',223,264,106,'#e8e9e3',sans,'font-weight="600"')}${text('三十秒',223,382,106,'#e8e9e3',sans,'font-weight="600"')}${text('−00:00:30',232,480,58,'#efb961',mono)}${text('我听见一万个人的呼吸。',232,551,28,'#acb4bd',serif)}${footer('VIOLIN / CITY × COUNTDOWN','音乐影像','#a7b1bd')}`,'#0b1119');
const midnightPortrait = frame('零点前三十秒：竖版播放封面',`${windows(55,420,28,25,24)}${clock(360,660,246)}${text('VIOLIN / MUSIC VIDEO',52,74,17,'#a7b1bd',mono)}${text('零点前',49,215,93,'#e8e9e3',sans,'font-weight="600"')}${text('三十秒',49,323,93,'#e8e9e3',sans,'font-weight="600"')}${text('−00:00:30',360,1040,72,'#efb961',mono,'text-anchor="middle"')}${text('我听见一万个人的呼吸。',360,1105,26,'#c1c6cc',serif,'text-anchor="middle"')}<path d="M52 1190H668" stroke="#a7b1bd" opacity=".3"/>${text('THIRTY SECONDS TO MIDNIGHT',52,1233,15,'#a7b1bd',mono)}${text('03:14',668,1233,17,'#a7b1bd',mono,'text-anchor="end"')}`,'#0b1119',720,1280);

const exportDir = new URL('../.local-deploy/bilibili-covers/', import.meta.url);
await fs.mkdir(exportDir,{recursive:true});
const works = [['dingying-fix','定影_FIX',fix],['dingying-lanshai','定影_蓝晒相册',blue],['tuigejian-mv','退格键',backspace],['lingdian-mv','零点前三十秒',midnight]];
const previews = [];
for (const [slug, title, svg] of works) {
  const dir = new URL(`../public/w/${slug}/`, import.meta.url);
  await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(new URL('cover-bilibili.svg',dir),svg);
  const raster = await sharp(Buffer.from(svg)).resize(1920,1080).png().toBuffer();
  const jpeg = await sharp(raster).jpeg({quality:92,chromaSubsampling:'4:4:4'}).toBuffer();
  await fs.writeFile(new URL('cover-bilibili.jpg',dir),jpeg);
  await fs.writeFile(new URL(`${title}_16x9.jpg`,exportDir),jpeg);
  const crop = await sharp(raster).extract({left:240,top:0,width:1440,height:1080}).jpeg({quality:92,chromaSubsampling:'4:4:4'}).toBuffer();
  await fs.writeFile(new URL(`${title}_4x3预览.jpg`,exportDir),crop);
  previews.push(`<section><h2>${title.replaceAll('_',' · ')}</h2><div class="comparison"><figure><div class="safe-demo"><img src="${title}_16x9.jpg" alt="16:9 完整封面"/><div class="safe"></div></div><figcaption>16:9 成品 · 虚线内是居中的 4:3 安全区</figcaption></figure><figure><img class="crop" src="${title}_4x3预览.jpg" alt="4:3 中心裁切预览"/><figcaption>4:3 中心裁切 · 标题与主体完整保留</figcaption></figure></div></section>`);
  console.log(`${slug}: 1920×1080 cover + 1440×1080 crop`);
}
// Independent 9:16 website playback cover; not a Bilibili upload asset.
const portraitDir = new URL('../public/w/lingdian-mv/',import.meta.url);
await fs.writeFile(new URL('cover-portrait.svg',portraitDir),midnightPortrait);
await sharp(Buffer.from(midnightPortrait)).jpeg({quality:92,chromaSubsampling:'4:4:4'}).toFile(new URL('cover-portrait.jpg',portraitDir).pathname);
await fs.writeFile(new URL('index.html',exportDir),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>B站封面 · 裁切对照</title><style>*{box-sizing:border-box}body{background:#f4f1e8;color:#191714;font:16px/1.7 system-ui,sans-serif;margin:0;padding:36px}main{max-width:1400px;margin:auto}h1{font-size:32px}section{margin:40px 0;border-top:1px solid #c8c3b8}h2{font-size:22px}.comparison{display:grid;grid-template-columns:4fr 3fr;gap:24px}figure{margin:0}img{display:block;width:100%;height:auto}figcaption{font-size:13px;color:#666;margin-top:10px}.safe-demo{position:relative;overflow:hidden}.safe{position:absolute;inset:0 12.5%;border:2px dashed #fff;box-shadow:0 0 0 999px #0004;pointer-events:none}.crop{aspect-ratio:4/3}@media(max-width:760px){body{padding:20px}.comparison{grid-template-columns:1fr}}</style><main><h1>B站封面 · 16:9 与 4:3 裁切对照</h1><p>上传文件选名称含 <b>16x9</b> 的 JPG。1920×1080 画布的中央 1440×1080 是 4:3 安全区：左右各 240 像素只保留背景延伸。</p>${previews.join('')}</main></html>`);
await fs.writeFile(new URL('使用说明.txt',exportDir),'B站封面成品\n上传名称含 16x9 的 JPG：1920×1080。\n4x3预览文件用于核对裁切，尺寸1440×1080，不必上传。\n安全区：左边界240、右边界1680；左右各240像素仅保留背景。\nindex.html 可离线查看16:9与4:3对照。\n');
