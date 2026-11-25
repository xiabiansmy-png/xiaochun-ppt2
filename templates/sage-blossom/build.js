/**
 * 模板：莫兰迪花语（sage-blossom）
 * ------------------------------------------------------------------
 * 来源：网络模板「文艺清新毕业论文答辩」（WPS 制作，20 页）。
 * 暖灰白底（#F0ECE9）+ 灰绿（#747E6D）+ 豆沙红（#B87271）+ 浅驼色块，四角是有机色块、绿叶和线描小花，
 * 背景里有大片浅灰叶影。内容页左上角一小片叶子 + 宋体标题 + 英文小字，右下角一块豆沙红色块。
 *
 * 动效：原模板没有任何翻页和动画。按用户要求新设计了一套克制的动效，写在 motion.json：
 *   翻页统一「淡出」0.7 秒；每页单击一次：页眉从左擦出 → 正文淡入（自动接着播放）。
 *   这里只负责给元素分组：ctx.g("组名")。组名和 motion.json 的 pages 一一对应。
 *
 * 字体：标题用华文中宋（原模板是思源宋体 CN Heavy，多数电脑没装），正文微软雅黑（同原模板）。
 *
 * 版式（和 meta.json → layouts 一致）：
 *   cover     bloom                     四角色块 + 大叶影，居中绿色大标题 + 豆沙红副标题 + 三段细线 + 胶囊标签（原第 1 页）
 *   toc       grid                      「目录 CONTENTS」+ 两列圆角编号方块（原第 2 页）
 *   section   bloom                     绿色编号方块 + 大标题 + 两端圆点的英文行（原第 3 页）
 *   points3   circles | panel           左段落 + 竖线照片，右三个编号圆（原第 4 页）/ 照片夹豆沙红面板（原第 15 页）
 *   points4   cycle | numbered | around 四段圆环 + 两侧文字（原第 9 页）/ 编号列表 + 两张照片（原第 14 页）/ 中间照片 + 四角图标（原第 18 页）
 *   compare   cards | duo               绿 / 红两张照片卡片（原第 11 页）/ 两栏短线 + 照片 + 条目（原第 19 页）
 *   stats     numbers | chart           数字卡片（新设计）/ 数字 + 柱状图（新设计）
 *   timeline  zigzag                    横轴 + 上下交错的线框卡片 + 图标圆（原第 13 页）
 *   imageText side | panel              左照片右文字 + 图标要点（原第 17 页）/ 照片压绿色面板（原第 10 页）
 *   quote     leaf                      章节页装饰 + 居中宋体金句（新设计）
 *   closing   thanks                    同封面（原第 20 页）
 *   table     grid       （可选）       灰绿表头 + 米白隔行（新设计）
 */
const C = {
  bg: "F0ECE9", green: "747E6D", greenD: "5E6858", greenL: "E2E5DE", rose: "B87271", roseT: "AE6F66", roseL: "F3E4E1",
  sand: "C4AE9C", ink: "404040", body: "595959", gray: "767676", line: "D6CFC9", card: "F8F6F4", white: "FFFFFF",
};
const F = { head: "华文中宋", body: "微软雅黑", num: "Georgia" };
const W = 13.333, L = 0.79, R = 12.55, TOP = 1.6, BOT = 6.62;
const PHOTOS = ["photo10.jpg", "photo05.jpg", "photo07.jpg", "photo19.jpg", "photo09.jpg", "photo17.jpg", "photo11.jpg", "photo08.jpg"];

let ctx;
/* ---------------- 排版组件 ---------------- */
function T(slide, str, o) {
  if (str === undefined || str === null || str === "") return 0;
  const opt = { margin: 0, color: C.ink, fontFace: F.body, fontSize: 12, valign: "top", lineSpacingMultiple: 1.3, ...o };
  const s = o.noBalance ? String(str) : ctx.balance(String(str), { w: opt.w, fontSize: opt.fontSize, bold: opt.bold, charSpacing: opt.charSpacing, lineSpacingMultiple: opt.lineSpacingMultiple });
  delete opt.noBalance;
  slide.addText(s, opt);
  return opt.h;
}
const Hh = (str, o) => (str ? ctx.measure(String(str), { lineSpacingMultiple: 1.3, ...o }).needH + 0.03 : 0);
const one = (str, o) => ctx.fitLine(String(str || ""), o);
const wid = (str, o) => ctx.measure(String(str || ""), { w: 40, ...o }).longest || 0;
const num2 = (i) => String(i + 1).padStart(2, "0");
const tone = (i) => (i % 2 ? C.rose : C.green);
function box(slide, kind, x, y, w, h, fill, o = {}) {
  slide.addShape(ctx.shapes[kind], {
    x, y, w, h, fill: fill ? { color: fill, transparency: o.tr || 0 } : { type: "none" },
    line: o.line ? { color: o.line, width: o.lw || 1, dashType: o.dash } : { type: "none" },
    rectRadius: o.radius, rotate: o.rotate, flipH: o.flipH, angleRange: o.angle, arcThicknessRatio: o.thick,
    objectName: o.name || "",
  });
}
const rect = (sl, x, y, w, h, fill, o) => box(sl, "RECTANGLE", x, y, w, h, fill, o);
const rrect = (sl, x, y, w, h, fill, o = {}) => box(sl, "ROUNDED_RECTANGLE", x, y, w, h, fill, { radius: o.r ?? 0.12, ...o });
const oval = (sl, x, y, d, fill, o) => box(sl, "OVAL", x, y, d, d, fill, o);
function hline(sl, x, y, w, color = C.line, width = 0.75, name = "", dash) { sl.addShape(ctx.shapes.LINE, { x, y, w, h: 0, line: { color, width, dashType: dash }, objectName: name }); }
function vline(sl, x, y, h, color = C.line, width = 0.75, name = "") { sl.addShape(ctx.shapes.LINE, { x, y, w: 0, h, line: { color, width }, objectName: name }); }
function pill(sl, str, x, y, w, h, o = {}) {
  const solid = o.solid !== false;
  box(sl, "ROUNDED_RECTANGLE", x, y, w, h, solid ? (o.fill || C.rose) : C.bg, { radius: h / 2, line: solid ? null : (o.fill || C.rose), lw: 1, name: o.name });
  T(sl, str, { x, y, w, h, fontSize: o.size || one(str, { w: w - 0.3, max: 12, min: 9.5 }), color: solid ? C.white : (o.fill === C.green ? C.greenD : C.roseT), align: "center", valign: "middle", noBalance: true, objectName: o.name });
}
async function icon(sl, name, color, x, y, s, def, g) {
  sl.addImage({ data: await ctx.icon(name, color, def), x, y, w: s, h: s, objectName: g });
}
/** 圆底 + 白色图标 */
async function iconDot(sl, name, fill, x, y, d, def, g) {
  oval(sl, x, y, d, fill, { name: g });
  await icon(sl, name, fill === C.white ? C.green : C.white, x + d * 0.27, y + d * 0.27, d * 0.46, def, g);
}
const deco = (sl, file, x, y, w, h) => sl.addImage({ path: ctx.asset(file), x, y, w, h, objectName: "装饰|" + file });
async function decoFlip(sl, file, x, y, w, h) {
  const p = await ctx.prep(file, w, h, { flip: true, crop: false });
  sl.addImage({ path: p, x, y, w, h, objectName: "装饰|" + file });
}

/* ---------------- 页面 / 页眉 ---------------- */
function add(s) { return ctx.addSlide(s, { master: "SB_BG", bg: C.bg }); }
/** 封面 / 目录 / 章节共用的四角装饰（原第 1、2、3 页） */
async function frame(slide, { leaf = "right", flowers = false } = {}) {
  if (leaf === "right") deco(slide, "deco_leaf.png", 9.68, 1.85, 3.66, 5.64);
  else if (leaf === "left") await decoFlip(slide, "deco_leaf.png", 0, 1.85, 3.66, 5.64);
  if (flowers) {
    deco(slide, "deco_flower.png", 3.66, 5.16, 2.66, 2.34);
    if (leaf === "left") await decoFlip(slide, "deco_flower_tall.png", 10.72, 3.2, 2.52, 4.71);
    else deco(slide, "deco_flower_tall.png", 10.9, 2.13, 2.52, 4.71);
  }
  deco(slide, "deco_bl.png", -0.01, 5.77, 8.03, 2.14);
  deco(slide, "deco_tl.png", 0, 0, 2.48, 1.41);
  deco(slide, "deco_tr.png", 10.35, 0, 2.98, 1.6);
  deco(slide, "deco_br.png", 11.16, 6.18, 2.18, 1.31);
}
const eyebrowOf = (s) => (s.eyebrow !== undefined ? s.eyebrow : s._en ? String(s._en).toUpperCase() : s._sectionNo ? `PART ${s._num} · ${s._sectionTitle}` : "");
/** 内容页页眉（组 header）：左上叶子（静止）+ 宋体标题 + 英文小字；右下豆沙红色块（静止） */
function header(slide, s) {
  deco(slide, "deco_corner.png", 0, 0, 0.9, 0.85);
  deco(slide, "deco_br.png", 11.89, 6.62, 1.44, 0.87);
  const g = ctx.g("header");
  const size = one(s.title, { w: 10.4, max: 24, min: 18 });
  T(slide, s.title, { x: L, y: 0.3, w: 10.6, h: 0.52, fontSize: size, fontFace: F.head, color: C.ink, valign: "middle", noBalance: true, objectName: g });
  const eb = eyebrowOf(s);
  if (eb) T(slide, eb, { x: L, y: 0.84, w: 8, h: 0.26, fontSize: 10.5, color: C.body, noBalance: true, objectName: g });
}
/** 引导语（正文组里） */
function lead(slide, s, y, o = {}) {
  if (!s.lead) return y;
  const x = o.x ?? L + 0.2, w = o.w ?? R - L - 0.4, size = o.size || 13;
  const h = Hh(s.lead, { w, fontSize: size, lineSpacingMultiple: 1.45 });
  T(slide, s.lead, { x, y, w, h, fontSize: size, color: C.ink, align: o.align, lineSpacingMultiple: 1.45, objectName: ctx.g(o.g || "body", "引导语") });
  return y + h + (o.gap ?? 0.3);
}
/** 结论条：浅绿底 + 灰绿竖条 */
function conclusion(slide, s, y, o = {}) {
  if (!s.conclusion) return y;
  const x = o.x ?? L + 0.2, w = o.w ?? R - L - 0.4, g = ctx.g(o.g || "body", "结论");
  const h = concH(s, w);
  rect(slide, x, y, w, h, C.greenL, { name: g });
  rect(slide, x, y, 0.07, h, C.green, { name: g });
  T(slide, s.conclusion, { x: x + 0.3, y, w: w - 0.5, h, fontSize: 13, bold: true, color: C.greenD, valign: "middle", objectName: g });
  return y + h;
}
const concH = (s, w = R - L - 0.4) => (s.conclusion ? Math.max(0.5, Hh(s.conclusion, { w: w - 0.5, fontSize: 13, bold: true }) + 0.2) : 0);
/** 内容区底线：有结论条时往上让 */
const bottomOf = (s, w) => BOT - (s.conclusion ? concH(s, w) + 0.2 : 0);

/* ---------------- 封面 / 结尾 ---------------- */
async function hero(s, closing) {
  ctx.pickLayout(s, [closing ? "thanks" : "bloom"]);
  const slide = add(s);
  await frame(slide, { leaf: "right" });
  const cx = W / 2, tw = 8.6;
  // 主标题：一行放不下就两行
  let title = String(s.title), size = one(title, { w: tw, max: 60, min: 36, fontFace: F.head });
  let lines = 1;
  if (ctx.measure(title, { w: tw, fontSize: size }).lines > 1) {
    size = ctx.fit(title, { w: tw, h: 1.9, max: 48, min: 30, lineSpacingMultiple: 1.1 });
    title = ctx.balance(title, { w: tw, fontSize: size, lineSpacingMultiple: 1.1 });
    lines = ctx.measure(title, { w: tw, fontSize: size, lineSpacingMultiple: 1.1 }).lines;
  }
  const th = Math.max(lines * size / 72 * 1.2 + 0.08, Hh(title, { w: tw, fontSize: size, lineSpacingMultiple: 1.1 }));
  const subSize = s.subtitle ? one(s.subtitle, { w: tw, max: 40, min: 22, bold: true }) : 0;
  const subH = s.subtitle ? Hh(s.subtitle, { w: tw, fontSize: subSize, bold: true }) : 0;
  const desc = closing ? s.body : s.desc;
  const descH = desc ? Hh(desc, { w: 8.2, fontSize: 11, lineSpacingMultiple: 1.5 }) : 0;
  const author = closing ? "" : ctx.deck.meta?.author || "";
  const pills = [s.tag, author].filter(Boolean);
  const total = th + (s.subtitle ? 0.1 + subH : 0) + 0.32 + (desc ? 0.25 + descH : 0) + (pills.length ? 0.4 + 0.36 : 0);
  let y = Math.max(1.45, 3.55 - total / 2);
  T(slide, title, { x: cx - tw / 2, y, w: tw, h: th, fontSize: size, fontFace: F.head, color: C.green, align: "center", valign: "middle", lineSpacingMultiple: 1.1, noBalance: true, objectName: ctx.g("title") });
  y += th;
  const g = ctx.g("sub");
  if (s.subtitle) { y += 0.1; T(slide, s.subtitle, { x: cx - tw / 2, y, w: tw, h: subH, fontSize: subSize, bold: true, fontFace: F.head, color: C.roseT, align: "center", valign: "middle", noBalance: true, objectName: g }); y += subH; }
  // 三段细线（原模板标题下的装饰线）
  y += 0.18;
  const seg = [1.8, 0.45, 1.8], gap = 0.16, sw = seg.reduce((a, b) => a + b, 0) + gap * 2;
  let lx = cx - sw / 2;
  for (const w of seg) { hline(slide, lx, y, w, C.rose, 1.25, g); lx += w + gap; }
  y += 0.14;
  if (desc) { y += 0.25; T(slide, desc, { x: cx - 4.1, y, w: 8.2, h: descH, fontSize: 11, color: C.body, align: "center", lineSpacingMultiple: 1.5, objectName: g }); y += descH; }
  if (pills.length) {
    y += 0.4;
    const ws = pills.map((p) => Math.min(3.6, Math.max(1.35, wid(p, { fontSize: 11 }) + 0.6)));
    let px = cx - (ws.reduce((a, b) => a + b, 0) + (ws.length - 1) * 0.26) / 2;
    pills.forEach((p, i) => { pill(slide, p, px, y, ws[i], 0.36, { solid: i === 0, size: one(p, { w: ws[i] - 0.3, max: 11, min: 9.5 }), name: g }); px += ws[i] + 0.26; });
  }
}
const cover = (s) => hero(s, false);
const closing = (s) => hero(s, true);

/* ---------------- 目录 ---------------- */
async function toc(s) {
  ctx.pickLayout(s, ["grid"]);
  const slide = add(s);
  await frame(slide, { leaf: "right", flowers: true });
  const gh = ctx.g("head"), t = String(s.title || "目录");
  const ts = one(t, { w: 3.2, max: 44, min: 28 });
  const tW = Math.min(3.2, wid(t, { fontSize: ts }) + 0.05);
  T(slide, t, { x: 1.02, y: 0.3, w: tW + 0.1, h: 0.9, fontSize: ts, fontFace: F.head, color: C.green, valign: "bottom", noBalance: true, objectName: gh });
  T(slide, "CONTENTS", { x: 1.02 + tW + 0.15, y: 0.78, w: 2.2, h: 0.4, fontSize: 18, color: C.green, fontFace: F.num, valign: "bottom", noBalance: true, objectName: gh });
  let top = 2.1;
  if (s.desc) {
    const dh = Hh(s.desc, { w: 7.0, fontSize: 11, lineSpacingMultiple: 1.4 });
    T(slide, s.desc, { x: 1.05, y: 1.35, w: 7.0, h: dh, fontSize: 11, color: C.body, lineSpacingMultiple: 1.4, objectName: gh });
    top = Math.max(top, 1.35 + dh + 0.35);
  }
  const n = s.items.length, rows = Math.ceil(n / 2), bottom = 6.15;
  const rh = Math.min(1.6, (bottom - top) / rows), bs = Math.min(0.79, rh - 0.22);
  const y0 = top + Math.max(0, (bottom - top - rows * rh) / 2) + (rh - bs) / 2;
  const xs = [1.31, 6.9], tw = 3.75;
  s.items.forEach((it, i) => {
    const g = ctx.g("item" + i), c = Math.floor(i / rows), r = i % rows;
    const x = xs[c], y = y0 + r * rh;
    rrect(slide, x, y, bs, bs, tone(i), { r: 0.14, name: g });
    T(slide, num2(i), { x, y, w: bs, h: bs, fontSize: bs >= 0.7 ? 20 : 16, color: C.white, fontFace: F.num, align: "center", valign: "middle", noBalance: true, objectName: g });
    const tx = x + bs + 0.28;
    const hs = one(it.head, { w: tw, max: rh >= 1.2 ? 24 : 20, min: 15 });
    const hh = Hh(it.head, { w: tw, fontSize: hs });
    const subH = it.sub ? 0.26 : 0;
    const ty = y + bs / 2 - (hh + (subH ? subH + 0.02 : 0)) / 2;
    T(slide, it.head, { x: tx, y: ty, w: tw, h: hh, fontSize: hs, fontFace: F.head, color: C.ink, valign: "middle", noBalance: true, objectName: g });
    if (it.sub) T(slide, it.sub, { x: tx, y: ty + hh + 0.02, w: tw, h: subH, fontSize: one(it.sub, { w: tw, max: 11, min: 9.5 }), color: C.gray, noBalance: true, objectName: g });
  });
}

/* ---------------- 章节页 ---------------- */
async function section(s) {
  ctx.pickLayout(s, ["bloom"]);
  const slide = add(s);
  await frame(slide, { leaf: "left", flowers: true });
  const g = ctx.g("sec"), cx = W / 2, tw = 9.4;
  const num = (s._part || "PART 01").replace(/^PART\s*/, "");
  const tSize = one(s.title, { w: tw, max: 54, min: 36 });
  const lines = ctx.measure(s.title, { w: tw, fontSize: tSize }).lines;
  const tSize2 = lines > 1 ? ctx.fit(s.title, { w: tw, h: 1.7, max: 44, min: 30, lineSpacingMultiple: 1.1 }) : tSize;
  const tl = lines > 1 ? ctx.measure(s.title, { w: tw, fontSize: tSize2, lineSpacingMultiple: 1.1 }).lines : 1;
  const th = tl * tSize2 / 72 * 1.2 + 0.08;
  const en = s.en ? String(s.en).toUpperCase() : "";
  const enSize = en ? one(en, { w: 6.0, max: 14, min: 10 }) : 0;
  const dH = s.desc ? Hh(s.desc, { w: 6.6, fontSize: 11, lineSpacingMultiple: 1.45 }) : 0;
  const kH = s.keywords?.length ? 0.36 : 0;
  const total = 0.94 + 0.3 + th + (en ? 0.12 + 0.32 : 0) + (dH ? 0.22 + dH : 0) + (kH ? 0.3 + kH : 0);
  let y = Math.max(1.0, 3.6 - total / 2);
  rrect(slide, cx - 0.47, y, 0.94, 0.94, C.green, { r: 0.18, name: g });
  T(slide, num, { x: cx - 0.47, y, w: 0.94, h: 0.94, fontSize: 28, color: C.white, fontFace: F.num, align: "center", valign: "middle", noBalance: true, objectName: g });
  y += 0.94 + 0.3;
  T(slide, s.title, { x: cx - tw / 2, y, w: tw, h: th, fontSize: tSize2, fontFace: F.head, color: C.ink, align: "center", valign: "middle", lineSpacingMultiple: 1.1, objectName: g });
  y += th;
  if (en) {
    y += 0.12;
    const ew = Math.min(6.0, wid(en, { fontSize: enSize }) + 0.1);
    T(slide, en, { x: cx - ew / 2, y, w: ew, h: 0.32, fontSize: enSize, color: C.roseT, align: "center", valign: "middle", noBalance: true, objectName: g });
    oval(slide, cx - ew / 2 - 0.36, y + 0.085, 0.15, C.rose, { name: g });
    oval(slide, cx + ew / 2 + 0.21, y + 0.085, 0.15, C.rose, { name: g });
    y += 0.32;
  }
  if (s.desc) { y += 0.22; T(slide, s.desc, { x: cx - 3.3, y, w: 6.6, h: dH, fontSize: 11, color: C.body, align: "center", lineSpacingMultiple: 1.45, objectName: g }); y += dH; }
  if (kH) {
    y += 0.3;
    const ws = s.keywords.map((k) => wid(k, { fontSize: 11 }) + 0.44);
    let x = cx - (ws.reduce((a, b) => a + b, 0) + (ws.length - 1) * 0.15) / 2;
    s.keywords.forEach((k, i) => { pill(slide, k, x, y, ws[i], 0.36, { solid: false, fill: C.green, size: 11, name: g }); x += ws[i] + 0.15; });
  }
}

/* ---------------- 3 要点 ---------------- */
async function points3(s) {
  const layout = ctx.pickLayout(s, ["circles", "panel"]);
  const slide = add(s);
  header(slide, s);
  const G = (l) => ctx.g("body", l);
  const bottom = bottomOf(s);
  if (layout === "circles") {
    // 左：段落 + 竖线照片；右：三个豆沙红编号圆（原第 4 页）
    const lx = 1.12, lw = 6.5;
    const leadH = s.lead ? Hh(s.lead, { w: lw, fontSize: 13, lineSpacingMultiple: 1.5 }) : 0;
    const avail = bottom - TOP - 0.1;
    const ph = Math.min(3.7, avail - (leadH ? leadH + 0.3 : 0));
    const block = (leadH ? leadH + 0.3 : 0) + ph;
    let y = TOP + 0.05 + (avail - block) / 2;
    if (s.lead) { T(slide, s.lead, { x: lx, y, w: lw, h: leadH, fontSize: 13, color: C.ink, lineSpacingMultiple: 1.5, objectName: G("引导语") }); y += leadH + 0.3; }
    vline(slide, lx, y, ph, C.green, 2, G("竖线"));
    await ctx.pic(slide, s, 0, lx + 0.25, y, lw - 0.25, ph, { fallback: "photo05.jpg", name: G("照片") });
    const rx = 8.45, d = 0.8, tx = rx + d + 0.25, tw = R - tx;
    const step = (bottom - TOP) / 3;
    s.items.forEach((it, i) => {
      const bh = Hh(it.body, { w: tw, fontSize: 12, lineSpacingMultiple: 1.4 });
      const hs = one(it.head, { w: tw, max: 19, min: 14, bold: true });
      const blockH = 0.45 + bh;
      const yy = TOP + i * step + (step - Math.max(d, blockH)) / 2;
      oval(slide, rx, yy + Math.max(0, (blockH - d) / 2) * 0, d, C.rose, { name: G("编号圆") });
      T(slide, num2(i), { x: rx, y: yy, w: d, h: d, fontSize: 20, bold: true, color: C.white, fontFace: F.num, align: "center", valign: "middle", noBalance: true, objectName: G("编号") });
      T(slide, it.head, { x: tx, y: yy - 0.02, w: tw, h: 0.42, fontSize: hs, bold: true, color: C.green, valign: "middle", noBalance: true, objectName: G("标题") });
      T(slide, it.body, { x: tx, y: yy + 0.45, w: tw, h: bh, fontSize: 12, color: C.body, lineSpacingMultiple: 1.4, objectName: G("正文") });
    });
  } else {
    // 引导语 + 照片 | 豆沙红面板（三条要点）| 照片（原第 15 页）
    let y = lead(slide, s, TOP + 0.05, { g: "body" });
    const x0 = L + 0.2, x1 = R - 0.2;
    // 放不下时缩窄两侧照片、收紧条目间距
    let pw, gapI, panX, panW, tx, tw, its, need;
    for ([pw, gapI] of [[2.75, 0.32], [2.2, 0.26], [1.8, 0.2]]) {
      panX = x0 + pw; panW = x1 - x0 - 2 * pw; tx = panX + 1.05; tw = panW - 1.4;
      its = s.items.map((it) => ({ it, bh: Hh(it.body, { w: tw, fontSize: 12, lineSpacingMultiple: 1.35 }) }));
      need = its.reduce((a, o) => a + 0.42 + o.bh, 0) + gapI * (its.length - 1) + 0.6;
      if (need <= bottom - y) break;
    }
    const H = Math.min(bottom - y, Math.max(3.4, need));
    y += Math.max(0, (bottom - y - H) / 2);
    await ctx.pic(slide, s, 0, x0, y, pw, H, { fallback: "photo17.jpg", name: G("照片") });
    rect(slide, panX, y, panW, H, C.rose, { name: G("面板") });
    await ctx.pic(slide, s, 1, panX + panW, y, pw, H, { fallback: "photo18.jpg", name: G("照片") });
    const used = need - 0.6;
    let yy = y + (H - used) / 2;
    const DEF = ["feather", "book-open", "award"];
    for (const [i, { it, bh }] of its.entries()) {
      oval(slide, panX + 0.4, yy, 0.46, C.white, { name: G("图标圆") });
      await icon(slide, it.icon, C.rose, panX + 0.51, yy + 0.11, 0.24, DEF[i], G("图标"));
      T(slide, it.head, { x: tx, y: yy, w: tw, h: 0.4, fontSize: one(it.head, { w: tw, max: 16, min: 13, bold: true }), bold: true, color: C.white, valign: "middle", noBalance: true, objectName: G("标题") });
      T(slide, it.body, { x: tx, y: yy + 0.42, w: tw, h: bh, fontSize: 12, color: C.white, lineSpacingMultiple: 1.35, objectName: G("正文") });
      yy += 0.42 + bh + gapI;
    }
  }
  if (s.conclusion) conclusion(slide, s, bottom + 0.2);
}

/* ---------------- 4 要点 ---------------- */
async function points4(s) {
  const layout = ctx.pickLayout(s, ["cycle", "numbered", "around"]);
  const slide = add(s);
  header(slide, s);
  const G = (l) => ctx.g("body", l);
  const bottom = bottomOf(s);
  const DEF = ["edit-3", "search", "layers", "check-circle"];
  if (layout === "cycle") {
    // 四段圆环 + 两侧文字（原第 9 页）
    let y = lead(slide, s, TOP, { align: "center", g: "body" });
    const H = bottom - y, D = Math.min(3.1, H - 0.1), cx = W / 2, cy = y + H / 2;
    const th = 0.3;
    // 象限：item0 左上、item1 左下、item2 右上、item3 右下
    const quad = [[185, 265, C.green, 225], [95, 175, C.rose, 135], [275, 355, C.rose, 315], [5, 85, C.green, 45]];
    for (const [a0, a1, fill] of quad) box(slide, "BLOCK_ARC", cx - D / 2, cy - D / 2, D, D, fill, { angle: [a0, a1], thick: th, name: G("圆环") });
    const r = D / 2 * (1 - th / 2), ic = D * 0.11;
    for (let i = 0; i < 4; i++) {
      const a = quad[i][3] * Math.PI / 180;
      await icon(slide, s.items[i].icon, C.white, cx + r * Math.cos(a) - ic / 2, cy + r * Math.sin(a) - ic / 2, ic, DEF[i], G("图标"));
    }
    const cd = D * 0.36;
    oval(slide, cx - cd / 2, cy - cd / 2, cd, C.white, { line: C.line, lw: 1, name: G("圆心") });
    await icon(slide, "grid", C.green, cx - cd * 0.22, cy - cd * 0.22, cd * 0.44, "grid", G("图标"));
    const tw = cx - D / 2 - 0.45 - (L + 0.2);
    s.items.forEach((it, i) => {
      const left = i < 2, x = left ? L + 0.2 : cx + D / 2 + 0.45, align = left ? "left" : "right";
      const bh = Hh(it.body, { w: tw, fontSize: 12, lineSpacingMultiple: 1.4 });
      const blockH = 0.5 + bh, half = Math.min(D / 2 + 0.2, H / 2);
      const yy = (i % 2 === 0 ? cy - half / 2 - blockH / 2 - 0.1 : cy + half / 2 - blockH / 2 + 0.1);
      const col = quad[i][2];
      T(slide, it.head, { x, y: yy, w: tw, h: 0.42, fontSize: one(it.head, { w: tw, max: 19, min: 14 }), color: col === C.rose ? C.roseT : C.green, fontFace: F.head, align, valign: "middle", noBalance: true, objectName: G("标题") });
      hline(slide, x, yy + 0.46, tw, C.line, 1, G("虚线"), "dash");
      T(slide, it.body, { x, y: yy + 0.56, w: tw, h: bh, fontSize: 12, color: C.body, align, lineSpacingMultiple: 1.4, objectName: G("正文") });
    });
  } else if (layout === "numbered") {
    // 左：引导语 + 01～04 编号列表；右：两张照片 + 图标方块（原第 14 页）
    const lx = L + 0.3, lw = 5.3, nx = lx + 0.62, nw = lw - 0.62;
    const rows = s.items.map((it) => 0.4 + Hh(it.body, { w: nw, fontSize: 12, lineSpacingMultiple: 1.35 }));
    const leadH = s.lead ? Hh(s.lead, { w: lw, fontSize: 13, lineSpacingMultiple: 1.45 }) : 0;
    const gap = Math.min(0.35, Math.max(0.15, (bottom - TOP - leadH - (leadH ? 0.3 : 0) - rows.reduce((a, b) => a + b, 0)) / 4));
    const block = (leadH ? leadH + 0.3 : 0) + rows.reduce((a, b) => a + b, 0) + gap * 3;
    let y = TOP + Math.max(0, (bottom - TOP - block) / 2);
    if (s.lead) { T(slide, s.lead, { x: lx, y, w: lw, h: leadH, fontSize: 13, color: C.ink, lineSpacingMultiple: 1.45, objectName: G("引导语") }); y += leadH + 0.3; }
    s.items.forEach((it, i) => {
      T(slide, num2(i), { x: lx, y: y - 0.04, w: 0.6, h: 0.46, fontSize: 20, color: C.roseT, fontFace: F.num, valign: "middle", noBalance: true, objectName: G("编号") });
      T(slide, it.head, { x: nx, y, w: nw, h: 0.38, fontSize: one(it.head, { w: nw, max: 15, min: 13, bold: true }), bold: true, color: C.ink, valign: "middle", noBalance: true, objectName: G("标题") });
      T(slide, it.body, { x: nx, y: y + 0.4, w: nw, h: rows[i] - 0.4, fontSize: 12, color: C.body, lineSpacingMultiple: 1.35, objectName: G("正文") });
      y += rows[i] + gap;
    });
    const px = 7.0, pw = R - 0.2 - px, ph = Math.min(2.3, (bottom - TOP - 0.25) / 2);
    const py0 = TOP + (bottom - TOP - (2 * ph + 0.25)) / 2;
    for (let k = 0; k < 2; k++) {
      const py = py0 + k * (ph + 0.25);
      await ctx.pic(slide, s, k, px, py, pw, ph, { fallback: ["photo15.jpg", "photo16.jpg"][k], name: G("照片") });
      rrect(slide, px - 0.22, py + ph - 0.62, 0.44, 0.44, tone(k), { r: 0.08, name: G("图标块") });
      await icon(slide, ["image", "book-open"][k], C.white, px - 0.12, py + ph - 0.52, 0.24, "image", G("图标"));
    }
  } else {
    // 中间照片 + 左右各两条，图标圆贴着照片（原第 18 页）
    let y = lead(slide, s, TOP, { align: "center", g: "body" });
    const H = bottom - y, pw = 3.0, ph = Math.min(4.2, H), cx = W / 2, py = y + (H - ph) / 2;
    await ctx.pic(slide, s, 0, cx - pw / 2, py, pw, ph, { radius: 0.35, fallback: "photo20.jpg", name: G("照片") });
    const d = 0.5, tw = cx - pw / 2 - 0.35 - d - 0.25 - (L + 0.2);
    for (let i = 0; i < 4; i++) {
      const it = s.items[i], left = i < 2, row = i % 2;
      const bh = Hh(it.body, { w: tw, fontSize: 12, lineSpacingMultiple: 1.4 });
      const blockH = 0.46 + bh;
      const yc = py + ph * (row ? 0.73 : 0.27), yy = yc - blockH / 2;
      const dx = left ? cx - pw / 2 - 0.35 - d : cx + pw / 2 + 0.35;
      const tx = left ? dx - 0.25 - tw : dx + d + 0.25, align = left ? "right" : "left";
      await iconDot(slide, it.icon, tone(i + row), dx, yy, d, DEF[i], G("图标"));
      T(slide, it.head, { x: tx, y: yy + 0.04, w: tw, h: 0.4, fontSize: one(it.head, { w: tw, max: 17, min: 13, bold: true }), bold: true, color: C.ink, align, valign: "middle", noBalance: true, objectName: G("标题") });
      T(slide, it.body, { x: tx, y: yy + 0.48, w: tw, h: bh, fontSize: 12, color: C.body, align, lineSpacingMultiple: 1.4, objectName: G("正文") });
    }
  }
  if (s.conclusion) conclusion(slide, s, bottom + 0.2);
}

/* ---------------- 对比 ---------------- */
async function compare(s) {
  const layout = ctx.pickLayout(s, ["cards", "duo"]);
  const slide = add(s);
  header(slide, s);
  const G = (l) => ctx.g("body", l);
  const bottom = bottomOf(s);
  let y = lead(slide, s, TOP, { align: "center", g: "body" });
  const most = Math.max(s.left.items.length, s.right.items.length);
  const x0 = L + 0.2, x1 = R - 0.2, gapX = 0.45, cw = (x1 - x0 - gapX) / 2;
  if (layout === "cards") {
    // 灰绿 / 豆沙红两张卡片，卡片里左照片右文字（原第 11 页）
    // 放不下时依次：缩窄照片 → 正文改 12pt
    let imgW, tw, fs, rl, rr, need;
    for ([imgW, fs] of [[1.75, 13], [1.2, 13], [1.2, 12], [0.9, 12]]) {
      tw = cw - imgW - 0.15 - 0.55;
      const rowH = (k) => s[k].items.map((t) => Math.max(0.42, Hh(t, { w: tw - 0.3, fontSize: fs, lineSpacingMultiple: 1.25 }) + 0.12));
      rl = rowH("left"); rr = rowH("right");
      need = 0.4 + 0.5 + 0.2 + Math.max(rl.reduce((a, b) => a + b, 0), rr.reduce((a, b) => a + b, 0)) + 0.3;
      if (need <= bottom - y) break;
    }
    const H = Math.min(bottom - y, Math.max(3.0, need));
    y += Math.max(0, (bottom - y - H) / 2);
    for (const [k, side] of [[0, "left"], [1, "right"]]) {
      const x = x0 + k * (cw + gapX), d = s[side], fill = k ? C.rose : C.green, rows = k ? rr : rl;
      rect(slide, x, y, cw, H, fill, { name: G("卡片") });
      await ctx.pic(slide, s, k, x + 0.15, y + 0.15, imgW, H - 0.3, { fallback: ["photo12.jpg", "photo13.jpg"][k], name: G("照片") });
      const tx = x + 0.15 + imgW + 0.35;
      let ty = y + 0.4;
      if (d.icon) await icon(slide, d.icon, C.white, tx, ty + 0.08, 0.34, "circle", G("图标"));
      const hx = d.icon ? tx + 0.46 : tx, hw = tw - (d.icon ? 0.46 : 0);
      T(slide, d.head, { x: hx, y: ty, w: hw, h: 0.5, fontSize: one(d.head, { w: hw, max: 19, min: 14, bold: true }), bold: true, color: C.white, valign: "middle", noBalance: true, objectName: G("标题") });
      ty += 0.5 + 0.2;
      hline(slide, tx, ty - 0.1, tw, C.white, 0.75, G("线"));
      d.items.forEach((t, i) => {
        oval(slide, tx, ty + 0.14, 0.1, C.white, { name: G("点") });
        T(slide, t, { x: tx + 0.3, y: ty, w: tw - 0.3, h: rows[i], fontSize: fs, color: C.white, lineSpacingMultiple: 1.25, objectName: G("条目") });
        ty += rows[i];
      });
    }
  } else {
    // 两栏：短色条 + 标题 + 照片 + 条目（原第 19 页）
    const itemH = (k) => s[k].items.map((t) => Math.max(0.36, Hh(t, { w: cw - 0.35, fontSize: 13, lineSpacingMultiple: 1.25 }) + 0.06));
    const il = itemH("left"), ir = itemH("right");
    const listH = Math.max(il.reduce((a, b) => a + b, 0), ir.reduce((a, b) => a + b, 0));
    const ph = Math.max(1.2, Math.min(2.4, bottom - y - 0.62 - 0.25 - listH));
    const block = 0.62 + ph + 0.25 + listH;
    y += Math.max(0, (bottom - y - block) / 2);
    for (const [k, side] of [[0, "left"], [1, "right"]]) {
      const x = x0 + k * (cw + gapX), d = s[side], col = k ? C.rose : C.green, rows = k ? ir : il;
      rect(slide, x, y, 0.42, 0.06, col, { name: G("短条") });
      const hx = d.icon ? x + 0.42 : x;
      if (d.icon) await icon(slide, d.icon, col, x, y + 0.18, 0.3, "circle", G("图标"));
      T(slide, d.head, { x: hx, y: y + 0.14, w: cw - (hx - x), h: 0.4, fontSize: one(d.head, { w: cw - 0.5, max: 16, min: 13, bold: true }), bold: true, color: k ? C.roseT : C.green, valign: "middle", noBalance: true, objectName: G("标题") });
      await ctx.pic(slide, s, k, x, y + 0.62, cw, ph, { fallback: ["photo21.jpg", "photo22.jpg"][k], name: G("照片") });
      let ty = y + 0.62 + ph + 0.25;
      d.items.forEach((t, i) => {
        oval(slide, x + 0.04, ty + 0.13, 0.1, col, { name: G("点") });
        T(slide, t, { x: x + 0.3, y: ty, w: cw - 0.35, h: rows[i], fontSize: 13, color: C.ink, lineSpacingMultiple: 1.25, objectName: G("条目") });
        ty += rows[i];
      });
    }
  }
  if (s.conclusion) conclusion(slide, s, bottom + 0.2);
}

/* ---------------- 数据 ---------------- */
const parseNum = (v) => { const m = String(v).replace(/,/g, "").match(/-?\d+(\.\d+)?/); return m ? +m[0] : null; };
const unitOf = (v) => String(v).replace(/[\d.,\s-]/g, "");
async function stats(s) {
  const vals = s.items.map((it) => parseNum(it.value)), units = s.items.map((it) => unitOf(it.value));
  const sameUnit = vals.every((v) => v !== null) && units.every((u) => u === units[0]);
  const layout = ctx.pickLayout(s, ["numbers", sameUnit || s.chart?.values ? "chart" : null]);
  const slide = add(s);
  header(slide, s);
  const G = (l) => ctx.g("body", l);
  const srcW = 10.6;
  const srcH = s.source ? Hh(`来源：${s.source}`, { w: srcW, fontSize: 9, lineSpacingMultiple: 1.2 }) : 0;
  const srcY = 7.08 - srcH;
  if (s.source) T(slide, `来源：${s.source}`, { x: L + 0.2, y: srcY, w: srcW, h: srcH, fontSize: 9, color: C.gray, lineSpacingMultiple: 1.2, objectName: G("来源") });
  const bottom = Math.min(BOT, srcY - 0.25);
  if (layout === "numbers") {
    // 数字卡片（新设计）：白卡片 + 叶子小图标 + 宋体大数字 + 短线 + 说明
    let y = lead(slide, s, TOP + 0.05, { g: "body", gap: 0.4, align: "center" });
    const n = s.items.length, gap = 0.4, x0 = L + 0.2, cw = Math.min(3.3, (R - 0.2 - x0 - (n - 1) * gap) / n);
    const startX = W / 2 - (n * cw + (n - 1) * gap) / 2;
    const labelH = Math.max(...s.items.map((it) => Hh(it.label, { w: cw - 0.5, fontSize: 13, lineSpacingMultiple: 1.3 })));
    const chh = Math.min(3.4, bottom - y, Math.max(2.6, 1.85 + labelH + 0.4));
    y += Math.max(0, (bottom - y - chh) / 2);
    for (let i = 0; i < n; i++) {
      const it = s.items[i], x = startX + i * (cw + gap);
      rrect(slide, x, y, cw, chh, C.white, { r: 0.08, name: G("卡片") });
      rect(slide, x + cw / 2 - 0.35, y, 0.7, 0.06, tone(i), { name: G("顶条") });
      const vf = /^[\x00-\x7f]+$/.test(String(it.value)) ? F.num : F.head;
      const vs = one(it.value, { w: cw - 0.7, max: 40, min: 20 });
      T(slide, it.value, { x: x + 0.15, y: y + 0.4, w: cw - 0.3, h: 0.95, fontSize: vs, color: i % 2 ? C.roseT : C.green, fontFace: vf, align: "center", valign: "middle", lineSpacingMultiple: 1.0, noBalance: true, objectName: G("数值") });
      hline(slide, x + cw / 2 - 0.25, y + 1.5, 0.5, C.line, 1.25, G("线"));
      T(slide, it.label, { x: x + 0.25, y: y + 1.7, w: cw - 0.5, h: chh - 1.85, fontSize: 13, color: C.body, align: "center", lineSpacingMultiple: 1.3, objectName: G("说明") });
    }
  } else {
    // 左数字列表 + 右柱状图（新设计）
    let y = lead(slide, s, TOP + 0.05, { g: "body" });
    const lw = 4.0, n = s.items.length, x = L + 0.2, rh = Math.min(1.25, (bottom - y) / n);
    const y0 = y + Math.max(0, (bottom - y - n * rh) / 2);
    s.items.forEach((it, i) => {
      const yy = y0 + i * rh;
      rect(slide, x, yy + 0.1, 0.06, rh - 0.3, tone(i), { name: G("竖条") });
      const vh = Math.min(0.7, rh * 0.55);
      T(slide, it.value, { x: x + 0.25, y: yy, w: lw - 0.3, h: vh, fontSize: Math.min(30, one(it.value, { w: lw - 0.6, max: 30, min: 18 })), color: i % 2 ? C.roseT : C.green, fontFace: /^[\x00-\x7f]+$/.test(String(it.value)) ? F.num : F.head, valign: "middle", lineSpacingMultiple: 1.0, noBalance: true, objectName: G("数值") });
      T(slide, it.label, { x: x + 0.25, y: yy + vh, w: lw - 0.3, h: 0.3, fontSize: one(it.label, { w: lw - 0.3, max: 12, min: 10 }), color: C.body, noBalance: true, objectName: G("说明") });
    });
    const cx = x + lw + 0.5, cw = R - 0.2 - cx;
    const ch = s.chart || {};
    const labels = ch.labels || s.items.map((it) => it.label);
    const values = ch.values || vals;
    let cy = y;
    rrect(slide, cx, cy, cw, bottom - cy, C.white, { r: 0.06, name: G("图表底") });
    cy += 0.2;
    if (ch.title) { T(slide, ch.title, { x: cx + 0.3, y: cy, w: cw - 0.6, h: 0.36, fontSize: 13, bold: true, color: C.ink, noBalance: true, objectName: G("图表标题") }); cy += 0.45; }
    slide.addChart(ctx.charts.BAR, [{ name: ch.title || "数据", labels, values }], {
      x: cx + 0.2, y: cy, w: cw - 0.4, h: bottom - cy - 0.15, barDir: "col", chartColors: [C.green], barGapWidthPct: 90,
      catAxisLabelColor: C.body, valAxisLabelColor: C.gray, catAxisLabelFontSize: 10, valAxisLabelFontSize: 9, catAxisLabelFontFace: F.body,
      valGridLine: { color: "EAE5E1", size: 0.5 }, catAxisLineShow: false, valAxisLineShow: false,
      showValue: true, dataLabelColor: C.ink, dataLabelFontSize: 10, dataLabelFormatCode: ch.unit === "%" ? '0"%"' : "General", showLegend: false,
      objectName: G("图表"),
    });
  }
}

/* ---------------- 时间线 ---------------- */
async function timeline(s) {
  ctx.pickLayout(s, ["zigzag"]);
  const slide = add(s);
  header(slide, s);
  // 横轴 + 上下交错的线框卡片，卡片对面是时间和图标圆（原第 13 页）
  let y = lead(slide, s, TOP, { g: "body", align: "center", gap: 0.15 });
  const bottom = bottomOf(s);
  const n = s.items.length, x0 = L + 0.25, x1 = R - 0.25, colW = (x1 - x0) / n, cw = colW - 0.3, tw = cw - 0.3;
  const hs = Math.min(...s.items.map((it) => one(it.head, { w: tw, max: 16, min: 12, bold: true })));
  const bodyH = Math.max(0, ...s.items.map((it) => (it.body ? Hh(it.body, { w: tw, fontSize: 11.5, lineSpacingMultiple: 1.35 }) : 0)));
  const cardH = 0.3 + 0.4 + (bodyH ? 0.08 + bodyH : 0) + 0.2;
  const side = Math.max(cardH + 0.45, 1.75);           // 轴到卡片外沿 / 图标外沿的距离
  const cy = Math.max(y + side, Math.min(bottom - side, (y + bottom) / 2));
  const ga = ctx.g("axis");
  hline(slide, x0 - 0.1, cy, x1 - x0 + 0.2, C.sand, 1.5, ga);
  for (let i = 0; i < n; i++) {
    const cx = x0 + colW * (i + 0.5), col = tone(i);
    oval(slide, cx - 0.15, cy - 0.15, 0.3, C.bg, { line: col, lw: 1.75, name: ga });
    oval(slide, cx - 0.06, cy - 0.06, 0.12, col, { name: ga });
  }
  const DEF = ["file-text", "monitor", "grid", "flag", "award"];
  for (let i = 0; i < n; i++) {
    const it = s.items[i], g = ctx.g("item" + i), up = i % 2 === 0, cx = x0 + colW * (i + 0.5), col = tone(i);
    const cyTop = up ? cy - 0.4 - cardH : cy + 0.4;
    box(slide, "RECTANGLE", cx - cw / 2, cyTop, cw, cardH, C.card, { line: C.line, lw: 1, name: g });
    T(slide, it.head, { x: cx - tw / 2, y: cyTop + 0.3, w: tw, h: 0.4, fontSize: hs, bold: true, color: C.ink, align: "center", valign: "middle", noBalance: true, objectName: g });
    if (it.body) T(slide, it.body, { x: cx - tw / 2, y: cyTop + 0.78, w: tw, h: bodyH, fontSize: 11.5, color: C.body, align: "center", lineSpacingMultiple: 1.35, objectName: g });
    // 对面：时间 + 图标圆
    const tsz = one(it.time, { w: cw, max: 15, min: 11, bold: true });
    const timeY = up ? cy + 0.22 : cy - 0.22 - 0.34;
    T(slide, it.time, { x: cx - cw / 2, y: timeY, w: cw, h: 0.34, fontSize: tsz, bold: true, color: col === C.rose ? C.roseT : C.green, align: "center", valign: "middle", noBalance: true, objectName: g });
    const d = 0.62, iy = up ? cy + 0.66 : cy - 0.66 - d;
    oval(slide, cx - d / 2, iy, d, null, { line: col, lw: 1.25, name: g });
    await icon(slide, it.icon, col, cx - 0.16, iy + d / 2 - 0.16, 0.32, DEF[i % 5], g);
  }
  if (s.conclusion) conclusion(slide, s, bottom + 0.2);
}

/* ---------------- 大图配文 ---------------- */
async function imageText(s) {
  const layout = ctx.pickLayout(s, ["side", "panel"]);
  const slide = add(s);
  header(slide, s);
  const G = (l) => ctx.g("body", l);
  const pts = s.points || [];
  if (layout === "side") {
    // 左照片，右正文 + 图标要点 + 结论（原第 17 页）
    const px = L + 0.2, pw = 5.1;
    const x = px + pw + 0.6, w = R - 0.2 - x;
    const bodySize = ctx.fit(s.body, { w, h: 2.1, max: 14, min: 12, lineSpacingMultiple: 1.55 });
    const bh = Hh(s.body, { w, fontSize: bodySize, lineSpacingMultiple: 1.55 });
    const ptH = pts.map((p) => Math.max(0.46, Hh(p, { w: w - 0.65, fontSize: 13, bold: true, lineSpacingMultiple: 1.3 })));
    const cH = concH(s, w);
    const need = bh + (pts.length ? 0.3 + ptH.reduce((a, b) => a + b + 0.18, 0) - 0.18 : 0) + (cH ? 0.3 + cH : 0);
    const ph = Math.min(4.3, BOT - TOP - 0.2), py = TOP + (BOT - TOP - ph) / 2;
    await ctx.pic(slide, s, 0, px, py, pw, ph, { fallback: "photo19.jpg", name: G("照片") });
    let y = Math.max(TOP, py + (ph - need) / 2);
    T(slide, s.body, { x, y, w, h: bh, fontSize: bodySize, color: C.ink, lineSpacingMultiple: 1.55, objectName: G("正文") });
    y += bh;
    if (pts.length) y += 0.3;
    const DEF = ["check", "star", "heart"];
    for (const [i, p] of pts.entries()) {
      rrect(slide, x, y + (ptH[i] - 0.42) / 2, 0.42, 0.42, tone(i), { r: 0.08, name: G("图标块") });
      await icon(slide, DEF[i], C.white, x + 0.1, y + (ptH[i] - 0.42) / 2 + 0.1, 0.22, "check", G("图标"));
      T(slide, p, { x: x + 0.65, y, w: w - 0.65, h: ptH[i], fontSize: 13, bold: true, color: i % 2 ? C.roseT : C.green, valign: "middle", lineSpacingMultiple: 1.3, objectName: G("要点") });
      y += ptH[i] + 0.18;
    }
    if (cH) conclusion(slide, s, y - (pts.length ? 0.18 : 0) + 0.3, { x, w });
  } else {
    // 左竖照片；右上正文；右下灰绿面板放要点 + 结论（原第 10 页）
    const px = L + 0.4, pw = 3.6;
    const x = px + pw + 0.55, w = R - 0.3 - x;
    const panelTxtW = w - 1.1;
    const ptH = pts.map((p) => Math.max(0.4, Hh(p, { w: panelTxtW, fontSize: 13, bold: true, lineSpacingMultiple: 1.3 })));
    const cTxtH = s.conclusion ? Hh(s.conclusion, { w: panelTxtW, fontSize: 12.5, lineSpacingMultiple: 1.35 }) : 0;
    const panelH = pts.length || s.conclusion ? 0.55 + ptH.reduce((a, b) => a + b + 0.16, 0) - (pts.length ? 0.16 : 0) + (cTxtH ? (pts.length ? 0.3 : 0) + cTxtH : 0) + 0.45 : 0;
    const bodySize = ctx.fit(s.body, { w, h: panelH ? 2.0 : 3.2, max: 14, min: 12, lineSpacingMultiple: 1.55 });
    const bh = Hh(s.body, { w, fontSize: bodySize, lineSpacingMultiple: 1.55 });
    const right = bh + (panelH ? 0.4 + panelH : 0);
    const ph = Math.min(BOT - TOP - 0.1, Math.max(3.6, right)), py = TOP + (BOT - TOP - ph) / 2;
    if (panelH) rect(slide, x - 0.85, py + ph - panelH, w + 1.15, panelH, C.green, { name: G("面板") });
    await ctx.pic(slide, s, 0, px, py, pw, ph, { fallback: "photo11.jpg", name: G("照片") });
    let y = panelH ? py + (ph - panelH - 0.4 - bh) / 2 : py + (ph - bh) / 2;
    T(slide, s.body, { x, y, w, h: bh, fontSize: bodySize, color: C.ink, lineSpacingMultiple: 1.55, objectName: G("正文") });
    if (panelH) {
      let yy = py + ph - panelH + 0.55 - 0.1;
      for (const [i, p] of pts.entries()) {
        await iconDot(slide, ["feather", "bookmark", "star"][i], C.white, x + 0.05, yy + (ptH[i] - 0.4) / 2, 0.4, "feather", G("图标"));
        T(slide, p, { x: x + 0.65, y: yy, w: panelTxtW, h: ptH[i], fontSize: 13, bold: true, color: C.white, valign: "middle", lineSpacingMultiple: 1.3, objectName: G("要点") });
        yy += ptH[i] + 0.16;
      }
      if (cTxtH) {
        if (pts.length) { yy += 0.14; hline(slide, x + 0.65, yy - 0.12, 0.5, C.white, 1, G("线")); }
        T(slide, s.conclusion, { x: x + 0.65, y: yy, w: panelTxtW, h: cTxtH, fontSize: 12.5, color: C.white, lineSpacingMultiple: 1.35, objectName: G("结论") });
      }
    }
  }
}
/* ---------------- 金句 ---------------- */
async function quote(s) {
  ctx.pickLayout(s, ["leaf"]);
  const slide = add(s);
  await frame(slide, { leaf: "left", flowers: true });
  const g = ctx.g("quote"), cx = W / 2, w = 8.4;
  const size = ctx.fit(s.text, { w, h: 2.4, max: 32, min: 22, lineSpacingMultiple: 1.4 });
  const txt = ctx.balance(s.text, { w, fontSize: size, lineSpacingMultiple: 1.4 });
  const th = Hh(txt, { w, fontSize: size, lineSpacingMultiple: 1.4 });
  const total = 0.9 + th + (s.author ? 0.75 : 0);
  let y = Math.max(1.3, 3.6 - total / 2);
  T(slide, "“", { x: cx - 0.6, y: y - 0.2, w: 1.2, h: 1.1, fontSize: 80, color: C.rose, fontFace: F.num, align: "center", noBalance: true, objectName: ctx.g("quote", "装饰引号") });
  y += 0.9;
  T(slide, txt, { x: cx - w / 2, y, w, h: th, fontSize: size, fontFace: F.head, color: C.ink, align: "center", lineSpacingMultiple: 1.4, noBalance: true, objectName: g });
  y += th;
  if (s.author) {
    y += 0.35;
    const aw = Math.min(5, wid(s.author, { fontSize: 14 }) + 0.1);
    T(slide, s.author, { x: cx - aw / 2, y, w: aw, h: 0.36, fontSize: 14, color: C.roseT, align: "center", valign: "middle", noBalance: true, objectName: g });
    hline(slide, cx - aw / 2 - 0.75, y + 0.18, 0.55, C.rose, 1.25, g);
    hline(slide, cx + aw / 2 + 0.2, y + 0.18, 0.55, C.rose, 1.25, g);
  }
}

/* ---------------- 表格 ---------------- */
async function table(s) {
  ctx.pickLayout(s, ["grid"]);
  const slide = add(s);
  header(slide, s);
  const G = (l) => ctx.g("body", l);
  let y = lead(slide, s, TOP, { g: "body" });
  const bottom = bottomOf(s);
  const rows = s.rows || [], x = L + 0.2, tw = R - 0.2 - x;
  const widths = s.columns.map((c, j) => Math.max(wid(c, { fontSize: 14, bold: true }), ...rows.map((r) => Math.min(4.2, wid(r[j] || "", { fontSize: 12 }))), 1.0) + 0.4);
  const sum = widths.reduce((a, b) => a + b, 0), cw = widths.map((v) => (v / sum) * tw);
  const rh = Math.min(0.72, (bottom - y) / (rows.length + 1));
  const data = [s.columns.map((c) => ({ text: c, options: { bold: true, color: C.white, fill: { color: C.green }, fontSize: 14 } }))];
  rows.forEach((r, i) => data.push(s.columns.map((_, j) => ({ text: r[j] || "", options: { color: C.ink, fill: { color: i % 2 ? C.card : C.white }, fontSize: 12 } }))));
  slide.addTable(data, { x, y, w: tw, colW: cw, rowH: rh, fontFace: F.body, valign: "middle", margin: [0, 0.14, 0, 0.14], border: { type: "solid", color: "E2DCD7", pt: 0.75 }, objectName: G("表格") });
  if (s.conclusion) conclusion(slide, s, bottom + 0.2);
}

async function render(deck, c) {
  ctx = c;
  ctx.pres.defineSlideMaster({ title: "SB_BG", background: { color: C.bg } });
  await ctx.renderAll({ cover, toc, section, points3, points4, compare, stats, timeline, imageText, quote, closing, table });
}
module.exports = { render };
