// 提示词组装：汤底 + 照片锁定句 + 文字规则 + 槽位行。浏览器和服务器共用这一份。

const WEEKDAY_CN = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CITY_EN = {
  '洛杉矶': 'Los Angeles', '圣莫尼卡': 'Santa Monica', '马里布': 'Malibu', '比佛利山': 'Beverly Hills',
  '帕萨迪纳': 'Pasadena', '尔湾': 'Irvine', '橙县': 'Orange County', '棕榈泉': 'Palm Springs',
  '圣地亚哥': 'San Diego', '旧金山': 'San Francisco', '拉斯维加斯': 'Las Vegas', '卡特琳娜岛': 'Catalina Island'
};

const clean = (v) => String(v ?? '').replace(/[「」{}<>]/g, '').replace(/\s+/g, ' ').trim();

function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return { y: +m[1], mo: +m[2], d: +m[3], wd: d.getUTCDay() };
}

function parseTime(s) {
  const m = /^(\d{1,2}):(\d{2})/.exec(s || '');
  if (!m) return null;
  return { h: +m[1], mi: m[2] };
}

export function deriveVars(input = {}, shared = {}) {
  const v = {};
  for (const [k, def] of Object.entries(shared.fields || {})) {
    v[k] = clean(input[k]) || (def.default ?? '');
  }
  for (const k of Object.keys(input)) if (!(k in v)) v[k] = clean(input[k]);

  v.names = v.name1 && v.name2 ? `${v.name1} & ${v.name2}` : v.name1 || v.name2 || '';
  v.namesEn = v.name1En && v.name2En ? `${v.name1En} & ${v.name2En}` : '';
  v.namesEnUpper = v.namesEn.toUpperCase();
  v.namesEnAmp = v.namesEn || v.names;

  const d = parseDate(input.date);
  if (d) {
    v.dateCn = `${d.y}年${d.mo}月${d.d}日`;
    v.dateEn = `${MONTH_EN[d.mo - 1]} ${d.d}, ${d.y}`;
    v.dateDot = `${d.y}.${String(d.mo).padStart(2, '0')}.${String(d.d).padStart(2, '0')}`;
    v.dateDotShort = `${d.mo}.${d.d}`;
    v.weekdayCn = WEEKDAY_CN[d.wd];
    v.weekdaySep = `（${v.weekdayCn}）`;
  }
  const t = parseTime(input.time);
  if (t) {
    const period = t.h < 12 ? (t.h < 6 ? '凌晨' : '上午') : t.h < 18 ? '下午' : '晚上';
    const h12 = t.h % 12 === 0 ? 12 : t.h % 12;
    v.timeCn = `${period} ${h12}:${t.mi}`;
    v.timeEn = `${h12}:${t.mi} ${t.h < 12 ? 'AM' : 'PM'}`;
  }
  v.cityEn = CITY_EN[v.city] || v.city;
  v.venueSep = v.venue ? ` · ${v.venue}` : '';
  return v;
}

// {{a}} 取变量；{{a|b}} 依次回退；{{a|'字面量'}} 用字面量兜底。任何一个占位符取不到值，整行跳过。
export function fillLine(line, vars) {
  let missing = false;
  const out = line.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
    for (const part of expr.split('|').map((s) => s.trim())) {
      const lit = /^'(.*)'$/.exec(part);
      if (lit) return lit[1];
      if (vars[part]) return vars[part];
    }
    missing = true;
    return '';
  });
  return missing ? null : out;
}

export function buildPrompt(template, input, shared, { hasPhoto = false } = {}) {
  const vars = deriveVars(input, shared);
  const p = template.prompt;
  const parts = [p.soup.trim()];

  if (hasPhoto) {
    if (p.photoUse) parts.push(p.photoUse);
    if (shared.photoLock) parts.push(shared.photoLock);
  } else if (p.noPhoto) {
    parts.push(p.noPhoto);
  }

  const slotLines = (p.slots || []).map((l) => fillLine(l, vars)).filter(Boolean);
  // Optional location/time fields must not make the required date disappear.
  if (template.fields.includes('date') && vars.dateCn && !slotLines.some(line => [vars.dateCn, vars.dateEn, vars.dateDot, vars.dateDotShort].some(value => value && line.includes(value)))) {
    slotLines.push(`日期：「${vars.dateCn}」`);
  }
  const hasText = template.category !== 'retouch';
  if (hasText && shared.textRule) parts.push(shared.textRule);
  if (shared.globalNegative) parts.push(shared.globalNegative);
  if (slotLines.length) parts.push('——————\n' + slotLines.join('\n'));

  return { prompt: parts.join('\n\n'), vars };
}

export function validate(template, input, shared, { hasPhoto = false } = {}) {
  const errors = [];
  if (template.photo === 'required' && !hasPhoto) errors.push('这个模板需要上传一张婚纱照');
  for (const k of template.fields) {
    const def = shared.fields[k] || {};
    const val = clean(input[k]);
    if (def.required && !val) errors.push(`请填写${def.label}`);
    if (def.max && val.length > def.max) errors.push(`${def.label}最多 ${def.max} 个字`);
  }
  return errors;
}
