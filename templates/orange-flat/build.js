/**
 * 模板：橙意扁平（orange-flat）
 * ------------------------------------------------------------------
 * 来源：网络模板「20XX 工作总结汇报」（橙色扁平长投影风，25 页）。
 * 浅灰底（#F9F9F9）+ 橙（#DE5000）+ 深灰（#555555），标志元素是圆角三角的「拨片」形状和 45° 长投影：
 * 封面 / 结尾是大拨片照片 + 橙色拨片压字，章节页是顶部拨片（内嵌小照片）+ 大标题，
 * 内容页左上角小橙拨片 + 标题，右下角是各章节名组成的导航。
 *
 * 动效：完全照原模板（motion.json，由 tools/motion_extract.py 从原 .pptx 抽出）：
 *   翻页全部「门」1.4 秒；每页翻完后动画自动连播（autoStart），没有需要单击的步骤；
 *   内容页标题栏不动，正文按原页面的顺序：主体进入 → 长投影淡入 → 文字进入。
 *   这里只负责给元素分组：ctx.g("组名")。组名和 motion.json 的 pages 一一对应。
 *
 * 拨片形状：用原模板的路径（PICK_PATH，三次贝塞尔）画成可编辑的自定义形状；
 * 长投影：按形状轮廓沿 45° 拉伸后做渐变，生成透明 PNG（名字带 static，质检不把它当底色）；
 * 拨片里的照片：先按外框裁好，再用同一条路径做蒙版。
 *
 * 版式（和 meta.json → layouts 一致）：
 *   cover     hero                   右侧大拨片照片 + 左侧橙色拨片压标题（原第 1 页）
 *   toc       list                   左侧橙色拨片「目录 CONTENTS」+ 右侧圆圈编号列表，5 条以上分两列（原第 2 页）
 *   section   pick                   顶部拨片内嵌小照片 + PART 编号，下方大标题（原第 3 页）
 *   points3   picks | cards          三张拨片照片 + 文字（原第 11 页）/ 三张白卡片 + 底部色条（原第 13 页）
 *   points4   cards | rings | hub    四张白卡片（原第 13 页）/ 四个圆环（原第 21 页）/ 中心圆照片 + 四周图标（原第 17 页）
 *   compare   blocks | frames        橙灰两块 + 右侧大图（原第 10 页）/ 两个橙色相框（原第 24 页）
 *   stats     bars | peaks | numbers 拨片照片 + 进度条（原第 7 页，全是百分比时）/ 山峰图（原第 8 页，同单位数值）/ 数字圆环（新设计）
 *   timeline  line                   横向时间轴，条目上下交替（原第 23 页）
 *   imageText pick | panel           左侧大拨片照片 + 右侧文字（原第 7 页）/ 橙灰色块 + 右侧大图（原第 10 页）
 *   quote     pick                   顶部拨片引号 + 居中金句（新设计，沿用章节页）
 *   closing   thanks                 同封面（原第 25 页）
 *   table     grid       （可选）    橙色表头 + 隔行浅灰（新设计）
 *   steps     arrows     （可选）    左侧文字 + 右侧橙白箭头（原第 19 页）
 */
const sharp = require("sharp");

const C = {
  o: "DE5000", g: "555555", ink: "404040", body: "666666", light: "8C8C8C", nav: "A6A6A6",
  bg: "F9F9F9", white: "FFFFFF", track: "EDEDED", line: "D9D9D9", rowAlt: "F3F3F3",
};
const F = { head: "微软雅黑", body: "微软雅黑", num: "Arial" };
const W = 13.333, H = 7.5, L = 0.85, R = W - 0.85, TOP = 1.55, BOTTOM = 6.85;
const PHOTOS = ["photo_laptop.jpg", "photo_write.jpg", "photo_phone.jpg", "photo_desk.jpg", "photo_office.jpg", "photo_meeting.jpg", "photo_city.jpg", "photo_night.jpg", "photo_apps.jpg"];
const ICONS = ["target", "trending-up", "users", "award", "briefcase", "pie-chart", "flag", "star"];

let ctx;

/* ---------------- 拨片形状（原模板路径，单位 EMU） ---------------- */
const PW = 15105456, PH = 14863851;
const PICK_PATH = [
  ["M", 7433887, 268],
  ["C", 5721391, -26383, 3342882, 1936394, 1667178, 4920872],
  ["C", 239727, 7463205, -289215, 10054975, 150574, 11662331],
  ["L", 159932, 11692695], ["L", 165780, 11728888],
  ["C", 545757, 13489750, 3705628, 14863851, 7547446, 14863851],
  ["C", 11261203, 14863851, 14337719, 13579830, 14881926, 11903648],
  ["L", 14909761, 11800558], ["L", 14923904, 11761043],
  ["C", 15434087, 10162959, 14860547, 7468785, 13310172, 4851018],
  ["C", 11824395, 2342324, 9845883, 586608, 8234354, 162370],
  ["L", 8119928, 136115], ["L", 8105217, 129095],
  ["C", 7896733, 46048, 7671734, 3970, 7433887, 268],
];
/** 拨片的 pptxgenjs 路径点（形状自身坐标，英寸；旋转 / 翻转交给 rotate / flipH） */
function pickPoints(w, h) {
  const sx = w / PW, sy = h / PH;
  const pts = PICK_PATH.map((c) => (c[0] === "M" ? { x: c[1] * sx, y: c[2] * sy, moveTo: true }
    : c[0] === "L" ? { x: c[1] * sx, y: c[2] * sy }
      : { x: c[5] * sx, y: c[6] * sy, curve: { type: "cubic", x1: c[1] * sx, y1: c[2] * sy, x2: c[3] * sx, y2: c[4] * sy } }));
  pts.push({ close: true });
  return pts;
}
/** 拨片轮廓（页面坐标，已旋转 / 翻转），用来算投影和照片蒙版。和 PowerPoint 一样：先水平翻转，再绕中心顺时针旋转 */
function pickPoly(x, y, w, h, rot = 0, flip = false) {
  const raw = [];
  let cur = [0, 0];
  for (const c of PICK_PATH) {
    if (c[0] === "M" || c[0] === "L") { cur = [c[1], c[2]]; raw.push(cur); continue; }
    const [x1, y1, x2, y2, x3, y3] = c.slice(1), [x0, y0] = cur;
    for (let k = 1; k <= 14; k++) {
      const t = k / 14, u = 1 - t;
      raw.push([u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]);
    }
    cur = [x3, y3];
  }
  const a = (rot * Math.PI) / 180, cs = Math.cos(a), sn = Math.sin(a);
  return raw.map(([px, py]) => {
    let lx = (px / PW) * w, ly = (py / PH) * h;
    if (flip) lx = w - lx;
    const dx = lx - w / 2, dy = ly - h / 2;
    return [x + w / 2 + dx * cs - dy * sn, y + h / 2 + dx * sn + dy * cs];
  });
}
const bboxOf = (P) => {
  const xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};
/** 让旋转后的拨片正好放进 (bx,by,bw,bh)，居中。返回 { x,y,w,h,rot,flip,poly } */
function fitPick(bx, by, bw, bh, rot, flip) {
  const b0 = bboxOf(pickPoly(0, 0, 1, PH / PW, rot, flip));
  const k = Math.min(bw / b0.w, bh / b0.h);
  const w = k, h = k * PH / PW;
  const b1 = bboxOf(pickPoly(0, 0, w, h, rot, flip));
  const x = bx + (bw - b1.w) / 2 - b1.x, y = by + (bh - b1.h) / 2 - b1.y;
  return { x, y, w, h, rot, flip, poly: pickPoly(x, y, w, h, rot, flip) };
}
function addPick(slide, p, fill, name = "") {
  slide.addShape(ctx.shapes.CUSTOM_GEOMETRY, {
    x: p.x, y: p.y, w: p.w, h: p.h, rotate: p.rot || 0, flipH: !!p.flip,
    fill: { color: fill }, line: { type: "none" }, points: pickPoints(p.w, p.h), objectName: name,
  });
}
const P = (x, y, w, h, rot, flip) => ({ x, y, w, h, rot, flip, poly: pickPoly(x, y, w, h, rot, flip) });

/* ---------------- 几何小工具 ---------------- */
function hull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const rectPoly = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const circlePoly = (cx, cy, r) => Array.from({ length: 48 }, (_, k) => [cx + r * Math.cos((k / 48) * 2 * Math.PI), cy + r * Math.sin((k / 48) * 2 * Math.PI)]);
const svgPts = (Q) => Q.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(" ");

/** 45° 长投影：轮廓沿右下方向拉伸 len 英寸，渐变淡出，裁到画布内。label 带 static：质检把它当透明层 */
async function shadow(slide, poly, { len = 2.5, a = 0.3, g = null } = {}) {
  const Q = hull(poly.concat(poly.map(([x, y]) => [x + len, y + len])));
  const b = bboxOf(Q);
  const x0 = Math.max(0, b.x), y0 = Math.max(0, b.y), x1 = Math.min(W, b.x + b.w), y1 = Math.min(H, b.y + b.h);
  if (x1 - x0 < 0.05 || y1 - y0 < 0.05) return;
  const lead = poly.reduce((m, p) => (p[0] + p[1] > m[0] + m[1] ? p : m), poly[0]);
  const t0 = Math.max(...poly.map((p) => p[0] + p[1])) - 0.6 * Math.min(1.2, len * 0.3);
  const sx = lead[0] - (lead[0] + lead[1] - t0) / 2, sy = lead[1] - (lead[0] + lead[1] - t0) / 2;
  const name = g ? ctx.g(g, "投影static") : "投影static";
  if (ctx.dry) { slide.addImage({ data: "image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", x: x0, y: y0, w: x1 - x0, h: y1 - y0, objectName: name }); return; }
  const ppi = 40, pw = Math.max(4, Math.round((x1 - x0) * ppi)), ph = Math.max(4, Math.round((y1 - y0) * ppi));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}" viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" preserveAspectRatio="none">`
    + `<defs><linearGradient id="s" gradientUnits="userSpaceOnUse" x1="${sx}" y1="${sy}" x2="${sx + len * 0.75}" y2="${sy + len * 0.75}">`
    + `<stop offset="0" stop-color="#404040" stop-opacity="${a}"/><stop offset="0.55" stop-color="#d9d9d9" stop-opacity="${(a * 0.9).toFixed(3)}"/><stop offset="1" stop-color="#f2f2f2" stop-opacity="0"/></linearGradient></defs>`
    + `<polygon points="${svgPts(Q)}" fill="url(#s)"/></svg>`;
  const data = "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
  slide.addImage({ data, x: x0, y: y0, w: x1 - x0, h: y1 - y0, objectName: name });
}

/** 拨片里的照片：按外框（裁到画布内）取图，再用轮廓做蒙版 */
async function pickPhoto(slide, s, idx, poly, { fallback, g, label = "照片" }) {
  const b = bboxOf(poly);
  const x0 = Math.max(0, b.x), y0 = Math.max(0, b.y), x1 = Math.min(W, b.x + b.w), y1 = Math.min(H, b.y + b.h);
  const w = x1 - x0, h = y1 - y0;
  const p = await ctx.image(s, idx, w, h, { fallback });
  const name = ctx.g(g, label);
  if (ctx.dry) { slide.addImage({ path: p, x: x0, y: y0, w, h, objectName: name }); return; }
  const m = await sharp(p).metadata();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${m.width}" height="${m.height}" viewBox="${x0} ${y0} ${w} ${h}" preserveAspectRatio="none"><polygon points="${svgPts(poly)}" fill="#fff"/></svg>`;
  const out = p.replace(/\.(png|jpe?g)$/i, "") + "_pick.png";
  const mask = await sharp(Buffer.from(svg)).resize(m.width, m.height).png().toBuffer();
  await sharp(p).ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toFile(out);
  slide.addImage({ path: out, x: x0, y: y0, w, h, objectName: name });
}

/* ---------------- 排版组件 ---------------- */
function T(slide, str, o) {
  if (str === undefined || str === null || str === "") return 0;
  const opt = { margin: 0, color: C.ink, fontFace: F.body, fontSize: 12, valign: "top", lineSpacingMultiple: 1.25, ...o };
  const s = o.noBalance ? String(str) : ctx.balance(String(str), { w: opt.w, fontSize: opt.fontSize, bold: opt.bold, charSpacing: opt.charSpacing, lineSpacingMultiple: opt.lineSpacingMultiple });
  delete opt.noBalance;
  slide.addText(s, opt);
  return opt.h;
}
const Hh = (str, o) => (str ? ctx.measure(String(str), { lineSpacingMultiple: 1.25, ...o }).needH + 0.03 : 0);
const one = (str, o) => ctx.fitLine(String(str || ""), o);
const wid = (str, o) => ctx.measure(String(str || ""), { w: 40, ...o }).longest || 0;
const num2 = (i) => String(i + 1).padStart(2, "0");
function box(slide, kind, x, y, w, h, fill, o = {}) {
  slide.addShape(ctx.shapes[kind], {
    x, y, w, h, fill: fill ? { color: fill, transparency: o.tr || 0 } : { type: "none" },
    line: o.line ? { color: o.line, width: o.lw || 1, dashType: o.dash } : { type: "none" },
    rectRadius: o.radius, rotate: o.rotate, flipH: o.flipH, flipV: o.flipV, angleRange: o.angle, arcThicknessRatio: o.thick,
    objectName: o.name || "",
  });
}
const rect = (sl, x, y, w, h, fill, o) => box(sl, "RECTANGLE", x, y, w, h, fill, o);
const oval = (sl, x, y, d, fill, o) => box(sl, "OVAL", x, y, d, d, fill, o);
function hline(sl, x, y, w, color = C.line, width = 0.75, name = "", dash) { sl.addShape(ctx.shapes.LINE, { x, y, w, h: 0, line: { color, width, dashType: dash }, objectName: name }); }
function seg(sl, x1, y1, x2, y2, color, width, name, dash) {
  sl.addShape(ctx.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), flipH: (x2 < x1) !== (y2 < y1) && false, flipV: (x2 - x1) * (y2 - y1) < 0, line: { color, width, dashType: dash }, objectName: name });
}
async function icon(sl, name, color, x, y, s, def, g) {
  sl.addImage({ data: await ctx.icon(name, color, def), x, y, w: s, h: s, objectName: g });
}

/* ---------------- 页面 / 页眉 / 导航 ---------------- */
function add(s) { return ctx.addSlide(s, { master: "OF_BG", bg: C.bg }); }
const eyebrowOf = (s) => (s.eyebrow !== undefined ? s.eyebrow : s._sectionNo ? `${s._num} · ${s._sectionTitle}` : "");
const navItems = () => ctx.deck.slides.filter((x) => x.type === "section").map((x) => x.title).slice(0, 4);
/** 导航：各章节名，竖线分隔（装饰，不参与质检） */
function nav(slide, x, y, w, align, name) {
  const items = navItems();
  if (!items.length) return;
  const str = "|   " + items.join("   |   ") + "   |";
  const size = one(str, { w, max: 10, min: 7 });
  T(slide, str, { x, y, w, h: 0.28, fontSize: size, color: C.nav, align, valign: "middle", noBalance: true, objectName: name || "装饰导航" });
}
/** 内容页标题栏（静止：原模板里标题栏没有动画） */
async function header(slide, s) {
  const p = P(0.48, 0.23, 0.95, 0.93, 323.7, true);
  await shadow(slide, p.poly, { len: 1.1, a: 0.32 });
  addPick(slide, p, C.o);
  const size = one(s.title, { w: 9.6, max: 30, min: 20, bold: true });
  T(slide, s.title, { x: 1.68, y: 0.32, w: 9.8, h: 0.62, fontSize: size, bold: true, color: C.ink, valign: "middle", noBalance: true });
  const eb = eyebrowOf(s);
  if (eb) T(slide, eb, { x: 1.7, y: 0.94, w: 8, h: 0.26, fontSize: 10, color: C.light, noBalance: true });
  nav(slide, 6.4, 7.0, 6.5, "right");
}
/** 引导语 */
function lead(slide, s, y, o = {}) {
  if (!s.lead) return y;
  const x = o.x ?? L, w = o.w ?? R - L, size = o.size || 14;
  const h = Hh(s.lead, { w, fontSize: size, bold: true });
  T(slide, s.lead, { x, y, w, h, fontSize: size, bold: true, color: C.ink, align: o.align, objectName: ctx.g(o.g || "note", "引导语") });
  return y + h + (o.gap ?? 0.25);
}
/** 结论条：白底 + 橙色竖条 */
const concH = (s, w = R - L) => (s.conclusion ? Math.max(0.5, Hh(s.conclusion, { w: w - 0.55, fontSize: 13, bold: true }) + 0.2) : 0);
function conclusion(slide, s, y, o = {}) {
  if (!s.conclusion) return y;
  const x = o.x ?? L, w = o.w ?? R - L, g = ctx.g(o.g || "note", "结论"), h = concH(s, w);
  rect(slide, x, y, w, h, C.white, { name: g });
  rect(slide, x, y, 0.08, h, C.o, { name: g });
  T(slide, s.conclusion, { x: x + 0.3, y, w: w - 0.55, h, fontSize: 13, bold: true, color: C.ink, valign: "middle", objectName: g });
  return y + h;
}
const bottomOf = (s, w) => BOTTOM - (s.conclusion ? concH(s, w) + 0.2 : 0);

/* ---------------- 封面 / 结尾 ---------------- */
async function hero(s, closing) {
  ctx.pickLayout(s, [closing ? "thanks" : "hero"]);
  const slide = add(s);
  // 右侧大拨片照片（伸出画布，裁到画布内）
  await pickPhoto(slide, s, 0, pickPoly(5.57, -1.58, 10.03, 9.87, 279.8, true), { fallback: "photo_beach.jpg", g: "photo" });
  const big = P(0.25, 1.85, 5.15, 5.07, 213, false), dot = P(1.09, 0.98, 0.83, 0.82, 204.5, true), small = P(5.05, 5.7, 1.09, 1.07, 166.7, true);
  for (const [p, len] of [[dot, 1.6], [big, 3.2], [small, 1.6]]) await shadow(slide, p.poly, { len, a: 0.3, g: "shadow" });
  addPick(slide, dot, C.white, ctx.g("dot"));
  addPick(slide, big, C.o, ctx.g("pick"));
  addPick(slide, small, C.o, ctx.g("pick2"));
  nav(slide, 0.59, 0.42, 5.4, "left", ctx.g("nav", "装饰导航"));
  // 三条短线（原模板左下角的菜单图标）
  for (let k = 0; k < 3; k++) hline(slide, 0.67, 6.97 + k * 0.075, 0.28, C.o, 1, ctx.g("menu", "装饰"));
  // 文字（拨片内）
  const x = 1.1, tw = 3.55;
  // 标题：一行放得下（≥30pt）就一行；否则在空格 / 标点处断成两行
  let title = String(s.title), tSize = one(title, { w: tw, max: 40, min: 30, bold: true });
  if (ctx.measure(title, { w: tw, fontSize: tSize, bold: true }).lines > 1) {
    const p = title.search(/[，,：:；;！!？?\s]/);
    if (!title.includes("\n") && p > 1 && p < title.length - 2) title = title.slice(0, p + (/\s/.test(title[p]) ? 0 : 1)).trim() + "\n" + title.slice(p + 1).trim();
    const parts = title.split("\n");
    tSize = Math.min(...parts.map((l) => one(l, { w: tw, max: 40, min: 20, bold: true })));
    if (parts.length < 2 || parts.some((l) => ctx.measure(l, { w: tw, fontSize: tSize, bold: true }).lines > 1)) {
      title = String(s.title);
      tSize = ctx.fit(title, { w: tw, h: 1.45, max: 40, min: 22, bold: true, lineSpacingMultiple: 1.1 });
    }
  }
  const th = Hh(title, { w: tw, fontSize: tSize, bold: true, lineSpacingMultiple: 1.1 });
  const sub = closing ? "" : s.subtitle;
  const sSize = sub ? ctx.fit(sub, { w: tw, h: 0.62, max: 17, min: 12, lineSpacingMultiple: 1.15 }) : 0;
  const sh = sub ? Hh(sub, { w: tw, fontSize: sSize, lineSpacingMultiple: 1.15 }) : 0;
  const desc = closing ? s.body : s.desc;
  const dh = desc ? Hh(desc, { w: tw, fontSize: 11 }) : 0;
  const tag = s.tag || (closing ? "" : ctx.deck.meta?.author ? `汇报人：${ctx.deck.meta.author}` : "");
  const tagH = tag ? 0.34 : 0;
  const total = th + (sh ? 0.12 + sh : 0) + (dh ? 0.15 + dh : 0) + (tagH ? 0.2 + tagH : 0);
  let y = Math.max(2.45, 4.05 - total / 2);
  T(slide, title, { x, y, w: tw, h: th, fontSize: tSize, bold: true, color: C.white, lineSpacingMultiple: 1.1, noBalance: title.includes("\n"), objectName: ctx.g("title") });
  y += th;
  if (sub) { y += 0.12; T(slide, sub, { x, y, w: tw, h: sh, fontSize: sSize, color: C.white, lineSpacingMultiple: 1.15, objectName: ctx.g("sub") }); y += sh; }
  if (desc) { y += 0.15; T(slide, desc, { x, y, w: tw, h: dh, fontSize: 11, color: C.white, objectName: ctx.g("desc") }); y += dh; }
  if (tag) {
    y += 0.2;
    const ts = one(tag, { w: tw - 0.4, max: 11, min: 9 }), pw = Math.min(tw, wid(tag, { fontSize: ts }) + 0.45);
    box(slide, "ROUNDED_RECTANGLE", x, y, pw, tagH, C.white, { radius: tagH / 2, name: ctx.g("tag") });
    T(slide, tag, { x, y, w: pw, h: tagH, fontSize: ts, color: C.o, align: "center", valign: "middle", noBalance: true, objectName: ctx.g("tag") });
  }
}
const cover = (s) => hero(s, false);
const closing = (s) => hero(s, true);

/* ---------------- 目录 ---------------- */
async function toc(s) {
  ctx.pickLayout(s, ["list"]);
  const slide = add(s);
  const pk = P(1.2, 1.12, 4.7, 4.62, 43.5, true);
  await shadow(slide, pk.poly, { len: 3.2, a: 0.3, g: "shadow" });
  addPick(slide, pk, C.o, ctx.g("pick"));
  const t = String(s.title || "目录");
  const tt = [...t].length <= 2 ? [...t].join(" ") : t;
  T(slide, tt, { x: 1.47, y: 2.5, w: 3.84, h: 1.1, fontSize: one(tt, { w: 3.5, max: 48, min: 26, bold: true }), bold: true, color: C.white, align: "center", valign: "middle", noBalance: true, objectName: ctx.g("ttl") });
  T(slide, "CONTENTS", { x: 1.47, y: 3.62, w: 3.84, h: 0.75, fontSize: 34, color: C.white, fontFace: F.num, align: "center", valign: "middle", noBalance: true, objectName: ctx.g("en") });
  if (s.desc) {
    const dh = Hh(s.desc, { w: 4.4, fontSize: 11 });
    T(slide, s.desc, { x: 1.0, y: 6.25, w: 4.4, h: dh, fontSize: 11, color: C.body, objectName: ctx.g("en", "说明") });
  }
  const n = s.items.length, cols = n > 4 ? 2 : 1, rows = Math.ceil(n / cols);
  const x0 = cols === 1 ? 7.0 : 6.45, colW = cols === 1 ? R - 7.0 : (R - 6.45) / 2;
  const step = Math.min(1.16, (cols === 1 ? 4.9 : 5.2) / rows), top = 3.75 - (rows * step) / 2;
  const d = cols === 1 ? 0.64 : 0.56;
  const pos = s.items.map((_, i) => ({ x: x0 + Math.floor(i / rows) * colW, y: top + (i % rows) * step }));
  for (const p of pos) await shadow(slide, circlePoly(p.x + d / 2, p.y + d / 2, d / 2), { len: 0.75, a: 0.25, g: "numShadow" });
  pos.forEach((p, i) => {
    oval(slide, p.x, p.y, d, C.bg, { line: C.o, lw: 1.5, name: ctx.g("num") });
    T(slide, num2(i), { x: p.x, y: p.y, w: d, h: d, fontSize: cols === 1 ? 18 : 16, italic: true, color: C.o, fontFace: F.num, align: "center", valign: "middle", noBalance: true, objectName: ctx.g("num") });
  });
  s.items.forEach((it, i) => {
    const p = pos[i], g = ctx.g("item" + i), tx = p.x + d + 0.25, tw = colW - d - 0.4;
    const hs = one(it.head, { w: tw, max: cols === 1 ? 21 : 17, min: 13, bold: true });
    const hy = it.sub ? p.y - 0.04 : p.y + d / 2 - 0.22;
    T(slide, it.head, { x: tx, y: hy, w: tw, h: 0.44, fontSize: hs, bold: true, color: C.ink, valign: "middle", noBalance: true, objectName: g });
    if (it.sub) T(slide, it.sub, { x: tx, y: hy + 0.44, w: tw, h: 0.28, fontSize: 11, color: C.body, noBalance: true, objectName: g });
  });
}

/* ---------------- 章节页 ---------------- */
async function section(s) {
  ctx.pickLayout(s, ["pick"]);
  const slide = add(s);
  const pk = P(4.94, 1.2, 3.44, 3.39, 180, true);
  await shadow(slide, pk.poly, { len: 3.4, a: 0.3, g: "shadow" });
  addPick(slide, pk, C.o, ctx.g("pick"));
  const ph = P(6.03, 2.97, 1.28, 1.26, 180, true);
  const k = 1.14, bw = ph.w * k, bh = ph.h * k;
  addPick(slide, P(ph.x + ph.w / 2 - bw / 2, ph.y + ph.h / 2 - bh / 2, bw, bh, 180, true), C.white, ctx.g("pick", "相框"));
  await pickPhoto(slide, s, 0, ph.poly, { fallback: "photo_laptop.jpg", g: "pick" });
  T(slide, s._part || "PART 01", { x: 4.75, y: 1.42, w: 3.84, h: 0.75, fontSize: 30, color: C.white, fontFace: F.num, align: "center", valign: "middle", noBalance: true, objectName: ctx.g("part") });
  const tw = 10, tx = (W - tw) / 2;
  const tSize = one(s.title, { w: tw, max: 38, min: 24, bold: true });
  let y = 4.82;
  T(slide, s.title, { x: tx, y, w: tw, h: 0.8, fontSize: tSize, bold: true, color: C.ink, align: "center", valign: "middle", noBalance: true, objectName: ctx.g("title") });
  y += 0.85;
  const g = ctx.g("desc");
  if (s.en) { T(slide, s.en.toUpperCase(), { x: tx, y, w: tw, h: 0.28, fontSize: one(s.en.toUpperCase(), { w: tw, max: 12, min: 9, charSpacing: 2 }), color: C.light, fontFace: F.num, charSpacing: 2, align: "center", noBalance: true, objectName: g }); y += 0.34; }
  if (s.desc) { const dh = Hh(s.desc, { w: 7.2, fontSize: 12 }); T(slide, s.desc, { x: (W - 7.2) / 2, y, w: 7.2, h: dh, fontSize: 12, color: C.body, align: "center", objectName: g }); y += dh + 0.12; }
  if (s.keywords?.length) {
    const ws = s.keywords.map((kw) => wid(kw, { fontSize: 11 }) + 0.4);
    let xx = (W - (ws.reduce((a, b) => a + b, 0) + (ws.length - 1) * 0.15)) / 2;
    y = Math.min(y, 6.95);
    s.keywords.forEach((kw, i) => {
      box(slide, "ROUNDED_RECTANGLE", xx, y, ws[i], 0.34, null, { radius: 0.17, line: C.o, lw: 1, name: g });
      T(slide, kw, { x: xx, y, w: ws[i], h: 0.34, fontSize: 11, color: C.o, align: "center", valign: "middle", noBalance: true, objectName: g });
      xx += ws[i] + 0.15;
    });
  }
}

/* ---------------- 金句 ---------------- */
async function quote(s) {
  ctx.pickLayout(s, ["pick"]);
  const slide = add(s);
  const pk = P(5.42, 0.85, 2.5, 2.46, 180, true);
  await shadow(slide, pk.poly, { len: 2.8, a: 0.3, g: "shadow" });
  addPick(slide, pk, C.o, ctx.g("pick"));
  T(slide, "“", { x: 5.42, y: 1.05, w: 2.5, h: 1.4, fontSize: 110, color: C.white, fontFace: "Georgia", align: "center", valign: "middle", noBalance: true, objectName: ctx.g("mark", "装饰引号") });
  const tw = 9.6, size = ctx.fit(s.text, { w: tw, h: 2.0, max: 32, min: 20, bold: true, lineSpacingMultiple: 1.35 });
  const th = Hh(s.text, { w: tw, fontSize: size, bold: true, lineSpacingMultiple: 1.35 });
  const y = Math.max(3.75, 4.75 - th / 2);
  T(slide, s.text, { x: (W - tw) / 2, y, w: tw, h: th, fontSize: size, bold: true, color: C.ink, align: "center", lineSpacingMultiple: 1.35, objectName: ctx.g("text") });
  if (s.author) {
    const ay = y + th + 0.3;
    hline(slide, W / 2 - 0.3, ay, 0.6, C.o, 2, ctx.g("author"));
    T(slide, s.author, { x: (W - 8) / 2, y: ay + 0.15, w: 8, h: 0.36, fontSize: 14, color: C.light, align: "center", valign: "middle", noBalance: true, objectName: ctx.g("author") });
  }
}

/* ---------------- 3 / 4 要点 ---------------- */
/** 白卡片（原第 13 页）：图标 + 正文 + 底部色条标题 */
async function cards(slide, s, y, bottom) {
  const n = s.items.length, gap = 0.4;
  const cw = Math.min(n === 3 ? 3.3 : 2.6, (R - L - 0.5 - (n - 1) * gap) / n);
  const total = n * cw + (n - 1) * gap, x0 = (W - total) / 2 - 0.15;
  const ch = Math.min(3.7, bottom - y - 0.05), cy = y + (bottom - y - ch) / 2;
  for (let i = 0; i < n; i++) await shadow(slide, rectPoly(x0 + i * (cw + gap), cy, cw, ch), { len: 1.6, a: 0.26, g: "shadow" });
  for (let i = 0; i < n; i++) {
    const it = s.items[i], x = x0 + i * (cw + gap), g = ctx.g("card" + i), col = i % 2 ? C.g : C.o;
    rect(slide, x, cy, cw, ch, C.white, { name: g });
    const isz = Math.min(0.8, ch * 0.2);
    await icon(slide, it.icon || ICONS[i], col, x + cw / 2 - isz / 2, cy + 0.38, isz, ICONS[i], g);
    const barH = 0.54, by = cy + ch - barH;
    const bt = cy + 0.38 + isz + 0.3, bw = cw - 0.45;
    const bh = Math.min(by - bt - 0.15, Hh(it.body, { w: bw, fontSize: 12 }));
    T(slide, it.body, { x: x + 0.225, y: bt + Math.max(0, (by - bt - 0.15 - bh) / 2), w: bw, h: bh, fontSize: 12, color: C.body, align: "center", objectName: g });
    rect(slide, x, by, cw, barH, col, { name: g });
    T(slide, it.head, { x: x + 0.1, y: by, w: cw - 0.2, h: barH, fontSize: one(it.head, { w: cw - 0.3, max: 15, min: 11, bold: true }), bold: true, color: C.white, align: "center", valign: "middle", noBalance: true, objectName: g });
  }
}
/** 圆环（原第 21 页）：白圆 + 色弧 + 中心图标或数字，下方文字 */
const ARCS = [[200, 110], [270, 180], [120, 30], [300, 260]];
async function rings(slide, s, y, bottom, { val } = {}) {
  const n = s.items.length, colW = (R - L) / n;
  const textH = Math.max(...s.items.map((it) => (val ? 0.7 : 0.45 + (it.body ? Hh(it.body, { w: Math.min(colW - 0.4, 2.9), fontSize: 12 }) : 0))));
  const d = Math.max(1.3, Math.min(n <= 2 ? 2.3 : 1.95, colW - 0.7, bottom - y - textH - 0.35));
  const cyTop = y + Math.max(0, (bottom - y - d - 0.3 - textH) / 2);
  for (let i = 0; i < n; i++) {
    const it = s.items[i], cx = L + colW * (i + 0.5), g = ctx.g("ring" + i), col = i % 2 ? C.g : C.o;
    await shadow(slide, circlePoly(cx, cyTop + d / 2, d / 2), { len: 1.7, a: 0.28, g: "ring" + i });
    oval(slide, cx - d / 2, cyTop, d, C.white, { name: g });
    const inset = d * 0.12, ad = d - 2 * inset;
    box(slide, "BLOCK_ARC", cx - ad / 2, cyTop + inset, ad, ad, col, { angle: ARCS[i % 4], thick: 0.2, name: g });
    const hd = ad * 0.74;
    oval(slide, cx - hd / 2, cyTop + d / 2 - hd / 2, hd, C.white, { name: g });
    if (val) {
      const v = val(it), vs = one(v, { w: ad * 0.66, max: 30, min: 14, bold: true });
      T(slide, v, { x: cx - ad * 0.36, y: cyTop + d / 2 - 0.35, w: ad * 0.72, h: 0.7, fontSize: vs, bold: true, color: col, fontFace: F.num, align: "center", valign: "middle", noBalance: true, objectName: g });
    } else {
      const isz = ad * 0.34;
      await icon(slide, it.icon || ICONS[i], col, cx - isz / 2, cyTop + d / 2 - isz / 2, isz, ICONS[i], g);
    }
    const tg = ctx.g("txt" + i), tw = Math.min(colW - 0.4, 2.9), ty = cyTop + d + 0.3;
    const head = val ? it.label : it.head;
    if (val) {
      const ls = ctx.fit(head, { w: tw, h: 0.62, max: 15, min: 11, bold: true });
      T(slide, head, { x: cx - tw / 2, y: ty, w: tw, h: Hh(head, { w: tw, fontSize: ls, bold: true }), fontSize: ls, bold: true, color: C.ink, align: "center", objectName: tg });
    } else T(slide, head, { x: cx - tw / 2, y: ty, w: tw, h: 0.4, fontSize: one(head, { w: tw, max: 17, min: 11, bold: true }), bold: true, color: C.ink, align: "center", valign: "middle", noBalance: true, objectName: tg });
    if (it.body && !val) T(slide, it.body, { x: cx - tw / 2, y: ty + 0.45, w: tw, h: Hh(it.body, { w: tw, fontSize: 12 }), fontSize: 12, color: C.body, align: "center", objectName: tg });
  }
}
async function points3(s) {
  const layout = ctx.pickLayout(s, ["picks", "cards"]);
  const slide = add(s);
  await header(slide, s);
  let y = lead(slide, s, TOP);
  const bottom = bottomOf(s);
  if (layout === "picks") {
    const colW = (R - L) / 3, tw = Math.min(3.3, colW - 0.4);
    const bodyH = Math.max(...s.items.map((it) => Hh(it.body, { w: tw, fontSize: 12 })));
    const textH = 0.45 + bodyH;
    const ph = Math.min(3.0, bottom - y - textH - 0.25);
    for (let i = 0; i < 3; i++) {
      const it = s.items[i], cx = L + colW * (i + 0.5);
      const pk = fitPick(cx - colW / 2 + 0.2, y, colW - 0.4, ph, 43.5, true);
      await shadow(slide, pk.poly, { len: 1.8, a: 0.28, g: "pic" + i });
      await pickPhoto(slide, s, i, pk.poly, { fallback: PHOTOS[i], g: "pic" + i });
      const g = ctx.g("txt" + i), ty = y + ph + 0.2;
      T(slide, it.head, { x: cx - tw / 2, y: ty, w: tw, h: 0.4, fontSize: one(it.head, { w: tw, max: 17, min: 12, bold: true }), bold: true, color: C.ink, align: "center", valign: "middle", noBalance: true, objectName: g });
      T(slide, it.body, { x: cx - tw / 2, y: ty + 0.45, w: tw, h: bodyH, fontSize: 12, color: C.body, align: "center", objectName: g });
    }
  } else {
    await cards(slide, s, y, bottom);
  }
  if (s.conclusion) conclusion(slide, s, bottom + 0.2);
}
async function points4(s) {
  const layout = ctx.pickLayout(s, ["cards", "rings", "hub"]);
  const slide = add(s);
  await header(slide, s);
  let y = lead(slide, s, TOP);
  const bottom = bottomOf(s);
  if (layout === "cards") await cards(slide, s, y, bottom);
  else if (layout === "rings") await rings(slide, s, y, bottom);
  else {
    // 中心圆照片 + 四周图标（原第 17 页）：左边两条、右边两条
    const cx = W / 2, cy = (y + bottom) / 2, r = Math.min(1.0, (bottom - y) / 2 - 0.55), dx = 1.95, dy = Math.min(1.15, (bottom - y) / 2 - 0.4), id = 0.78;
    const spots = [[cx - dx, cy - dy], [cx - dx, cy + dy], [cx + dx, cy - dy], [cx + dx, cy + dy]];
    const G = ctx.g("hub");
    for (const [x, yy] of spots) seg(slide, cx, cy, x, yy, "BFBFBF", 1, G, "dash");
    for (const [x, yy] of spots) await shadow(slide, circlePoly(x, yy, id / 2), { len: 0.9, a: 0.26, g: "hub" });
    await shadow(slide, circlePoly(cx, cy, r + 0.08), { len: 1.6, a: 0.28, g: "hub" });
    oval(slide, cx - r - 0.08, cy - r - 0.08, 2 * r + 0.16, C.white, { name: G });
    await ctx.pic(slide, s, 0, cx - r, cy - r, 2 * r, 2 * r, { circle: true, fallback: "photo_laptop.jpg", name: ctx.g("hub", "照片") });
    for (let i = 0; i < 4; i++) {
      const [x, yy] = spots[i], solid = i === 0 || i === 3, col = solid ? C.white : C.o;
      oval(slide, x - id / 2, yy - id / 2, id, solid ? C.o : C.white, { name: G });
      await icon(slide, s.items[i].icon || ICONS[i], col, x - 0.19, yy - 0.19, 0.38, ICONS[i], G);
    }
    const tw = cx - dx - id / 2 - 0.35 - L;
    s.items.forEach((it, i) => {
      const [sx, sy] = spots[i], left = i < 2, g = ctx.g("item" + i);
      const bh = Hh(it.body, { w: tw, fontSize: 12 }), x = left ? L : sx + id / 2 + 0.35;
      const ty = sy - (0.45 + bh) / 2;
      T(slide, it.head, { x, y: ty, w: tw, h: 0.4, fontSize: one(it.head, { w: tw, max: 17, min: 12, bold: true }), bold: true, color: C.ink, align: left ? "right" : "left", valign: "middle", noBalance: true, objectName: g });
      T(slide, it.body, { x, y: ty + 0.45, w: tw, h: bh, fontSize: 12, color: C.body, align: left ? "right" : "left", objectName: g });
    });
  }
  if (s.conclusion) conclusion(slide, s, bottom + 0.2);
}

/* ---------------- 对比 ---------------- */
function sideText(slide, side, x, y, w, color, g, o = {}) {
  const hw = o.headW || w, hs = one(side.head, { w: hw, max: 18, min: 13, bold: true });
  T(slide, side.head, { x, y, w: hw, h: 0.42, fontSize: hs, bold: true, color, valign: "middle", noBalance: true, objectName: g });
  let yy = y + 0.5;
  for (const item of side.items) {
    const ih = Hh(item, { w: w - 0.22, fontSize: 12, lineSpacingMultiple: 1.1 });
    T(slide, "·", { x, y: yy, w: 0.2, h: 0.3, fontSize: 14, bold: true, color, noBalance: true, objectName: g });
    T(slide, item, { x: x + 0.22, y: yy, w: w - 0.22, h: ih, fontSize: 12, color: o.itemColor || color, lineSpacingMultiple: 1.1, objectName: g });
    yy += ih + 0.05;
  }
  return yy - y;
}
const sideH = (side, w) => 0.5 + side.items.reduce((a, it) => a + Hh(it, { w: w - 0.22, fontSize: 12, lineSpacingMultiple: 1.1 }) + 0.05, 0);
async function compare(s) {
  const layout = ctx.pickLayout(s, ["blocks", "frames"]);
  const slide = add(s);
  await header(slide, s);
  let y = lead(slide, s, TOP);
  const bottom = bottomOf(s);
  if (layout === "blocks") {
    const bw = 4.2, tw = bw - 0.7;
    const need = Math.max(sideH(s.left, tw), sideH(s.right, tw)) + 0.5;
    const bh = Math.max(need, Math.min(2.15, (bottom - y) / 2)), total = 2 * bh, top = y + Math.max(0, (bottom - y - total) / 2);
    await shadow(slide, rectPoly(L, top, R - L, total), { len: 2.2, a: 0.26, g: "shadow" });
    await ctx.pic(slide, s, 0, L + bw, top, R - L - bw, total, { fallback: "photo_city.jpg", name: ctx.g("photo", "照片") });
    for (const [k, side, col] of [[0, s.left, C.o], [1, s.right, C.g]]) {
      const g = ctx.g(k ? "right" : "left"), by = top + k * bh;
      rect(slide, L, by, bw, bh, col, { name: g });
      if (side.icon !== undefined || true) await icon(slide, side.icon || (k ? "x-circle" : "check-circle"), C.white, L + bw - 0.75, by + 0.3, 0.42, k ? "x-circle" : "check-circle", g);
      const th = sideH(side, tw);
      sideText(slide, side, L + 0.35, by + Math.max(0.22, (bh - th) / 2 + 0.05), tw, C.white, g, { headW: tw - 0.6 });
    }
  } else {
    const fw = Math.min(5.1, (R - L - 0.9) / 2), gap = R - L - 2 * fw - 0.5, tw = fw - 0.6;
    const th = Math.max(sideH(s.left, tw), sideH(s.right, tw));
    const fh = Math.min(bottom - y, 4.6), ph = Math.max(1.3, fh - th - 0.75);
    const top = y + Math.max(0, (bottom - y - fh) / 2);
    const xs = [L, L + fw + gap];
    for (const x of xs) await shadow(slide, rectPoly(x, top, fw, fh), { len: 2.0, a: 0.28, g: "shadow" });
    for (let k = 0; k < 2; k++) {
      const x = xs[k], g = ctx.g("frame" + k);
      rect(slide, x, top, fw, fh, C.o, { name: g });
      rect(slide, x + 0.2, top + 0.2, fw - 0.4, ph, C.white, { name: g });
      await ctx.pic(slide, s, k, x + 0.25, top + 0.25, fw - 0.5, ph - 0.1, { fallback: PHOTOS[k], name: ctx.g("frame" + k, "照片") });
      sideText(slide, k ? s.right : s.left, x + 0.3, top + ph + 0.35, tw, C.white, ctx.g("txt" + k));
    }
  }
  if (s.conclusion) conclusion(slide, s, bottom + 0.2);
}

/* ---------------- 数据 ---------------- */
const parseNum = (v) => { const m = String(v).replace(/,/g, "").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
const unitOf = (v) => String(v).replace(/[-\d.,\s+]/g, "");
async function stats(s) {
  const vals = s.items.map((it) => parseNum(it.value)), units = s.items.map((it) => unitOf(it.value));
  const allPct = units.every((u) => u === "%") && vals.every((v) => v !== null && v >= 0 && v <= 100);
  const sameUnit = vals.every((v) => v !== null && v > 0) && units.every((u) => u === units[0]);
  const layout = ctx.pickLayout(s, [allPct ? "bars" : null, sameUnit ? "peaks" : null, "numbers"]);
  const slide = add(s);
  await header(slide, s);
  const srcH = s.source ? Hh(`来源：${s.source}`, { w: R - L, fontSize: 9, lineSpacingMultiple: 1.2 }) : 0;
  const srcY = BOTTOM - srcH + 0.05;
  const source = (g) => { if (s.source) T(slide, `来源：${s.source}`, { x: L, y: srcY, w: R - L, h: srcH, fontSize: 9, color: C.light, lineSpacingMultiple: 1.2, objectName: ctx.g(g, "来源") }); };
  const bottom = srcY - 0.2;
  if (layout === "bars") {
    const pk = fitPick(L - 0.15, TOP + 0.05, 4.8, bottom - TOP - 0.1, 43.5, true);
    await shadow(slide, pk.poly, { len: 2.6, a: 0.28, g: "picShadow" });
    await pickPhoto(slide, s, 0, pk.poly, { fallback: "photo_write.jpg", g: "pic" });
    const x = 6.2, w = R - x;
    let y = lead(slide, s, TOP + 0.1, { x, w, g: "note" });
    const n = s.items.length, rh = Math.min(1.1, (bottom - y) / n), top = y + Math.max(0, (bottom - y - n * rh) / 2);
    const bw = w - 1.2;
    for (let i = 0; i < n; i++) await shadow(slide, rectPoly(x, top + i * rh + 0.45, Math.max(0.1, bw * vals[i] / 100), 0.32), { len: 0.8, a: 0.24, g: "barShadow" });
    s.items.forEach((it, i) => {
      const yy = top + i * rh;
      T(slide, it.label, { x, y: yy, w, h: 0.38, fontSize: one(it.label, { w, max: 14, min: 11, bold: true }), bold: true, color: C.ink, valign: "middle", noBalance: true, objectName: ctx.g("label" + i) });
      const bl = Math.max(0.1, bw * vals[i] / 100);
      rect(slide, x, yy + 0.45, bl, 0.32, C.o, { name: ctx.g("bar" + i) });
      T(slide, it.value, { x: x + bl + 0.12, y: yy + 0.38, w: 1.1, h: 0.46, fontSize: 16, bold: true, color: C.o, fontFace: F.num, valign: "middle", noBalance: true, objectName: ctx.g("bar" + i) });
    });
    source("note");
  } else if (layout === "peaks") {
    // 山峰图（原第 8 页）：高度按数值，数字在峰顶，标签在底线下
    const n = s.items.length, max = Math.max(...vals);
    const leadH = s.lead ? Hh(s.lead, { w: R - L, fontSize: 14, bold: true }) : 0;
    const labH = Math.max(...s.items.map((it) => Hh(it.label, { w: 2.4, fontSize: 12 })));
    const baseY = bottom - (leadH ? leadH + 0.25 : 0) - labH - 0.2;
    const maxH = Math.min(3.0, baseY - TOP - 0.5);
    const pw = Math.min(3.8, (R - L) / (n * 0.72 + 0.28)), step = pw * 0.72;
    const x0 = L + ((R - L) - (step * (n - 1) + pw)) / 2;
    const geo = s.items.map((_, i) => { const h = Math.max(0.7, maxH * vals[i] / max); return { x: x0 + i * step, y: baseY - h, w: pw, h }; });
    const peakPts = (gx, gy, gw, gh) => [[gx, gy + gh], [gx + gw * 0.4, gy + gh * 0.1], [gx + gw * 0.5, gy], [gx + gw * 0.6, gy + gh * 0.1], [gx + gw, gy + gh]];
    for (const p of geo) await shadow(slide, peakPts(p.x, p.y, p.w, p.h), { len: 1.6, a: 0.26, g: "shadow" });
    const G = ctx.g("peaks");
    geo.forEach((p, i) => {
      slide.addShape(ctx.shapes.CUSTOM_GEOMETRY, {
        x: p.x, y: p.y, w: p.w, h: p.h, fill: { color: i % 2 ? C.o : C.g }, line: { type: "none" }, objectName: G,
        points: [{ x: 0, y: p.h, moveTo: true }, { x: p.w * 0.4, y: p.h * 0.12 },
          { x: p.w * 0.6, y: p.h * 0.12, curve: { type: "cubic", x1: p.w * 0.47, y1: -p.h * 0.02, x2: p.w * 0.53, y2: -p.h * 0.02 } },
          { x: p.w, y: p.h }, { close: true }],
      });
    });
    hline(slide, L, baseY, R - L, "BFBFBF", 0.75, G);
    oval(slide, L - 0.04, baseY - 0.04, 0.08, "BFBFBF", { name: G });
    oval(slide, R - 0.04, baseY - 0.04, 0.08, "BFBFBF", { name: G });
    geo.forEach((p, i) => {
      const it = s.items[i], cx = p.x + p.w / 2;
      T(slide, it.value, { x: cx - 1.0, y: p.y - 0.5, w: 2.0, h: 0.44, fontSize: one(it.value, { w: 1.9, max: 20, min: 13 }), color: C.ink, fontFace: F.num, align: "center", valign: "middle", noBalance: true, objectName: G });
      const lw = Math.min(2.4, step + 0.1);
      T(slide, it.label, { x: cx - lw / 2, y: baseY + 0.12, w: lw, h: labH, fontSize: 12, color: C.body, align: "center", objectName: G });
    });
    lead(slide, s, bottom - leadH, { g: "txt", gap: 0 });
    source("txt");
  } else {
    let y = lead(slide, s, TOP);
    await rings(slide, s, y, bottom, { val: (it) => it.value });
    source("note");
  }
}

/* ---------------- 时间线（原第 23 页） ---------------- */
async function timeline(s) {
  ctx.pickLayout(s, ["line"]);
  const slide = add(s);
  await header(slide, s);
  let y = lead(slide, s, TOP);
  const bottom = bottomOf(s);
  const n = s.items.length, x0 = L + 0.55, x1 = R - 0.55, sp = (x1 - x0) / (n - 1);
  const tw = Math.min(3.0, 2 * sp - 0.35);
  const bodyH = Math.max(0, ...s.items.map((it) => (it.body ? Hh(it.body, { w: tw, fontSize: 12 }) : 0)));
  const textH = 0.42 + (bodyH ? bodyH + 0.05 : 0), bx = 0.62;
  const lineY = Math.max(y + textH + bx + 0.55, (y + bottom) / 2);
  const G = ctx.g("line");
  for (let i = 0; i < n; i++) { const cx = x0 + i * sp, up = i % 2 === 0; await shadow(slide, rectPoly(cx - bx / 2, up ? lineY - 0.32 - bx : lineY + 0.32, bx, bx), { len: 0.8, a: 0.24, g: "line" }); }
  hline(slide, x0, lineY, x1 - x0, C.o, 3, G);
  for (let i = 0; i < n; i++) {
    const cx = x0 + i * sp, up = i % 2 === 0;
    rect(slide, cx - 0.09, lineY - 0.09, 0.18, 0.18, C.o, { name: G });
    const by = up ? lineY - 0.32 - bx : lineY + 0.32;
    rect(slide, cx - bx / 2, by, bx, bx, C.white, { name: G });
    await icon(slide, ICONS[i % ICONS.length], C.o, cx - 0.17, by + bx / 2 - 0.17, 0.34, "flag", G);
  }
  s.items.forEach((it, i) => {
    const cx = x0 + i * sp, up = i % 2 === 0, g = ctx.g("item" + i);
    const tx = Math.max(L - 0.1, Math.min(R + 0.1 - tw, cx - tw / 2));
    const ty = up ? lineY - 0.32 - bx - 0.15 - textH : lineY + 0.32 + bx + 0.15;
    T(slide, it.head, { x: tx, y: ty, w: tw, h: 0.4, fontSize: one(it.head, { w: tw, max: 17, min: 12, bold: true }), bold: true, color: C.ink, align: "center", valign: "middle", noBalance: true, objectName: g });
    if (it.body) T(slide, it.body, { x: tx, y: ty + 0.45, w: tw, h: bodyH, fontSize: 12, color: C.body, align: "center", objectName: g });
    const tY = up ? lineY + 0.16 : lineY - 0.5;
    const tmW = Math.min(2.2, sp), tmX = Math.max(0.35, Math.min(W - 0.35 - tmW, cx - tmW / 2));
    T(slide, it.time, { x: tmX, y: tY, w: tmW, h: 0.34, fontSize: one(it.time, { w: Math.min(2.1, sp - 0.1), max: 15, min: 11, bold: true }), bold: true, color: C.o, fontFace: F.num, align: "center", valign: "middle", noBalance: true, objectName: g });
  });
  if (s.conclusion) conclusion(slide, s, bottom + 0.2);
}

/* ---------------- 大图配文 ---------------- */
async function imageText(s) {
  const layout = ctx.pickLayout(s, ["pick", "panel"]);
  const slide = add(s);
  await header(slide, s);
  if (layout === "pick") {
    const bottom = BOTTOM;
    const pk = fitPick(L - 0.15, TOP + 0.05, 5.0, bottom - TOP - 0.1, 43.5, true);
    await shadow(slide, pk.poly, { len: 2.6, a: 0.28, g: "picShadow" });
    await pickPhoto(slide, s, 0, pk.poly, { fallback: "photo_write.jpg", g: "pic" });
    const x = 6.45, w = R - x;
    const bh = Hh(s.body, { w, fontSize: 15, lineSpacingMultiple: 1.45 });
    const pts = s.points || [];
    const ptH = pts.map((p) => Hh(p, { w: w - 0.4, fontSize: 13 }));
    const cH = concH(s, w);
    const total = bh + (pts.length ? 0.35 + ptH.reduce((a, b) => a + b + 0.18, 0) : 0) + (cH ? 0.35 + cH : 0);
    let y = TOP + Math.max(0.1, (bottom - TOP - total) / 2);
    T(slide, s.body, { x, y, w, h: bh, fontSize: 15, color: C.ink, lineSpacingMultiple: 1.45, objectName: ctx.g("body") });
    y += bh + (pts.length ? 0.35 : 0);
    pts.forEach((p, i) => {
      const g = ctx.g("pt" + i);
      addPick(slide, P(x, y + 0.06, 0.2, 0.2, 323.7, true), C.o, g);
      T(slide, p, { x: x + 0.4, y, w: w - 0.4, h: ptH[i], fontSize: 13, color: C.body, objectName: g });
      y += ptH[i] + 0.18;
    });
    if (cH) conclusion(slide, s, y + 0.17, { x, w });
  } else {
    const bottom = bottomOf(s);
    const pts = s.points || [];
    const bw = 4.1, tw = bw - 0.7;
    const bodyH = Hh(s.body, { w: tw, fontSize: 13, lineSpacingMultiple: 1.35 });
    const ptH = pts.map((p) => Hh(p, { w: tw - 0.22, fontSize: 12 }));
    const ptsH = ptH.reduce((a, b) => a + b + 0.08, 0);
    const total = Math.min(bottom - TOP, Math.max(4.2, bodyH + 0.8 + (pts.length ? ptsH + 0.8 : 0)));
    const top = TOP + Math.max(0, (bottom - TOP - total) / 2);
    const h1 = pts.length ? Math.max(bodyH + 0.8, total - ptsH - 0.8) : total;
    await shadow(slide, rectPoly(L, top, R - L, total), { len: 2.2, a: 0.26, g: "shadow" });
    await ctx.pic(slide, s, 0, L + bw, top, R - L - bw, total, { fallback: "photo_city.jpg", name: ctx.g("photo", "照片") });
    const gl = ctx.g("left");
    rect(slide, L, top, bw, h1, C.o, { name: gl });
    T(slide, s.body, { x: L + 0.35, y: top + (h1 - bodyH) / 2, w: tw, h: bodyH, fontSize: 13, color: C.white, lineSpacingMultiple: 1.35, objectName: gl });
    if (pts.length) {
      const gr = ctx.g("right"), y0 = top + h1, h2 = total - h1;
      rect(slide, L, y0, bw, h2, C.g, { name: gr });
      let yy = y0 + (h2 - ptsH) / 2;
      pts.forEach((p, i) => {
        T(slide, "·", { x: L + 0.35, y: yy, w: 0.2, h: 0.3, fontSize: 14, bold: true, color: C.white, noBalance: true, objectName: gr });
        T(slide, p, { x: L + 0.57, y: yy, w: tw - 0.22, h: ptH[i], fontSize: 12, color: C.white, objectName: gr });
        yy += ptH[i] + 0.08;
      });
    }
    if (s.conclusion) conclusion(slide, s, bottom + 0.2);
  }
}

/* ---------------- 表格（新设计） ---------------- */
async function table(s) {
  ctx.pickLayout(s, ["grid"]);
  const slide = add(s);
  await header(slide, s);
  let y = lead(slide, s, TOP);
  const bottom = bottomOf(s);
  const rows = s.rows || [], tw = R - L;
  const widths = s.columns.map((c, j) => Math.max(wid(c, { fontSize: 14, bold: true }), ...rows.map((r) => Math.min(4.2, wid(r[j] || "", { fontSize: 12 }))), 1.0) + 0.4);
  const sum = widths.reduce((a, b) => a + b, 0), cw = widths.map((v) => (v / sum) * tw);
  const rh = Math.min(0.72, (bottom - y) / (rows.length + 1));
  y += Math.max(0, (bottom - y - rh * (rows.length + 1)) / 2 - 0.1);
  await shadow(slide, rectPoly(L, y, tw, rh * (rows.length + 1)), { len: 1.6, a: 0.24, g: "shadow" });
  const data = [s.columns.map((c) => ({ text: c, options: { bold: true, color: C.white, fill: { color: C.o }, fontSize: 14 } }))];
  rows.forEach((r, i) => data.push(s.columns.map((_, j) => ({ text: r[j] || "", options: { color: C.ink, fill: { color: i % 2 ? C.rowAlt : C.white }, fontSize: 12 } }))));
  slide.addTable(data, { x: L, y, w: tw, colW: cw, rowH: rh, fontFace: F.body, valign: "middle", margin: [0, 0.14, 0, 0.14], border: { type: "solid", color: "E6E6E6", pt: 0.75 }, objectName: ctx.g("table", "表格") });
  if (s.conclusion) conclusion(slide, s, bottom + 0.2);
}

/* ---------------- 步骤（原第 19 页） ---------------- */
const ARROW_LEN = [0.72, 0.9, 0.8, 1.0];
async function steps(s) {
  ctx.pickLayout(s, ["arrows"]);
  const slide = add(s);
  await header(slide, s);
  let y = lead(slide, s, TOP);
  const bottom = BOTTOM, n = s.items.length;
  const tx = L, tw = 5.6, ax = tx + tw + 0.45, aMax = R - ax;
  const bodyH = s.items.map((it) => Hh(it.body, { w: tw, fontSize: 12 }));
  const rh = Math.min(1.25, (bottom - y) / n), top = y + Math.max(0, (bottom - y - n * rh) / 2), ah = 0.78;
  const arrow = (x, yy, len) => {
    const pts = [[0, 0.17], [len - 0.55, 0.17], [len - 0.55, 0], [len, ah / 2], [len - 0.55, ah], [len - 0.55, 0.61], [0, 0.61]];
    return { pts, poly: pts.map(([px, py]) => [x + px, yy + py]) };
  };
  const geo = s.items.map((_, i) => { const yy = top + i * rh + (rh - ah) / 2; return { y: yy, len: aMax * ARROW_LEN[i % 4], ...arrow(ax, yy, aMax * ARROW_LEN[i % 4]) }; });
  for (const a of geo) await shadow(slide, a.poly, { len: 1.3, a: 0.24, g: "shadow" });
  const G = ctx.g("arrows");
  geo.forEach((a, i) => {
    slide.addShape(ctx.shapes.CUSTOM_GEOMETRY, { x: ax, y: a.y, w: a.len, h: ah, fill: { color: i % 2 ? C.white : C.o }, line: { type: "none" }, objectName: G,
      points: [...a.pts.map(([px, py], k) => (k === 0 ? { x: px, y: py, moveTo: true } : { x: px, y: py })), { close: true }] });
    T(slide, num2(i), { x: ax + 0.2, y: a.y + 0.17, w: 0.9, h: 0.44, fontSize: 15, color: i % 2 ? C.o : C.white, fontFace: F.num, valign: "middle", noBalance: true, objectName: G });
  });
  s.items.forEach((it, i) => {
    const g = ctx.g("item" + i), yy = top + i * rh + (rh - 0.45 - bodyH[i]) / 2;
    T(slide, it.head, { x: tx, y: yy, w: tw, h: 0.4, fontSize: one(it.head, { w: tw, max: 16, min: 12, bold: true }), bold: true, color: C.ink, valign: "middle", noBalance: true, objectName: g });
    T(slide, it.body, { x: tx, y: yy + 0.45, w: tw, h: bodyH[i], fontSize: 12, color: C.body, objectName: g });
  });
}

async function render(deck, c) {
  ctx = c;
  ctx.pres.defineSlideMaster({ title: "OF_BG", background: { color: C.bg } });
  await ctx.renderAll({ cover, toc, section, points3, points4, compare, stats, timeline, imageText, quote, closing, table, steps });
}
module.exports = { render };
