/**
 * 模板：深蓝新程（navy-journey）
 * ------------------------------------------------------------------
 * 来源：网络模板「新岁启封 共赴未来 · 2027 年终总结报告」（1ppt.com）。
 * 深蓝（#132955）+ 浅驼（#D9C3B4），封面 / 章节页是夜色城市 + 发光「2027」大字，
 * 内容页是白底 + 左深右透明的渐变页眉条（双方框图标 + 白字标题 + 细线）。
 *
 * 动效：完全照原模板（motion.json，由 tools/motion_extract.py 从原 .pptx 抽出）：
 *   翻页全部「飞过」0.8 秒；封面四角小字出现 → 标题随机线条 → 副标题劈裂；目录侧栏从底擦除 → 卡片上下交替同时擦除；
 *   章节页四角出现 → 文字随机线条；内容页页眉从左擦除 → 正文从底擦除（环形 / 四瓣 / 双圆页是 2 秒圆形缩小）。
 *   这里只负责给元素分组：ctx.g("组名")。组名和 motion.json 的 pages 一一对应。
 *
 * 字体：微软雅黑（原模板是阿里巴巴普惠体，多数电脑没装）；封面大标题用楷体，代替原模板的书法字图片。
 *
 * 版式（和 meta.json → layouts 一致）：
 *   cover     hero                         夜色「2027」背景，左侧楷体大标题 + 副标题（原第 1 页）
 *   toc       cards | list                 深蓝侧栏「目录 / CONTENTS」+ 竖条卡片（≤5 条，原第 2 页）/ 两列编号列表（新设计）
 *   section   photo                        左夜色城市 + 右深蓝渐变，PART 编号 + 大标题（原第 3 页）
 *   points3   pyramid | photos | banner    金字塔 + 文字框（原第 20 页）/ 三张斜切照片 + 胶囊标签（原第 7 页）/ 三栏文字 + 横幅照片（原第 12 页）
 *   points4   ring | quad                  双环无限形（原第 5 页）/ 四瓣圆 + 四张卡片（原第 21 页）
 *   compare   vs | cards                   双大圆对比（原第 23 页）/ 双卡片（新设计，沿用第 21 页卡片样式）
 *   stats     bars | chart | numbers       照片 + 进度条（原第 16 页，全是百分比时）/ 数字 + 柱状图（原第 9 页）/ 数字卡片（新设计）
 *   timeline  stairs | gantt | arrows      阶梯色带（原第 6 页）/ 箭头甘特（原第 4 页）/ 弯箭头时间带（原第 22 页）
 *   imageText side | panel                 左照片右文字（原第 11 页）/ 深蓝面板压照片（原第 14 页）
 *   quote     night                        夜色背景 + 右侧金句（新设计，沿用章节页）
 *   closing   thanks                       同封面（原第 24 页）
 *   table     grid          （可选）       深蓝表头 + 浅驼隔行（新设计）
 *   steps     wave          （可选）       波浪线 + 编号圆（原第 17 页）
 */
const C = {
  navy: "132955", navy2: "1E3A6E", beige: "D9C3B4", beigeD: "A88568", beigeL: "F4EEE9", cream: "F2E6D8",
  ink: "262626", body: "595959", gray: "8C8C8C", line: "E3E3E3", track: "EEEFF2", white: "FFFFFF",
};
const F = { head: "微软雅黑", body: "微软雅黑", num: "Arial", title: "楷体" };
const W = 13.333, L = 0.75, R = W - 0.75;
const PHOTOS = ["photo_desk.jpg", "photo_calc.jpg", "photo_write.jpg", "photo_report.jpg", "photo_keyboard.jpg", "photo_calc2.jpg", "photo_portrait.jpg", "photo_handshake.jpg"];

let ctx;
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
function hline(sl, x, y, w, color = C.line, width = 0.75, name = "") { sl.addShape(ctx.shapes.LINE, { x, y, w, h: 0, line: { color, width }, objectName: name }); }
function vline(sl, x, y, h, color = C.line, width = 0.75, name = "") { sl.addShape(ctx.shapes.LINE, { x, y, w: 0, h, line: { color, width }, objectName: name }); }
function pill(sl, str, x, y, w, h, fill, o = {}) {
  box(sl, "ROUNDED_RECTANGLE", x, y, w, h, fill, { radius: h / 2, name: o.name, line: o.line });
  T(sl, str, { x, y, w, h, fontSize: o.size || one(str, { w: w - 0.3, max: 15, min: 10, bold: true }), bold: true, color: o.color || C.white, align: "center", valign: "middle", noBalance: true, objectName: o.name });
}
async function icon(sl, name, color, x, y, s, def, g) {
  sl.addImage({ data: await ctx.icon(name, color, def), x, y, w: s, h: s, objectName: g });
}

/* ---------------- 页面 / 页眉 ---------------- */
function add(s, bg = C.white) { return ctx.addSlide(s, { master: bg === C.white ? "NJ_WHITE" : "NJ_NAVY", bg: bg === "image" ? "image" : bg }); }
const eyebrowOf = (s) => (s.eyebrow !== undefined ? s.eyebrow : s._sectionNo ? `${s._num} · ${s._sectionTitle}` : "");
/** 内容页页眉（组 header：从左擦除） */
function header(slide, s) {
  const g = ctx.g("header");
  slide.addImage({ path: ctx.asset("header_bar.png"), x: 0, y: 0.18, w: W, h: 0.81, objectName: ctx.g("header", "渐变条") });
  box(slide, "FRAME", 0.4, 0.37, 0.3, 0.3, C.beige, { name: g });
  box(slide, "FRAME", 0.55, 0.52, 0.3, 0.3, C.beige, { name: g });
  const size = one(s.title, { w: 8.6, max: 28, min: 18 });
  const tw = Math.min(8.6, wid(s.title, { fontSize: size }) + 0.1);
  T(slide, s.title, { x: 1.05, y: 0.26, w: 8.7, h: 0.66, fontSize: size, color: C.white, valign: "middle", noBalance: true, objectName: g });
  const lx = 1.05 + tw + 0.3;
  if (lx < 11.5) {
    oval(slide, lx, 0.545, 0.08, C.white, { name: g });
    hline(slide, lx + 0.04, 0.585, 12.9 - lx, C.white, 1.25, g);
  }
  const eb = eyebrowOf(s);
  if (eb) T(slide, eb, { x: 8.3, y: 1.07, w: 4.6, h: 0.26, fontSize: 10, color: C.gray, align: "right", noBalance: true, objectName: g });
}
/** 引导语（正文组里） */
function lead(slide, s, y, o = {}) {
  if (!s.lead) return y;
  const x = o.x ?? L, w = o.w ?? R - L, size = o.size || 13;
  const h = Hh(s.lead, { w, fontSize: size, bold: true });
  T(slide, s.lead, { x, y, w, h, fontSize: size, bold: true, color: C.navy, align: o.align, objectName: ctx.g(o.g || "body", "引导语") });
  return y + h + (o.gap ?? 0.25);
}
/** 结论条：浅驼底 + 深蓝竖条 */
function conclusion(slide, s, y, o = {}) {
  if (!s.conclusion) return y;
  const x = o.x ?? L, w = o.w ?? R - L, g = ctx.g(o.g || "body", "结论");
  const h = Math.max(0.5, Hh(s.conclusion, { w: w - 0.5, fontSize: 13, bold: true }) + 0.2);
  rect(slide, x, y, w, h, C.beigeL, { name: g });
  rect(slide, x, y, 0.08, h, C.navy, { name: g });
  T(slide, s.conclusion, { x: x + 0.3, y, w: w - 0.5, h, fontSize: 13, bold: true, color: C.navy, valign: "middle", objectName: g });
  return y + h;
}
const concH = (s, w = R - L) => (s.conclusion ? Math.max(0.5, Hh(s.conclusion, { w: w - 0.5, fontSize: 13, bold: true }) + 0.2) : 0);

/* ---------------- 封面 / 结尾 ---------------- */
function corners(slide, s, tag) {
  const g = ctx.g("corner");
  T(slide, tag || "ANNUAL REPORT", { x: 0.45, y: 0.33, w: 4.2, h: 0.3, fontSize: 14, bold: true, color: C.cream, fontFace: F.num, noBalance: true, objectName: g });
  T(slide, "BETTER FUTURE TOGETHER", { x: 0.45, y: 0.64, w: 3, h: 0.2, fontSize: 9, color: C.cream, fontFace: F.num, noBalance: true, objectName: ctx.g("corner", "装饰") });
  T(slide, ctx.deck.meta?.cornerRight || "HAPPY\nNEW YEAR", { x: 10.9, y: 0.33, w: 2.0, h: 0.5, fontSize: 11, color: C.cream, fontFace: F.num, align: "right", lineSpacingMultiple: 1.0, noBalance: true, objectName: ctx.g("corner", "装饰") });
  T(slide, "NEW JOURNEY\nA BRIGHTER TOMORROW", { x: 0.45, y: 6.5, w: 3, h: 0.45, fontSize: 10, color: C.cream, fontFace: F.num, lineSpacingMultiple: 1.0, noBalance: true, objectName: ctx.g("corner", "装饰") });
  hline(slide, 0.47, 7.06, 0.27, C.cream, 1, g);
  if (ctx.deck.meta?.author) T(slide, ctx.deck.meta.author, { x: 8.4, y: 6.72, w: 4.5, h: 0.3, fontSize: 11, color: C.cream, align: "right", noBalance: true, objectName: g });
}
async function hero(s, closing) {
  ctx.pickLayout(s, [closing ? "thanks" : "hero"]);
  const slide = add(s, "image");
  slide.addImage({ path: ctx.asset("bg_cover.jpg"), x: 0, y: 0, w: W, h: 7.5 });
  corners(slide, s, s.tag);
  // 标题：楷体大字，一行放不下就两行（优先在标点处断）
  const tw = 6.3;
  let title = String(s.title);
  let size = one(title, { w: tw, max: 66, min: 40, bold: true });
  if (size <= 40 && !title.includes("\n")) {
    const p = title.search(/[，,：:；;！!？?\s]/);
    const cut = p > 1 && p < title.length - 1 ? p + 1 : Math.ceil(title.length / 2);
    title = title.slice(0, cut).trim() + "\n" + title.slice(cut).trim();
    size = Math.min(60, ...title.split("\n").map((l) => one(l, { w: tw, max: 60, min: 34, bold: true })));
  }
  const lines = title.split("\n").length;
  const th = lines * size / 72 * 1.25 + 0.1;
  const subSize = s.subtitle ? one(s.subtitle, { w: 5.9, max: 20, min: 13 }) : 0;
  const desc = closing ? s.body : s.desc;
  const descH = desc ? Hh(desc, { w: 5.4, fontSize: 12 }) : 0;
  const blockH = th + (s.subtitle ? 0.2 + subSize / 72 * 1.4 : 0) + (desc ? 0.15 + descH : 0);
  let y = Math.max(1.3, 3.0 - blockH / 2);
  T(slide, title, { x: 0.45, y, w: tw + 0.2, h: th, fontSize: size, bold: true, fontFace: F.title, color: C.cream, valign: "middle", noBalance: true, lineSpacingMultiple: 1.05, objectName: ctx.g("title") });
  y += th + 0.2;
  const cx = 0.45 + tw / 2;
  if (s.subtitle) {
    const h = subSize / 72 * 1.4;
    T(slide, s.subtitle, { x: cx - 3.05, y, w: 6.1, h, fontSize: subSize, color: C.white, align: "center", noBalance: true, objectName: ctx.g("sub") });
    y += h + 0.15;
  }
  if (desc) T(slide, desc, { x: cx - 2.7, y, w: 5.4, h: descH, fontSize: 12, color: C.white, align: "center", objectName: ctx.g("sub") });
}
const cover = (s) => hero(s, false);
const closing = (s) => hero(s, true);

/* ---------------- 目录 ---------------- */
function tocSide(slide, s) {
  const g = ctx.g("side");
  rect(slide, 0, 0, 2.53, 7.5, C.navy, { name: g });
  const t = String(s.title || "目录");
  const n = [...t].length;
  const size = Math.min(44, Math.floor(1.9 * 72 / (1.2 * n)));
  T(slide, [...t].join("\n"), { x: 0.6, y: 0.85, w: 1.3, h: n * size / 72 * 1.2 + 0.05, fontSize: size, color: C.beige, align: "center", lineSpacingMultiple: 1.0, noBalance: true, objectName: g });
  const descH = s.desc ? Hh(s.desc, { w: 1.95, fontSize: 11, lineSpacingMultiple: 1.35 }) : 0;
  const cTop = 0.85 + Math.min(1.9, n * size / 72 * 1.2) + 0.35;
  const cBottom = s.desc ? 7.0 - descH - 0.3 : 6.8;
  const cLen = Math.min(3.5, cBottom - cTop);
  T(slide, "CONTENTS", { x: 1.25 - cLen / 2, y: cTop + cLen / 2 - 0.3, w: cLen, h: 0.6, fontSize: Math.min(30, one("CONTENTS", { w: cLen, max: 30, min: 14, charSpacing: 4 })), color: C.beige, fontFace: F.num, align: "center", valign: "middle", rotate: 90, charSpacing: 4, noBalance: true, objectName: ctx.g("side", "装饰") });
  if (s.desc) T(slide, s.desc, { x: 0.32, y: 7.0 - descH, w: 1.95, h: descH, fontSize: 11, color: C.beige, lineSpacingMultiple: 1.35, objectName: g });
}
async function toc(s) {
  const n = s.items.length;
  const layout = ctx.pickLayout(s, n <= 5 ? ["cards", "list"] : ["list", "cards"]);
  const slide = add(s);
  tocSide(slide, s);
  if (layout === "cards") {
    const x0 = 2.78, avail = W - x0 - 0.12, step = avail / n, cw = step - 0.2;
    s.items.forEach((it, i) => {
      const g = ctx.g("card" + i), x = x0 + i * step, tw = cw - 0.2;
      rect(slide, x, 0, cw, 7.5, C.white, { name: g });
      slide.addImage({ path: ctx.asset("card_fold.png"), x: x + cw, y: 0, w: 0.2, h: 7.5, objectName: g });
      const ns = Math.min(110, Math.floor(step * 62));
      T(slide, String(i + 1), { x, y: 2.85 - ns / 72 * 1.22, w: tw, h: ns / 72 * 1.22, fontSize: ns, color: C.navy, fontFace: F.num, align: "center", valign: "bottom", lineSpacingMultiple: 1.0, noBalance: true, objectName: g });
      T(slide, "PART", { x, y: 2.9, w: tw, h: 0.26, fontSize: 9, color: C.navy, fontFace: F.num, align: "center", noBalance: true, objectName: g });
      let hs = one(it.head, { w: tw, max: 26, min: 15 });
      let lines = 1;
      if (ctx.measure(it.head, { w: tw, fontSize: hs }).lines > 1) { hs = ctx.fit(it.head, { w: tw, h: 0.9, max: 20, min: 13, lineSpacingMultiple: 1.15 }); lines = ctx.measure(it.head, { w: tw, fontSize: hs }).lines; }
      const hh = lines * hs / 72 * 1.25 + 0.05;
      T(slide, it.head, { x, y: 3.85, w: tw, h: hh, fontSize: hs, color: C.ink, align: "center", lineSpacingMultiple: 1.15, objectName: g });
      let y = 3.85 + hh + 0.12;
      if (it.sub) {
        const ss = tw < 1.4 ? 10 : 11, sub = ctx.balance(it.sub, { w: tw - 0.1, fontSize: ss, lineSpacingMultiple: 1.25 }), sh = Hh(sub, { w: tw - 0.1, fontSize: ss });
        T(slide, sub, { x: x + 0.05, y, w: tw - 0.1, h: sh, fontSize: ss, color: C.body, align: "center", noBalance: true, objectName: g }); y += sh;
      }
      hline(slide, x + tw / 2 - 0.15, Math.max(5.5, y + 0.35), 0.3, C.navy, 2.25, g);
    });
  } else {
    const cols = n > 4 ? 2 : 1, rows = Math.ceil(n / cols);
    const x0 = 3.2, cwid = (R - x0 - (cols - 1) * 0.5) / cols, top = 0.95, rh = Math.min(1.45, (6.6 - top) / rows);
    s.items.forEach((it, i) => {
      const g = ctx.g("card" + i), c = Math.floor(i / rows), r = i % rows;
      const x = x0 + c * (cwid + 0.5), y = top + r * rh;
      T(slide, num2(i), { x, y: y + 0.08, w: 1.0, h: 0.7, fontSize: 36, color: i % 2 ? C.beigeD : C.navy, fontFace: F.num, noBalance: true, objectName: g });
      const hs = one(it.head, { w: cwid - 1.2, max: 20, min: 14, bold: true });
      T(slide, it.head, { x: x + 1.1, y: y + 0.1, w: cwid - 1.1, h: 0.42, fontSize: hs, bold: true, color: C.ink, valign: "middle", noBalance: true, objectName: g });
      if (it.sub) T(slide, it.sub, { x: x + 1.1, y: y + 0.55, w: cwid - 1.1, h: 0.3, fontSize: 11, color: C.body, noBalance: true, objectName: g });
      hline(slide, x, y + rh - 0.12, cwid, C.line, 0.75, g);
    });
  }
}

/* ---------------- 章节页 ---------------- */
async function section(s) {
  ctx.pickLayout(s, ["photo"]);
  const slide = add(s, "image");
  slide.addImage({ path: ctx.asset("bg_section.jpg"), x: 0, y: 0, w: 11.1, h: 7.5 });
  slide.addImage({ path: ctx.asset("section_fade.png"), x: 5.5, y: 0, w: 7.83, h: 7.5 });
  rect(slide, 11.1, 0, W - 11.1, 7.5, C.navy);
  corners(slide, s);
  const g = ctx.g("sec"), xR = 12.45, w = 5.6, x = xR - w;
  const num = (s._part || "PART 01").replace(/^PART\s*/, "");
  const tSize = Math.min(80, one(s.title, { w, max: 80, min: 40 }));
  const lines = tSize <= 40 && ctx.measure(s.title, { w, fontSize: 40 }).lines > 1 ? 2 : 1;
  const tSize2 = lines > 1 ? ctx.fit(s.title, { w, h: 2.0, max: 54, min: 36, lineSpacingMultiple: 1.05 }) : tSize;
  const th = lines * tSize2 / 72 * 1.15 + 0.05;
  const enH = s.en ? 0.32 : 0;
  const dH = s.desc ? Hh(s.desc, { w: 5.0, fontSize: 11 }) : 0;
  const kH = s.keywords?.length ? 0.4 : 0;
  const total = 1.25 + th + (enH ? enH + 0.1 : 0) + (dH ? dH + 0.15 : 0) + (kH ? kH + 0.2 : 0);
  let y = Math.max(0.95, 3.75 - total / 2);
  T(slide, "PART", { x: xR - 3.4, y: y + 0.55, w: 1.75, h: 0.5, fontSize: 26, color: C.white, fontFace: F.num, align: "right", noBalance: true, objectName: g });
  T(slide, num, { x: xR - 1.6, y: y - 0.1, w: 1.6, h: 1.3, fontSize: 76, color: C.white, fontFace: F.num, align: "right", valign: "middle", lineSpacingMultiple: 1.0, noBalance: true, objectName: g });
  y += 1.25;
  T(slide, s.title, { x, y, w, h: th, fontSize: tSize2, color: C.white, align: "right", valign: "middle", lineSpacingMultiple: 1.05, objectName: g });
  y += th + 0.1;
  if (s.en) { T(slide, s.en.toUpperCase(), { x, y, w, h: enH, fontSize: one(s.en.toUpperCase(), { w, max: 13, min: 9, charSpacing: 2 }), color: C.beige, fontFace: F.num, charSpacing: 2, align: "right", noBalance: true, objectName: g }); y += enH + 0.1; }
  if (s.desc) { T(slide, s.desc, { x: xR - 5.0, y, w: 5.0, h: dH, fontSize: 11, color: C.white, align: "right", objectName: g }); y += dH + 0.2; }
  if (s.keywords?.length) {
    const ws = s.keywords.map((k) => wid(k, { fontSize: 11 }) + 0.36);
    let xx = xR - (ws.reduce((a, b) => a + b, 0) + (ws.length - 1) * 0.12);
    s.keywords.forEach((k, i) => {
      box(slide, "ROUNDED_RECTANGLE", xx, y, ws[i], 0.36, null, { radius: 0.18, line: C.beige, lw: 1, name: g });
      T(slide, k, { x: xx, y, w: ws[i], h: 0.36, fontSize: 11, color: C.beige, align: "center", valign: "middle", noBalance: true, objectName: g });
      xx += ws[i] + 0.12;
    });
  }
}

/* ---------------- 3 要点 ---------------- */
async function points3(s) {
  const layout = ctx.pickLayout(s, ["pyramid", "photos", "banner"]);
  const slide = add(s);
  header(slide, s);
  const G = (l) => ctx.g("body", l);
  if (layout === "pyramid") {
    let y = lead(slide, s, 1.4, { w: 8.4, g: "body" });
    const cH = concH(s, 8.4);
    const bottom = 7.05 - (cH ? cH + 0.2 : 0);
    const gap = 0.16, bh = (bottom - y - 2 * gap) / 3;
    // 金字塔：三层（尖顶三角 + 两层梯形），驼 / 深蓝 / 驼
    const px = 9.35, pw = 3.3, top = Math.max(1.4, y - 0.1), ph = bottom - top, lh = ph / 3;
    for (let i = 0; i < 3; i++) {
      const yy = top + i * lh, ww = pw * (i + 1) / 3, fill = i % 2 ? C.navy : C.beige;
      if (i === 0) box(slide, "ISOSCELES_TRIANGLE", px + pw / 2 - ww / 2, yy, ww, lh - 0.08, fill, { name: G("塔") });
      else box(slide, "TRAPEZOID", px + pw / 2 - ww / 2, yy, ww, lh - 0.08, fill, { name: G("塔") });
      await icon(slide, s.items[i].icon, C.white, px + pw / 2 - 0.22, yy + (i === 0 ? lh * 0.45 : lh * 0.3), 0.44, ["layers", "database", "settings"][i], G("图标"));
    }
    s.items.forEach((it, i) => {
      const yy = y + i * (bh + gap), w = 8.4 - (2 - i) * 0 - i * 0.45;
      box(slide, "RECTANGLE", L, yy, w, bh, C.white, { line: C.line, lw: 1, name: G("框") });
      const hs = Math.min(18, one(it.head, { w: w - 0.6, max: 18, min: 14, bold: true }));
      T(slide, it.head, { x: L + 0.25, y: yy + 0.12, w: w - 0.5, h: 0.4, fontSize: hs, bold: true, color: C.ink, valign: "middle", noBalance: true, objectName: G("标题") });
      const bh2 = bh - 0.62;
      T(slide, it.body, { x: L + 0.25, y: yy + 0.55, w: w - 0.5, h: bh2, fontSize: ctx.fit(it.body, { w: w - 0.5, h: bh2, max: 13, min: 11, lineSpacingMultiple: 1.25 }), color: C.body, objectName: G("正文") });
    });
    if (cH) conclusion(slide, s, bottom + 0.2, { w: 8.4 });
  } else if (layout === "photos") {
    let y = lead(slide, s, 1.4, { g: "body" });
    const cH = concH(s);
    const bottom = 7.05 - (cH ? cH + 0.2 : 0);
    const bodyH = Math.max(...s.items.map((it) => Hh(it.body, { w: 3.45, fontSize: 12 })));
    const ph = Math.min(3.4, bottom - y - 0.55 - 0.2 - bodyH - 0.1), pw = 3.55, gapX = (R - L - 3 * pw) / 2, sk = 0.5;
    for (let i = 0; i < 3; i++) {
      const x = L + i * (pw + gapX);
      await ctx.pic(slide, s, i, x, y, pw, ph, { fallback: [PHOTOS[1], PHOTOS[2], PHOTOS[3]][i], name: G("照片") });
      // 斜切：左上、右下各压一块白三角（原模板是平行四边形照片）
      box(slide, "RIGHT_TRIANGLE", x - 0.01, y - 0.01, sk, ph + 0.02, C.white, { flipV: true, name: G("斜切") });
      box(slide, "RIGHT_TRIANGLE", x + pw - sk + 0.01, y - 0.01, sk, ph + 0.02, C.white, { flipH: true, name: G("斜切") });
      const it = s.items[i], py = y + ph + 0.12;
      pill(slide, it.head, x + 0.25, py, pw - 0.85, 0.42, i % 2 ? C.beigeD : C.navy, { name: G("标签") });
      T(slide, it.body, { x: x + 0.1, y: py + 0.55, w: 3.45, h: bodyH, fontSize: 12, color: C.body, align: "center", objectName: G("正文") });
    }
    if (cH) conclusion(slide, s, bottom + 0.2);
  } else {
    let y = lead(slide, s, 1.4, { g: "body" });
    const colW = 3.6, gapX = (R - L - 3 * colW) / 2;
    const bodyH = Math.max(...s.items.map((it) => Hh(it.body, { w: colW, fontSize: 12 })));
    s.items.forEach((it, i) => {
      const x = L + i * (colW + gapX);
      T(slide, it.head, { x, y, w: colW, h: 0.42, fontSize: one(it.head, { w: colW, max: 18, min: 14, bold: true }), bold: true, color: C.ink, valign: "middle", noBalance: true, objectName: G("标题") });
      rect(slide, x, y + 0.48, 0.5, 0.05, i % 2 ? C.beige : C.navy, { name: G("短线") });
      T(slide, it.body, { x, y: y + 0.62, w: colW, h: bodyH, fontSize: 12, color: C.body, objectName: G("正文") });
    });
    y += 0.62 + bodyH + 0.3;
    const cH = concH(s);
    const bh = Math.max(1.4, Math.min(2.4, 7.05 - y - (cH ? cH + 0.2 : 0)));
    await ctx.pic(slide, s, 0, L, y, R - L, bh, { fallback: "photo_handshake.jpg", name: G("横幅") });
    if (cH) conclusion(slide, s, y + bh + 0.2);
  }
}

/* ---------------- 4 要点 ---------------- */
async function points4(s) {
  const layout = ctx.pickLayout(s, ["ring", "quad"]);
  const slide = add(s);
  header(slide, s);
  const G = (l) => ctx.g("body", l);
  let y = lead(slide, s, 1.4, { align: "center", g: "body" });
  const cH = concH(s);
  const bottom = 7.05 - (cH ? cH + 0.2 : 0);
  const DEF = ["clipboard", "edit", "file-text", "clock"];
  if (layout === "ring") {
    // 双环「无限」：两个圆环相切，每环四段
    const D = Math.min(3.1, bottom - y - 0.1), cy = y + D / 2 + 0.05, cxL = W / 2 - D / 2 + 0.02, cxR = W / 2 + D / 2 - 0.02, th = 0.48;
    const seg = (cx, a0, a1, fill) => box(slide, "BLOCK_ARC", cx - D / 2, cy - D / 2, D, D, fill, { angle: [a0, a1], thick: th, name: G("环") });
    seg(cxL, 180, 270, C.track); seg(cxL, 270, 360, C.navy); seg(cxL, 0, 90, C.beige); seg(cxL, 90, 180, C.navy);
    seg(cxR, 180, 270, C.beige); seg(cxR, 270, 360, C.beige); seg(cxR, 0, 90, C.track); seg(cxR, 90, 180, C.navy);
    const r = D / 2 * (1 - th / 2), ic = 0.42, at = (cx, deg) => [cx + r * Math.cos(deg * Math.PI / 180) - ic / 2, cy + r * Math.sin(deg * Math.PI / 180) - ic / 2];
    const spots = [at(cxL, 315), at(cxL, 45), at(cxR, 225), at(cxR, 135)];
    for (let i = 0; i < 4; i++) await icon(slide, s.items[i].icon, C.white, spots[i][0], spots[i][1], ic, DEF[i], G("图标"));
    // 四角文字：01 / 02 在左，03 / 04 在右
    const tw = cxL - D / 2 - L - 0.25, half = D / 2;
    s.items.forEach((it, i) => {
      const left = i < 2, x = left ? L : cxR + D / 2 + 0.25, yy = cy - half + (i % 2) * (half + 0.1) - 0.1, align = left ? "left" : "right";
      T(slide, num2(i), { x, y: yy, w: tw, h: 0.48, fontSize: 24, color: C.ink, fontFace: F.num, align, noBalance: true, objectName: G("编号") });
      hline(slide, x, yy + 0.52, tw, C.line, 0.75, G("线"));
      T(slide, it.head, { x, y: yy + 0.6, w: tw, h: 0.38, fontSize: one(it.head, { w: tw, max: 17, min: 13, bold: true }), bold: true, color: C.ink, align, valign: "middle", noBalance: true, objectName: G("标题") });
      T(slide, it.body, { x, y: yy + 1.0, w: tw, h: Math.max(0.5, half - 1.1), fontSize: ctx.fit(it.body, { w: tw, h: Math.max(0.5, half - 1.1), max: 12, min: 11 }), color: C.body, align, objectName: G("正文") });
    });
  } else {
    // 四瓣圆 + 四张卡片
    const D = Math.min(3.6, bottom - y), cx = W / 2, cy = y + D / 2;
    oval(slide, cx - D / 2, cy - D / 2, D, null, { line: C.line, lw: 1, name: G("外圈") });
    const p = D * 0.36;
    const petals = [[cx - p - 0.05, cy - p - 0.05, 0, C.navy], [cx + 0.05, cy - p - 0.05, 90, C.beige], [cx + 0.05, cy + 0.05, 180, C.navy], [cx - p - 0.05, cy + 0.05, 270, C.beige]];
    for (const [x, yy, rot, fill] of petals) box(slide, "TEAR", x, yy, p, p, fill, { rotate: rot, name: G("花瓣") });
    oval(slide, cx - D * 0.2, cy - D * 0.2, D * 0.4, C.white, { name: G("圆心") });
    await icon(slide, "bar-chart-2", C.navy, cx - 0.3, cy - 0.3, 0.6, "bar-chart-2", G("图标"));
    const ics = [[cx - p * 0.62, cy - p * 0.62], [cx + p * 0.62, cy - p * 0.62], [cx + p * 0.62, cy + p * 0.62], [cx - p * 0.62, cy + p * 0.62]];
    for (let i = 0; i < 4; i++) await icon(slide, s.items[i].icon, C.white, ics[i][0] - 0.19, ics[i][1] - 0.19, 0.38, DEF[i], G("图标"));
    const cw = cx - D / 2 - 0.35 - L, ch = (D - 0.25) / 2;
    s.items.forEach((it, i) => {
      const left = i % 2 === 0, x = left ? L : cx + D / 2 + 0.35, yy = y + Math.floor(i / 2) * (ch + 0.25);
      rect(slide, x, yy, cw, ch, C.white, { line: C.line, lw: 1, name: G("卡片") });
      rect(slide, left ? x : x + cw - 0.05, yy, 0.05, ch, i < 2 === left ? C.navy : C.beige, { name: G("卡片边") });
      const pw = Math.min(cw - 0.6, wid(it.head, { fontSize: 14, bold: true }) + 0.7);
      pill(slide, it.head, left ? x + 0.25 : x + cw - 0.25 - pw, yy + 0.25, pw, 0.4, i === 0 || i === 3 ? C.navy : C.beigeD, { name: G("标签"), size: 14 });
      const bh = ch - 0.85;
      T(slide, it.body, { x: x + 0.25, y: yy + 0.78, w: cw - 0.5, h: bh, fontSize: ctx.fit(it.body, { w: cw - 0.5, h: bh, max: 12, min: 11 }), color: C.body, align: left ? "left" : "right", objectName: G("正文") });
    });
  }
  if (cH) conclusion(slide, s, bottom + 0.2);
}

/* ---------------- 对比 ---------------- */
async function compare(s) {
  const layout = ctx.pickLayout(s, ["vs", "cards"]);
  const slide = add(s);
  header(slide, s);
  const G = (l) => ctx.g("body", l);
  let y = lead(slide, s, 1.4, { align: "center", g: "body" });
  const cH = concH(s);
  const bottom = 7.05 - (cH ? cH + 0.2 : 0);
  if (layout === "vs") {
    const H = bottom - y, cy = y + H / 2, D = Math.min(1.85, H * 0.42), halo = Math.min(3.2, H * 0.98);
    const cxL = W / 2 - 1.35, cxR = W / 2 + 1.35;
    slide.addImage({ path: ctx.asset("halo.png"), x: cxL - halo / 2, y: cy - halo / 2, w: halo, h: halo, objectName: G("光晕") });
    slide.addImage({ path: ctx.asset("halo.png"), x: cxR - halo / 2, y: cy - halo / 2, w: halo, h: halo, objectName: G("光晕") });
    oval(slide, cxL - D / 2, cy - D / 2, D, C.navy, { name: G("圆") });
    oval(slide, cxR - D / 2, cy - D / 2, D, C.beigeD, { name: G("圆") });
    for (const [side, cx] of [["left", cxL], ["right", cxR]]) {
      const hd = s[side].head;
      T(slide, hd, { x: cx - D / 2 + 0.1, y: cy - D / 2, w: D - 0.2, h: D, fontSize: ctx.fit(hd, { w: D - 0.3, h: D * 0.6, max: 20, min: 13, bold: true }), bold: true, color: C.white, align: "center", valign: "middle", objectName: G("圆字") });
    }
    pill(slide, "VS", W / 2 - 0.45, cy - 0.2, 0.9, 0.4, C.white, { line: C.beige, color: C.navy, size: 13, name: G("VS") });
    // 两侧条目：每侧 2～4 条，竖排在圆外
    const tw = cxL - halo / 2 + 0.2 - L;
    for (const side of ["left", "right"]) {
      const items = s[side].items, n = items.length, gap = (H - 0.1) / n;
      items.forEach((txt, i) => {
        const yy = y + i * gap + Math.max(0, (gap - 0.75) / 2), left = side === "left";
        const x = left ? L : R - tw;
        oval(slide, left ? x + tw + 0.05 : x - 0.21, yy + 0.12, 0.16, left ? C.navy : C.beige, { name: G("点") });
        T(slide, `${num2(i)}`, { x, y: yy, w: tw, h: 0.36, fontSize: 15, bold: true, color: left ? C.navy : C.beigeD, fontFace: F.num, align: left ? "right" : "left", noBalance: true, objectName: G("编号") });
        T(slide, txt, { x, y: yy + 0.38, w: tw, h: Math.min(gap - 0.42, 0.62), fontSize: 12, color: C.body, align: left ? "right" : "left", objectName: G("条目") });
      });
    }
  } else {
    const most = Math.max(s.left.items.length, s.right.items.length);
    const cw = (R - L - 0.5) / 2, H = Math.min(bottom - y, 1.45 + most * 0.95);
    if (H < bottom - y) y += (bottom - y - H) / 3;
    for (const [k, side] of [[0, "left"], [1, "right"]]) {
      const x = L + k * (cw + 0.5), d = s[side];
      rect(slide, x, y, cw, H, C.white, { line: C.line, lw: 1, name: G("卡片") });
      rect(slide, k ? x + cw - 0.06 : x, y, 0.06, H, k ? C.beige : C.navy, { name: G("卡片边") });
      const pw = Math.min(cw - 0.8, wid(d.head, { fontSize: 16, bold: true }) + 0.9);
      pill(slide, d.head, x + 0.4, y + 0.35, pw, 0.48, k ? C.beigeD : C.navy, { size: 16, name: G("标签") });
      if (d.icon) await icon(slide, d.icon, k ? C.beigeD : C.navy, x + cw - 0.85, y + 0.37, 0.44, "circle", G("图标"));
      const n = d.items.length, top = y + 1.15, rh = Math.min(0.9, (H - 1.35) / most);
      d.items.forEach((txt, i) => {
        const yy = top + i * rh;
        oval(slide, x + 0.45, yy + 0.13, 0.12, k ? C.beige : C.navy, { name: G("点") });
        T(slide, txt, { x: x + 0.75, y: yy, w: cw - 1.1, h: rh - 0.1, fontSize: 13, color: C.ink, objectName: G("条目") });
        if (i < n - 1) hline(slide, x + 0.75, yy + rh - 0.06, cw - 1.1, C.line, 0.5, G("线"));
      });
    }
  }
  if (cH) conclusion(slide, s, bottom + 0.2);
}

/* ---------------- 数据 ---------------- */
const parseNum = (v) => { const m = String(v).replace(/,/g, "").match(/-?\d+(\.\d+)?/); return m ? +m[0] : null; };
const unitOf = (v) => String(v).replace(/[\d.,\s-]/g, "");
async function stats(s) {
  const vals = s.items.map((it) => parseNum(it.value)), units = s.items.map((it) => unitOf(it.value));
  const allPct = units.every((u) => u === "%") && vals.every((v) => v !== null && v >= 0 && v <= 100);
  const sameUnit = vals.every((v) => v !== null) && units.every((u) => u === units[0]);
  const layout = ctx.pickLayout(s, [allPct ? "bars" : null, sameUnit || s.chart?.values ? "chart" : null, "numbers"]);
  const slide = add(s);
  header(slide, s);
  const G = (l) => ctx.g("body", l);
  const srcH = Hh(s.source, { w: R - L, fontSize: 9, lineSpacingMultiple: 1.2 });
  const srcY = 7.15 - srcH;
  if (s.source) T(slide, `来源：${s.source}`, { x: L, y: srcY, w: R - L, h: srcH, fontSize: 9, color: C.gray, lineSpacingMultiple: 1.2, objectName: G("来源") });
  const bottom = srcY - 0.2;
  if (layout === "bars") {
    const ph = Math.min(3.9, bottom - 1.6), pw = 2.75;
    await ctx.pic(slide, s, 0, L + 0.2, 1.6, pw, ph, { fallback: "photo_portrait.jpg", name: G("照片") });
    const x = L + pw + 0.75, w = R - x;
    let y = lead(slide, s, 1.6, { x, w, size: 14, g: "body", gap: 0.3 });
    const n = s.items.length, rh = Math.min(0.95, (bottom - y) / n);
    s.items.forEach((it, i) => {
      const yy = y + i * rh;
      T(slide, it.label, { x, y: yy, w: w - 1.3, h: 0.36, fontSize: 14, bold: true, color: C.ink, valign: "middle", noBalance: true, objectName: G("标签") });
      rect(slide, x, yy + 0.45, w - 1.3, 0.14, C.track, { name: G("轨道") });
      rect(slide, x, yy + 0.45, Math.max(0.05, (w - 1.3) * vals[i] / 100), 0.14, i % 2 ? C.beige : C.navy, { name: G("进度") });
      T(slide, it.value, { x: R - 1.15, y: yy + 0.2, w: 1.15, h: 0.5, fontSize: 22, color: C.ink, fontFace: F.num, align: "right", valign: "middle", noBalance: true, objectName: G("数值") });
    });
  } else if (layout === "chart") {
    let y = lead(slide, s, 1.4, { g: "body" });
    const lw = 4.2, n = s.items.length, rh = (bottom - y) / n;
    s.items.forEach((it, i) => {
      const yy = y + i * rh;
      rect(slide, L, yy + 0.1, 0.06, rh - 0.3, i % 2 ? C.beige : C.navy, { name: G("竖条") });
      T(slide, it.value, { x: L + 0.25, y: yy, w: lw - 0.3, h: Math.min(0.75, rh * 0.55), fontSize: Math.min(32, one(it.value, { w: lw - 0.3, max: 32, min: 20, bold: true })), bold: true, color: C.navy, fontFace: F.num, valign: "middle", noBalance: true, objectName: G("数值") });
      T(slide, it.label, { x: L + 0.25, y: yy + Math.min(0.75, rh * 0.55), w: lw - 0.3, h: 0.32, fontSize: 12, color: C.body, noBalance: true, objectName: G("说明") });
    });
    const cx = L + lw + 0.4, cw = R - cx;
    const ch = s.chart || {};
    const labels = ch.labels || s.items.map((it) => it.label);
    const values = ch.values || vals;
    let cy = y;
    if (ch.title) { T(slide, ch.title, { x: cx, y: cy, w: cw, h: 0.36, fontSize: 14, color: C.ink, noBalance: true, objectName: G("图表标题") }); hline(slide, cx, cy + 0.42, cw, C.line, 0.75, G("线")); cy += 0.55; }
    slide.addChart(ctx.charts.BAR, [{ name: ch.title || "数据", labels, values }], {
      x: cx, y: cy, w: cw, h: bottom - cy, barDir: "col", chartColors: [C.navy], barGapWidthPct: 80,
      catAxisLabelColor: C.body, valAxisLabelColor: C.gray, catAxisLabelFontSize: 10, valAxisLabelFontSize: 9, catAxisLabelFontFace: F.body,
      valGridLine: { color: "EDEDED", size: 0.5 }, catAxisLineShow: false, valAxisLineShow: false,
      showValue: true, dataLabelColor: C.ink, dataLabelFontSize: 10, dataLabelFormatCode: ch.unit === "%" ? '0"%"' : "General", showLegend: false,
      objectName: G("图表"),
    });
  } else {
    let y = lead(slide, s, 1.5, { g: "body", gap: 0.4 });
    const n = s.items.length, gap = 0.35, cw = (R - L - (n - 1) * gap) / n, chh = Math.min(2.8, bottom - y);
    s.items.forEach((it, i) => {
      const x = L + i * (cw + gap);
      rect(slide, x, y, cw, chh, i % 2 ? C.beigeL : "F3F5F9", { name: G("卡片") });
      rect(slide, x, y, cw, 0.08, i % 2 ? C.beige : C.navy, { name: G("顶条") });
      const vs = one(it.value, { w: cw - 0.4, max: 40, min: 22, bold: true });
      T(slide, it.value, { x: x + 0.2, y: y + 0.45, w: cw - 0.4, h: 0.9, fontSize: vs, bold: true, color: C.navy, fontFace: F.num, align: "center", valign: "middle", noBalance: true, objectName: G("数值") });
      hline(slide, x + cw / 2 - 0.3, y + 1.5, 0.6, i % 2 ? C.beigeD : C.navy, 1.5, G("线"));
      T(slide, it.label, { x: x + 0.2, y: y + 1.7, w: cw - 0.4, h: chh - 1.85, fontSize: 13, color: C.body, align: "center", objectName: G("说明") });
    });
  }
}

/* ---------------- 时间线 ---------------- */
async function timeline(s) {
  const n = s.items.length;
  const layout = ctx.pickLayout(s, ["stairs", "gantt", n <= 5 ? "arrows" : null]);
  const slide = add(s);
  header(slide, s);
  const G = (l) => ctx.g("body", l);
  if (layout === "stairs") {
    let y = lead(slide, s, 1.4, { g: "body" });
    const cH = concH(s), bottom = 7.05 - (cH ? cH + 0.2 : 0);
    const colW = (R - L) / n, bodyH = Math.max(...s.items.map((it) => (it.body ? Hh(it.body, { w: colW - 0.3, fontSize: 11 }) : 0)));
    s.items.forEach((it, i) => {
      const x = L + i * colW;
      T(slide, it.head, { x, y, w: colW - 0.2, h: 0.38, fontSize: one(it.head, { w: colW - 0.2, max: 17, min: 13, bold: true }), bold: true, color: C.ink, valign: "middle", noBalance: true, objectName: G("标题") });
      if (it.body) T(slide, it.body, { x, y: y + 0.42, w: colW - 0.3, h: bodyH, fontSize: 11, color: C.body, objectName: G("正文") });
    });
    const axisY = bottom - 0.95, barTop = y + 0.5 + bodyH + 0.55, bh = Math.min(0.36, (axisY - 0.5 - barTop) / n);
    const base = axisY - 0.55;
    for (let i = 0; i < n; i++) {
      const x = L + i * colW, yy = base - (i + 1) * bh;
      rect(slide, x, yy, R - x, bh, i % 2 ? C.beige : C.navy, { name: G("阶梯") });
      oval(slide, x + 0.05, yy - 0.42, 0.34, i % 2 ? C.beige : C.navy, { name: G("标记") });
      await icon(slide, "clock", C.white, x + 0.12, yy - 0.35, 0.2, "clock", G("图标"));
    }
    hline(slide, L, axisY, R - L, C.line, 0.75, G("轴"));
    s.items.forEach((it, i) => {
      const cx = L + i * colW + colW / 2;
      vline(slide, cx, y + 0.45 + bodyH + 0.1, axisY - (y + 0.45 + bodyH + 0.1), C.line, 0.5, G("竖线"));
      oval(slide, cx - 0.14, axisY - 0.14, 0.28, C.white, { line: i % 2 ? C.beige : C.navy, lw: 1.5, name: G("节点") });
      oval(slide, cx - 0.07, axisY - 0.07, 0.14, i % 2 ? C.beige : C.navy, { name: G("节点") });
      T(slide, it.time, { x: cx - colW / 2, y: axisY + 0.25, w: colW, h: 0.4, fontSize: one(it.time, { w: colW - 0.2, max: 17, min: 12, bold: true }), bold: true, color: C.ink, align: "center", valign: "middle", noBalance: true, objectName: G("时间") });
    });
    if (cH) conclusion(slide, s, bottom + 0.2);
  } else if (layout === "gantt") {
    let y = lead(slide, s, 1.4, { g: "body", gap: 0.2 });
    const cH = concH(s), bottom = 7.05 - (cH ? cH + 0.2 : 0);
    const colW = (R - L - 0.3) / n, axisY = bottom - 0.2;
    const bodyH = Math.max(0, ...s.items.map((it) => (it.body ? Hh(it.body, { w: colW - 0.35, fontSize: 10.5 }) : 0)));
    const labelTop = axisY - 0.2 - bodyH - 0.4;
    const ah = 0.52, step = Math.min(0.72, (labelTop - 0.2 - y - ah) / Math.max(1, n - 1));
    s.items.forEach((it, i) => {
      const x = L + 0.25 + i * colW, ay = y + i * step, len = Math.min(R - x, colW * 1.9);
      vline(slide, x + 0.03, ay + ah, axisY - ay - ah - 0.12, C.line, 0.75, G("竖线"));
      oval(slide, x - 0.09, axisY - 0.12, 0.24, C.white, { line: C.line, lw: 1, name: G("节点") });
      box(slide, "PENTAGON", x, ay, len, ah, i % 2 ? C.beigeD : C.navy, { name: G("箭头") });
      T(slide, it.head, { x: x + 0.2, y: ay, w: len - 0.55, h: ah, fontSize: one(it.head, { w: len - 0.6, max: 16, min: 12, bold: true }), bold: true, color: C.white, valign: "middle", noBalance: true, objectName: G("标题") });
      T(slide, it.time, { x: x + 0.18, y: labelTop, w: colW - 0.25, h: 0.36, fontSize: one(it.time, { w: colW - 0.3, max: 15, min: 11, bold: true }), bold: true, color: C.ink, valign: "middle", noBalance: true, objectName: G("时间") });
      if (it.body) T(slide, it.body, { x: x + 0.18, y: labelTop + 0.4, w: colW - 0.35, h: bodyH, fontSize: 10.5, color: C.body, objectName: G("正文") });
    });
    hline(slide, L, axisY, R - L, C.line, 0.75, G("轴"));
    if (cH) conclusion(slide, s, bottom + 0.2);
  } else {
    // 弯箭头时间带（原第 22 页）：横带上写时间，单数项向下弯、双数项向上弯，说明文字在箭头尖外侧
    let y0 = lead(slide, s, 1.35, { g: "band", align: "center", gap: 0.1 });
    const cH = concH(s, R - L);
    const P = Math.min(2.25, (R - 0.4 - 3.0) / Math.max(1, n - 1)), first = 3.0;
    const bandY = (y0 + (7.05 - (cH ? cH + 0.2 : 0))) / 2 - 0.2;
    const shaft = (i) => first + i * P;
    rect(slide, shaft(n - 1), bandY, W - shaft(n - 1), 0.41, C.track, { name: ctx.g("band", "轨道") });
    for (let i = n - 1; i >= 0; i--) bent(slide, i === 0 ? 0 : shaft(i - 1) - 0.1, shaft(i), bandY, i % 2 === 0, i % 2 === 0 ? C.navy : C.beigeD, ctx.g("band", "箭头" + i));
    s.items.forEach((it, i) => T(slide, it.time, { x: shaft(i) - P - 0.05 + (i === 0 ? 0.5 : 0.45), y: bandY, w: P - 0.8, h: 0.41, fontSize: one(it.time, { w: P - 0.9, max: 14, min: 10 }), color: C.white, fontFace: F.num, align: "center", valign: "middle", noBalance: true, objectName: ctx.g("band", "时间") }));
    s.items.forEach((it, i) => {
      const g = ctx.g("item" + i), down = i % 2 === 0, tw = Math.min(3.1, 2 * P - 0.3);
      const x = Math.max(L, Math.min(R - tw, shaft(i) - tw * 0.55));
      const bh = it.body ? Hh(it.body, { w: tw, fontSize: 12 }) : 0;
      const yy = down ? bandY + 1.35 : bandY - 1.0 - 0.42 - bh;
      T(slide, it.head, { x, y: yy, w: tw, h: 0.38, fontSize: one(it.head, { w: tw, max: 17, min: 13, bold: true }), bold: true, color: C.ink, valign: "middle", noBalance: true, objectName: g });
      if (it.body) T(slide, it.body, { x, y: yy + 0.42, w: tw, h: bh, fontSize: 12, color: C.body, objectName: g });
    });
    if (cH) conclusion(slide, s, 7.05 - cH, { g: "band" });
  }
}
/** 弯箭头：横带 + 四分之一圆弧 + 竖杆 + 箭头（down=true 向下） */
function bent(slide, x0, shaftC, yT, down, color, name) {
  const t = 0.41, Ro = 0.72, Ri = Ro - t, hw = 0.42, headH = 0.42, tipD = yT + 1.22, tipU = yT - 0.86;
  const xr = shaftC + t / 2, xl = shaftC - t / 2, cx = xr - Ro, pts = [];
  const arc = (r, a0, a1, cy) => { for (let k = 0; k <= 12; k++) { const a = a0 + (a1 - a0) * k / 12; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  if (down) {
    const cy = yT + Ro;
    pts.push([x0, yT]); arc(Ro, -Math.PI / 2, 0, cy);
    pts.push([xr, tipD - headH], [shaftC + hw, tipD - headH], [shaftC, tipD], [shaftC - hw, tipD - headH], [xl, tipD - headH]);
    arc(Ri, 0, -Math.PI / 2, cy); pts.push([x0, yT + t]);
  } else {
    const yB = yT + t, cy = yB - Ro;
    pts.push([x0, yB]); arc(Ro, Math.PI / 2, 0, cy);
    pts.push([xr, tipU + headH], [shaftC + hw, tipU + headH], [shaftC, tipU], [shaftC - hw, tipU + headH], [xl, tipU + headH]);
    arc(Ri, 0, Math.PI / 2, cy); pts.push([x0, yB - t]);
  }
  const minX = Math.min(...pts.map((p) => p[0])), minY = Math.min(...pts.map((p) => p[1]));
  const maxX = Math.max(...pts.map((p) => p[0])), maxY = Math.max(...pts.map((p) => p[1]));
  slide.addShape(ctx.shapes.CUSTOM_GEOMETRY, {
    x: minX, y: minY, w: maxX - minX, h: maxY - minY, fill: { color }, line: { type: "none" }, objectName: name,
    points: [...pts.map(([x, y], k) => (k === 0 ? { x: x - minX, y: y - minY, moveTo: true } : { x: x - minX, y: y - minY })), { close: true }],
  });
}

/* ---------------- 大图配文 ---------------- */
async function imageText(s) {
  const layout = ctx.pickLayout(s, ["side", "panel"]);
  const slide = add(s);
  header(slide, s);
  const G = (l) => ctx.g("body", l);
  if (layout === "side") {
    const pw = 5.4, ph = 3.85, py = 1.7;
    await ctx.pic(slide, s, 0, L, py, pw, ph, { fallback: "photo_desk.jpg", name: G("照片") });
    const x = L + pw + 0.55, w = R - x;
    const bodySize = ctx.fit(s.body, { w, h: 1.9, max: 14, min: 12, lineSpacingMultiple: 1.45 });
    const bh = Hh(s.body, { w, fontSize: bodySize, lineSpacingMultiple: 1.45 });
    let y = py + 0.05;
    T(slide, s.body, { x, y, w, h: bh, fontSize: bodySize, color: C.ink, lineSpacingMultiple: 1.45, objectName: G("正文") });
    y += bh + 0.25;
    (s.points || []).forEach((p, i) => {
      rect(slide, x, y + 0.08, 0.07, 0.26, i % 2 ? C.beige : C.navy, { name: G("标记") });
      const h = Math.max(0.42, Hh(p, { w: w - 0.3, fontSize: 13, bold: true }));
      T(slide, p, { x: x + 0.25, y, w: w - 0.25, h, fontSize: 13, bold: true, color: C.navy, objectName: G("要点") });
      y += h + 0.12;
    });
    if (s.conclusion) conclusion(slide, s, Math.max(py + ph + 0.35, y + 0.15));
  } else {
    const px = L - 0.1, pw = R - L + 0.2, w0 = pw * 0.42 + 0.6;
    const bs0 = ctx.fit(s.body, { w: w0, h: 2.0, max: 14, min: 12, lineSpacingMultiple: 1.45 });
    const need = 0.5 + Hh(s.body, { w: w0, fontSize: bs0, lineSpacingMultiple: 1.45 }) + 0.25
      + (s.points || []).reduce((a, p) => a + Math.max(0.4, Hh(p, { w: w0, fontSize: 13, bold: true })) + 0.25, 0)
      + (s.conclusion ? Hh(s.conclusion, { w: w0 + 0.2, fontSize: 13, bold: true }) + 0.5 : 0) + 0.3;
    const ph = Math.max(3.9, Math.min(5.45, need)), py = 1.6 + (5.45 - ph) / 2;
    rect(slide, px, py, pw, ph, C.navy, { name: G("面板") });
    const imx = px + pw * 0.42;
    await ctx.pic(slide, s, 0, imx, py, px + pw - imx, ph, { fallback: "photo_calc2.jpg", name: G("照片") });
    slide.addImage({ path: ctx.asset("panel_tint.png"), x: imx, y: py, w: px + pw - imx, h: ph, objectName: G("蒙层") });
    const x = px + 0.5, w = pw * 0.42 + 0.6;
    const bodySize = ctx.fit(s.body, { w, h: 2.0, max: 14, min: 12, lineSpacingMultiple: 1.45 });
    const bh = Hh(s.body, { w, fontSize: bodySize, lineSpacingMultiple: 1.45 });
    let y = py + 0.5;
    T(slide, s.body, { x, y, w, h: bh, fontSize: bodySize, color: C.white, lineSpacingMultiple: 1.45, objectName: G("正文") });
    y += bh + 0.25;
    (s.points || []).forEach((p) => {
      hline(slide, x, y, 0.6, C.beige, 1, G("线"));
      const h = Math.max(0.4, Hh(p, { w, fontSize: 13, bold: true }));
      T(slide, p, { x, y: y + 0.12, w, h, fontSize: 13, bold: true, color: C.white, objectName: G("要点") });
      y += h + 0.25;
    });
    if (s.conclusion) {
      const ch = Hh(s.conclusion, { w: w + 0.2, fontSize: 13, bold: true });
      T(slide, s.conclusion, { x, y: py + ph - 0.4 - ch, w: w + 0.2, h: ch, fontSize: 13, bold: true, color: C.beige, objectName: G("结论") });
    }
  }
}

/* ---------------- 金句 ---------------- */
async function quote(s) {
  ctx.pickLayout(s, ["night"]);
  const slide = add(s, "image");
  slide.addImage({ path: ctx.asset("bg_section.jpg"), x: 0, y: 0, w: 11.1, h: 7.5 });
  slide.addImage({ path: ctx.asset("section_fade.png"), x: 5.5, y: 0, w: 7.83, h: 7.5 });
  rect(slide, 11.1, 0, W - 11.1, 7.5, C.navy);
  const g = ctx.g("quote"), x = 6.9, w = 5.55;
  T(slide, "“", { x: x - 0.1, y: 1.1, w: 1.2, h: 1.2, fontSize: 96, color: C.beige, fontFace: "Georgia", noBalance: true, objectName: ctx.g("quote", "装饰引号") });
  const size = ctx.fit(s.text, { w, h: 2.9, max: 30, min: 20, lineSpacingMultiple: 1.35 });
  const th = Hh(s.text, { w, fontSize: size, lineSpacingMultiple: 1.35 });
  const y = Math.max(2.25, 3.9 - th / 2);
  T(slide, s.text, { x, y, w, h: th, fontSize: size, color: C.white, lineSpacingMultiple: 1.35, objectName: g });
  if (s.author) {
    hline(slide, x, y + th + 0.35, 0.5, C.beige, 1.5, g);
    T(slide, s.author, { x: x + 0.65, y: y + th + 0.18, w: w - 0.65, h: 0.34, fontSize: 13, color: C.beige, valign: "middle", noBalance: true, objectName: g });
  }
}

/* ---------------- 表格 ---------------- */
async function table(s) {
  ctx.pickLayout(s, ["grid"]);
  const slide = add(s);
  header(slide, s);
  const G = (l) => ctx.g("body", l);
  let y = lead(slide, s, 1.4, { g: "body" });
  const cH = concH(s), bottom = 7.05 - (cH ? cH + 0.2 : 0);
  const cols = s.columns.length, rows = s.rows || [], tw = R - L;
  const widths = s.columns.map((c, j) => Math.max(wid(c, { fontSize: 14, bold: true }), ...rows.map((r) => Math.min(4.2, wid(r[j] || "", { fontSize: 12 }))), 1.0) + 0.4);
  const sum = widths.reduce((a, b) => a + b, 0), cw = widths.map((v) => (v / sum) * tw);
  const rh = Math.min(0.75, (bottom - y) / (rows.length + 1));
  const data = [s.columns.map((c) => ({ text: c, options: { bold: true, color: C.white, fill: { color: C.navy }, fontSize: 14 } }))];
  rows.forEach((r, i) => data.push(s.columns.map((_, j) => ({ text: r[j] || "", options: { color: C.ink, fill: { color: i % 2 ? C.beigeL : C.white }, fontSize: 12 } }))));
  slide.addTable(data, { x: L, y, w: tw, colW: cw, rowH: rh, fontFace: F.body, valign: "middle", margin: [0, 0.12, 0, 0.12], border: { type: "solid", color: "E6E6E6", pt: 0.75 }, objectName: G("表格") });
  if (cH) conclusion(slide, s, bottom + 0.2);
}

/* ---------------- 步骤 ---------------- */
async function steps(s) {
  ctx.pickLayout(s, ["wave"]);
  const slide = add(s);
  header(slide, s);
  const G = (l) => ctx.g("body", l);
  let y = lead(slide, s, 1.35, { g: "body", align: "center", gap: 0.1 });
  const n = s.items.length, cy = Math.max(y + 1.95, 4.05), amp = 0.5;
  // 波浪线（灰色细线）
  const pts = [];
  const x0 = 0.45, x1 = R + 0.3, period = (x1 - x0) / (n + 0.5);
  for (let k = 0; k <= 120; k++) { const x = x0 + (x1 - x0) * k / 120; pts.push([x, cy + amp * Math.sin(((x - x0) / period) * 2 * Math.PI - Math.PI / 2)]); }
  const minY = cy - amp;
  slide.addShape(ctx.shapes.CUSTOM_GEOMETRY, { x: x0, y: minY, w: x1 - x0, h: 2 * amp, fill: { type: "none" }, line: { color: "D6D6D6", width: 1.5 }, objectName: G("波浪"),
    points: pts.map(([x, yy], k) => (k === 0 ? { x: x - x0, y: yy - minY, moveTo: true } : { x: x - x0, y: yy - minY })) });
  const tw = Math.min(3.2, (x1 - x0) / n - 0.1);
  s.items.forEach((it, i) => {
    const cx = x0 + period * (i + 0.75), up = i % 2 === 0, D = 0.85;
    const ccy = cy + (up ? -amp : amp) * 0.0 + (up ? -0.25 : 0.25);
    oval(slide, cx - D / 2, ccy - D / 2, D, up ? C.navy : C.beige, { name: G("圆") });
    T(slide, String(i + 1), { x: cx - D / 2, y: ccy - D / 2, w: D, h: D, fontSize: 24, color: up ? C.white : C.navy, fontFace: F.num, align: "center", valign: "middle", noBalance: true, objectName: G("编号") });
    const bh = Hh(it.body, { w: tw, fontSize: 12 });
    const ty = up ? ccy - D / 2 - 0.55 - 0.45 - bh : ccy + D / 2 + 0.55;
    vline(slide, cx, up ? ty + 0.45 + bh + 0.08 : ccy + D / 2 + 0.05, 0.4, "D6D6D6", 1, G("短线"));
    const tx = Math.max(L, Math.min(R - tw, cx - 0.6));
    T(slide, it.head, { x: tx, y: ty, w: tw, h: 0.4, fontSize: one(it.head, { w: tw, max: 17, min: 13, bold: true }), bold: true, color: C.ink, valign: "middle", noBalance: true, objectName: G("标题") });
    T(slide, it.body, { x: tx, y: ty + 0.45, w: tw, h: bh, fontSize: 12, color: C.body, objectName: G("正文") });
  });
}

async function render(deck, c) {
  ctx = c;
  ctx.pres.defineSlideMaster({ title: "NJ_WHITE", background: { color: C.white } });
  ctx.pres.defineSlideMaster({ title: "NJ_NAVY", background: { color: C.navy } });
  await ctx.renderAll({ cover, toc, section, points3, points4, compare, stats, timeline, imageText, quote, closing, table, steps });
}
module.exports = { render };
