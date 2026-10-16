// Designed 3:2 entry artwork. Source images stay in their original projects;
// this script lays them out with original vector illustration and typography.
// Runs offline with the existing sharp dependency: npm run covers:sites
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = new URL('../', import.meta.url);
const output = new URL('public/sites/covers/', root);
const serif = 'Songti SC, Noto Serif CJK SC, serif';
const sans = 'Hiragino Sans GB, Noto Sans CJK SC, sans-serif';
const mono = 'Menlo, monospace';
const ink = '#22291f', paper = '#f3eddf';
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const text = (value, x, y, size, color = ink, font = serif, extra = '') => `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" fill="${color}" ${extra}>${esc(value)}</text>`;
const line = (x1, y1, x2, y2, color, width = 1) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${color}" stroke-width="${width}"/>`;
const rect = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
const circle = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
const turn = (body, degrees, x, y) => `<g transform="rotate(${degrees} ${x} ${y})">${body}</g>`;
const image = async (path, x, y, w, h, fit = 'cover') => {
  const bytes = await sharp(fileURLToPath(new URL(path, root))).resize(w, h, { fit, background: paper }).jpeg({ quality: 91 }).toBuffer();
  return `<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/jpeg;base64,${bytes.toString('base64')}"/>`;
};
const label = (s, x, y, color = ink, size = 21) => text(s, x, y, size, color, mono, 'letter-spacing="2"');
const frame = (title, background, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><title>${esc(title)}</title>${rect(0, 0, 1200, 800, background)}${body}</svg>`;
const covers = new Map();

// A botanical journal: the actual zine page joins a hand-drawn knotweed branch.
const stem = (x, y, angle, scale = 1) => `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${scale})">
  <path d="M0 40Q-30 -200 5 -480M-9 -190Q-90 -260 -110 -320M-3 -300Q65 -330 90 -410" fill="none" stroke="#5a6248" stroke-width="4"/>
  <path d="M-8 -130Q-125 -200 -110 -263Q-10 -230 -8 -130M-5 -260Q94 -330 108 -280Q65 -237 -5 -260M0 -365Q-76 -430 -77 -458Q-8 -436 0 -365" fill="#747d55"/>
  ${[[-110,-320,-18],[5,-480,13],[90,-410,28]].map(([px,py,a]) => `<g transform="translate(${px} ${py}) rotate(${a})">${Array.from({length:16},(_,i)=>circle(Math.sin(i*2.3)*12,-i*6,8-(i/6),'#a6525d',`opacity="${.65+(i%3)*.1}"`)).join('')}</g>`).join('')}</g>`;
const zinePage = await image('public/sites/zine.webp', 654, 107, 350, 592, 'contain');
covers.set('paper-moments', frame('纸上片刻：植物、日刊纸页与蓼花', '#eae4d5', `
  ${rect(0,0,455,800,'#dedfcd')}${label('DAILY ZINE / 一日一词',64,82,'#536047')}
  ${text('纸上',58,272,116)}${text('片刻',58,405,116)}${line(66,468,365,468,'#8b9476')}
  ${text('把日常，收进一页。',65,529,31)}${label('PAPER / PLANTS / TIME',65,735,'#536047',17)}
  ${turn(rect(640,96,376,620,'#c9c2b2'),7,820,400)}${turn(zinePage,7,820,400)}
  ${stem(1010,758,-16,1.12)}${stem(650,816,16,.78)}
  ${rect(1000,71,127,51,'#294a71')}${text('一纸一画',1013,105,25,'#f0eee3')}
`));

// Four real collection sleeves, rather than one song standing in for the site.
let albums = '';
for (let i = 0; i < 4; i++) {
  const x = 584 + (i % 2) * 274, y = 100 + Math.floor(i / 2) * 274;
  albums += rect(x + 9,y + 10,254,254,'#0c100f') + await image(`scripts/site-cover-assets/album-${i+1}.jpg`,x,y,254,254);
}
covers.set('album-room', frame('专辑听室：四张主题选集的唱片架', '#242824', `
  ${Array.from({length:9},(_,i)=>circle(268,391,147+i*15,'none',`stroke="#4a5146" stroke-width="1"`)).join('')}
  ${label('THE LISTENING ROOM',62,79,'#c5c5ad')}${text('专辑',58,278,111,'#f0eadb')}${text('听室',58,403,111,'#f0eadb')}
  ${text('选一张，慢慢听。',65,519,34,'#d7c38f')}${label('A COLLECTION OF SONGS',65,729,'#c5c5ad',17)}
  ${albums}${line(584,690,1112,690,'#7a7f6c')}${text('从一个主题，听见一段故事。',584,736,25,'#d7d4c2')}
`));

// A sound diary: ruled paper, a ribbon, notes and the paths named on the site.
let notes = '';
for (const [x,y] of [[720,350],[813,314],[913,390],[1002,330]]) notes += `<g transform="translate(${x} ${y})">${circle(0,0,13,'#3b4b3f','transform="rotate(-22)"')}<path d="M12 0V-72L45 -83V-59L12 -48" fill="#3b4b3f"/></g>`;
const notebook = `${rect(548,169,552,505,'#b4b3a0')}${rect(533,153,551,504,'#faf3df')}${rect(533,153,35,504,'#d5cbb3')}
  ${Array.from({length:9},(_,i)=>line(597,240+i*43,1045,240+i*43,'#c7c4ab')).join('')}
  ${label('READ / FEEL / WRITE',600,211,'#728168',19)}${notes}
  <path d="M610 491Q670 431 704 485T787 488T860 465T946 472T1035 448" stroke="#ae5536" stroke-width="5" fill="none"/>
  ${text('昨日回响',606,578,31,'#6c775f')}${text('成长编年史',810,578,31,'#6c775f')}
  <path d="M1015 153H1054V303L1035 282L1015 303Z" fill="#b34c31"/>`;
covers.set('inspiration-music', frame('灵感音乐：一份从阅读、观察与成长中写下的声音日记', '#dbe0ce', `
  ${circle(1141,59,276,'#c6cfb7')}${label('A DIARY IN SOUND',65,80,'#53634b')}
  ${text('灵感',58,280,111)}${text('音乐',58,407,111)}${text('生活留下回声。',66,516,34,'#516148')}
  ${turn(notebook,8,810,400)}${label('阅读 · 观察 · 生长',65,733,'#53634b',22)}
  <g transform="translate(1020 601) rotate(39)">${rect(-12,-90,24,207,'#304235')}<path d="M-12 117L0 157L12 117Z" fill="#ad7c3a"/>${line(0,122,0,146,'#304235',2)}</g>
`));

// Tomato as a record: the publication's five musical tastes, not a news feed.
const tomato = `<g transform="translate(873 389) rotate(10)">${circle(0,0,210,'#922d24')}${circle(-10,-12,198,'#e66b45')}
  ${Array.from({length:9},(_,i)=>circle(-10,-12,77+i*12,'none','stroke="#a53d2c" stroke-width="2"')).join('')}
  ${circle(-10,-12,67,'#f1db9d')}${circle(-10,-12,10,'#ab3c2a')}
  <path d="M-29 -190L-99 -211L-43 -235L-50 -289L-4 -247L50 -278L33 -227L93 -202L30 -197L1 -151Z" fill="#344e38"/>
  <path d="M41 -133Q99 -122 121 -71" fill="none" stroke="#f2a17b" stroke-width="9" stroke-linecap="round"/></g>`;
covers.set('tomato-music', frame('番茄音乐报：一颗唱片番茄与五种音乐口味', '#c44d36', `
  ${rect(28,28,1144,744,'none','stroke="#ebc09a"')}${label('TOMATO MUSIC DAILY',63,90,'#f5dfba')}
  ${line(65,120,1135,120,'#e7a783')}${text('番茄',57,288,113,'#ffebc8')}${text('音乐报',57,416,102,'#ffebc8')}
  ${text('给日常，添一点声音。',64,510,32,'#ffe2b6')}${tomato}
  ${line(64,633,1136,633,'#e7a783')}
  ${['广场舞','洗脑流行','伤感情绪','国风古风','家乡与励志'].map((s,i)=>text(s,65+i*219,697,27,'#ffe8c0',sans)).join('')}
  ${label('PICK YOUR MOOD. PRESS PLAY.',65,745,'#f5dfba',16)}
`));

// A rhythm of real sleeves; each remains a separate genre exploration.
let sleeves = '';
for (let i = 0; i < 3; i++) {
  const x = 453 + i*216, y = 150 + [51,0,79][i];
  sleeves += rect(x+8,y+9,256,405,'#151819') + await image(`scripts/site-cover-assets/style-${i+1}.jpg`,x,y,256,338);
  sleeves += rect(x,y+338,256,67,['#b6553b','#869478','#b9a978'][i]) + label(['POP','FOLK','AMBIENT'][i],x+22,y+382,'#fff4dc',22);
}
covers.set('style-room', frame('风格听室：流行、民谣与电子氛围的真实作品封面', '#272d35', `
  ${Array.from({length:13},(_,i)=>line(49+i*92,38,49+i*92,755,'#3e4650')).join('')}
  ${label('STYLE / SOUND',63,80,'#d5c5a6')}${text('风格',58,301,108,'#f4e7cc')}${text('听室',58,423,108,'#f4e7cc')}
  ${text('沿着曲风，',65,520,31,'#d5c5a6')}${text('打开另一扇门。',65,566,31,'#d5c5a6')}${sleeves}
  ${label('DIFFERENT SOUNDS. DIFFERENT STORIES.',65,735,'#d5c5a6',18)}
`));

// Translation as an open editorial spread; real public article artwork.
const everyPhoto = await image('public/sites/every.webp',432,63,706,515);
covers.set('every-reading', frame('Every 编译：AI、工作与创造力的中文阅读', '#e5ba96', `
  ${rect(29,29,1142,742,'#f2e9d8')}${everyPhoto}${rect(29,29,403,742,'#e4b18d')}
  ${label('READING / TRANSLATION',64,88,'#653d2c',17)}${text('Every',58,278,112,'#30291f',serif,'font-style="italic"')}
  ${text('编译',58,417,110,'#30291f')}${text('读进另一种视角。',66,522,30,'#653d2c')}
  ${line(479,621,1091,621,'#a8a08e')}${label('AI / WORK / CREATIVITY',479,676,'#484d42',22)}
  ${text('从原文出发，继续追读。',479,729,32,'#484d42')}${label('EN → 中文',66,732,'#653d2c',23)}
`));

// A horizon radar filters the noisy sky into a few selected signals.
let signals = '';
for (let i = 0; i < 60; i++) {
  const x=575+(i*83)%564,y=140+(i*107)%490;
  signals += circle(x,y,i%9===0?6:2,i%9===0?'#e0b36c':'#809e95',`opacity="${i%9===0?1:.38}"`);
}
covers.set('horizon', frame('Horizon：从全球信息中筛选值得阅读的双语简报', '#193d3a', `
  <defs><radialGradient id="sun"><stop stop-color="#efc78a"/><stop offset="1" stop-color="#bc8051"/></radialGradient></defs>
  ${signals}${[168,232,300].map(r=>circle(854,399,r,'none','stroke="#55766a" stroke-width="1.5"')).join('')}
  <path d="M854 399L1112 244A300 300 0 0 1 1153 427Z" fill="#b9d6a4" opacity=".09"/>
  ${circle(854,399,104,'url(#sun)')}${rect(0,482,1200,318,'#193d3a')}
  <path d="M0 567Q300 408 610 493T1200 476" stroke="#809988" stroke-width="2" fill="none"/>
  ${label('GLOBAL SIGNALS / SELECTED',63,83,'#b5c4ac',20)}${text('HORIZON',58,253,110,'#efe3c8',serif)}
  ${text('从喧嚣中，',64,646,44,'#efe3c8')}${text('筛出值得读的。',64,710,44,'#efe3c8')}
  ${line(862,638,1120,638,'#809988')}${label('CN / EN',887,697,'#d9c099',29)}
`));

// A newspaper front page around an illustrated chip; no fictional headlines.
let circuits = '';
for(let i=0;i<6;i++){
  const a=471+i*25;
  circuits += line(839,a,751-i*8,a,'#ba4d31',3)+line(1000,a,1090+i*7,a,'#ba4d31',3);
  circuits += line(857+i*24,452,857+i*24,403-i*8,'#ba4d31',3)+line(857+i*24,621,857+i*24,668+i*8,'#ba4d31',3);
}
const newspaper = `${rect(91,322,1016,396,'#c9bfa9')}${rect(78,307,1016,396,'#f9f0db')}
  ${label('每日 AI 行业日报',112,360,'#423e32',27)}${line(113,382,1054,382,'#353b33',3)}
  ${text('新工具',112,449,42)}${text('新产品',112,510,42)}${text('新变化',112,571,42)}
  ${[0,1,2,3,4].map(i=>line(328,429+i*47,666-(i%2)*49,429+i*47,'#aaa38f',4)).join('')}
  ${circuits}${rect(839,452,161,169,'#233f38')}${rect(858,472,123,129,'none','stroke="#cbbf95"')}${text('AI',870,560,69,'#eee0bd',serif)}
  ${label('NEWS / TOOLS / IDEAS',113,664,'#6a705e',21)}`;
covers.set('ai-daily', frame('AI DAILY：每日AI行业日报、工具与产品动态', '#e8dfca', `
  ${label('AN INDEPENDENT PUBLICATION',63,78,'#6c715e',20)}${line(64,112,1136,112,'#323a2f',3)}
  ${text('AI DAILY',58,255,143,'#a33e2d',serif,'font-weight="700"')}${turn(newspaper,-3,595,510)}
  ${label('READ THE PRESENT.',64,755,'#6c715e',18)}
`));

// Wedding invitations as a considered flat lay, with two complete real styles.
const invite = await image('studio-sites/wedding/images/announce-la-retro-travel.webp',439,157,316,474,'contain');
const premiere = await image('studio-sites/wedding/images/announce-premiere.webp',768,107,310,465,'contain');
covers.set('shiliu-wedding', frame('石榴婚礼：海风复古邀请函与院线首映婚礼海报', '#dfd7c3', `
  ${rect(0,0,392,800,'#e9e3d3')}${label('SHILIU / WEDDING',63,81,'#71644d',19)}
  ${text('Our',58,272,103,'#796343',serif,'font-style="italic"')}${text('day.',58,379,103,'#796343',serif,'font-style="italic"')}
  ${text('石榴婚礼',64,499,50,'#403f30')}${text('从心动，到请柬。',65,561,29,'#6d715d')}
  ${turn(rect(449,169,316,474,'#c2b69e')+invite,-7,596,394)}
  ${turn(rect(780,119,310,465,'#c2b69e')+premiere,8,923,339)}
  <path d="M784 649C855 650 896 620 922 603C970 572 1042 602 1073 653" fill="none" stroke="#a97959" stroke-width="3"/>
  ${circle(944,665,28,'none','stroke="#b19a5d" stroke-width="7"')}${circle(982,666,28,'none','stroke="#b19a5d" stroke-width="7"')}
  ${label('INVITATIONS / VISUAL IDEAS',65,737,'#71644d',17)}
`));

// Three photographic moods share a contact sheet, not an isolated portrait.
let portraits = '';
for(const [i,file] of ['p-0cf5eaf443d6538b-1','p-511e9cdbbb733b3a-1','p-33b72a5cd38dd495-1'].entries()){
  const x=452+i*228, y=131+[37,0,59][i];
  portraits+=rect(x-8,y-8,230,461,'#e9dec8')+await image(`studio-sites/portrait/images/${file}.webp`,x,y,214,410)+label(`0${i+1}`,x+6,y+439,'#554936',17);
}
covers.set('shiliu-portrait', frame('石榴写真：窗边暖光、雨幕黑白和夏日田野三种真实样片', '#4b5147', `
  ${label('SHILIU / PORTRAIT',64,81,'#d9d7bf',20)}${text('石榴',58,292,103,'#f1e7ce')}${text('写真',58,411,103,'#f1e7ce')}
  ${text('找到你的另一面。',65,515,31,'#d4ceb6')}${portraits}
  ${line(65,662,1135,662,'#858977')}${label('LIGHT / CHARACTER / MOOD',65,731,'#d9d7bf',20)}
`));

await fs.mkdir(output, { recursive: true });
for (const [id, svg] of covers) {
  for (const width of [600, 1200]) {
    await sharp(Buffer.from(svg)).resize(width, width * 2 / 3).webp({ quality: 88, effort: 6 }).toFile(new URL(`${id}-${width}.webp`, output).pathname);
  }
  console.log(`${id}: 1200×800 + 600×400`);
}
