/**
 * 模板：红白培训（red-training）
 * ------------------------------------------------------------------
 * 来源：网络模板「企业管理培训之 领导力培训」（30 页，1ppt.com 系）。
 * 视觉：白底 + 正红 #CA0102。内容页顶部是红色页眉条（左白底 LOGO / 白字章节名 / 白竖线 + 小标签 / 右下深灰页码块），
 * 底部一条红色通栏 + 左侧深灰小段；正文用红圆编号 + 黑色粗标题，红色实心标签块配红色大括号列要点，项目符号是红色小方块。
 * 封面 / 结尾：左侧红字大标题 + 灰白小人阵列图（右侧）；章节页：上半 01 PART + 红字标题，下半整幅横幅图。
 *
 * 动效：完全照原模板（motion.json，由 tools/motion_extract.py 从原 .pptx 抽出）：
 *   原模板 30 页全部没有入场动画，只有翻页效果，所以这里不给元素分组，页面进来即完整呈现；
 *   翻页按页面类型对应原模板用过的那几种（封面门 / 目录 comb / 章节百叶窗 / 内容页推进 / 数据页传送带 …）。
 *
 * 版式（和 meta.json → layouts 一致）：
 *   cover     hero            浅灰几何底 + 红字大标题 + 右侧小人阵列（原第 1 页）
 *   toc       cards | list    居中「目录 CONTENTS」+ 红方块编号条目 + 右侧梯子图（原第 2 页）/ 两列编号列表
 *   section   banner | split  上半编号标题 + 下半横幅照片（原第 3 页）/ 右侧整幅照片
 *   points3   columns | imageTop | list   图标圆三栏 / 三图带标签 / 左列表右照片
 *   points4   quad | columns  2×2 红标签块 / 四栏大编号
 *   compare   vs | braces     双栏红头对比 + 中间 VS / 红标签 + 大括号列表（原第 12 页）
 *   stats     numbers | bars | chart      数字卡 / 百分比进度条（原第 18 页）/ 柱状图
 *   timeline  axis | rows     横轴上下交替 / 左侧竖线列表
 *   imageText side | panel    左文右图 / 左图右白面板
 *   quote     big             淡灰几何底 + 巨型红引号
 *   closing   thanks          同封面，红字「感谢聆听」（原第 30 页）
 *   table     grid            红色表头 + 浅灰隔行
 *   steps     arrow           红色箭头带 + 编号（原第 26 页的流程感）
 */
const C = {
  red: "CA0102", redD: "9C0001", redL: "FBEEEE", ink: "1B1B1B", body: "454545",
  gray: "8C8C8C", line: "E4E4E4", track: "F4F4F4", white: "FFFFFF", dark: "3F3F3F",
};
const F = { head: "微软雅黑", body: "微软雅黑", num: "Arial" };
const W = 13.333, H = 7.5, L = 0.78, R = W - 0.78;
const FOOT = 7.22;               // 底部红条顶边
const HEAD = 0.62;               // 页眉红条高
const PHOTOS = ["photo_vision.jpg", "photo_pressure.jpg", "photo_skyline.jpg", "photo_shadow.jpg", "photo_chess.jpg", "photo_thumb.png", "photo_question.jpg", "photo_hands.jpg"];
const MASTER = "RT_WHITE";

let ctx;
/* ---------------- 排版组件 ---------------- */
function T(slide, str, o = {}) {
  if (str === undefined || str === null || str === "") return 0;
  const opt = { margin: 0, color: C.body, fontFace: F.body, fontSize: 12, valign: "top", lineSpacingMultiple: 1.2, ...o };
  const txt = o.noBalance ? String(str) : ctx.balance(String(str), { w: opt.w, fontSize: opt.fontSize, bold: opt.bold, charSpacing: opt.charSpacing, lineSpacingMultiple: opt.lineSpacingMultiple });
  delete opt.noBalance;
  slide.addText(txt, opt);
  return opt.h;
}
const Hh = (str, o = {}) => (str ? ctx.measure(String(str), { lineSpacingMultiple: 1.2, ...o }).needH + 0.04 : 0);
const one = (str, o = {}) => ctx.fitLine(String(str || ""), o);
const wid = (str, o = {}) => ctx.measure(String(str || ""), { w: 60, ...o }).longest || 0;
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
const hline = (sl, x, y, w, color = C.line, width = 0.75, name = "") => sl.addShape(ctx.shapes.LINE, { x, y, w, h: 0, line: { color, width }, objectName: name });
const vline = (sl, x, y, h, color = C.line, width = 0.75, name = "") => sl.addShape(ctx.shapes.LINE, { x, y, w: 0, h, line: { color, width }, objectName: name });
/** 红色实心标签块（白字），宽度按文字自适应，返回实际宽度 */
function tagBlock(slide, str, x, y, h, o = {}) {
  if (!str) return 0;
  const maxW = o.maxW || o.w || 3.4;
  let size = o.size || Math.min(17, h * 30);
  size = Math.min(size, one(str, { w: maxW - h * 0.55, max: size, min: 10, bold: true }));
  const w = o.w || Math.min(maxW, wid(str, { fontSize: size, bold: true }) + h * 0.9);
  rect(slide, x, y, w, h, o.fill || C.red, { name: o.name });
  T(slide, str, { x, y, w, h, fontSize: size, bold: true, color: o.color || C.white, align: "center", valign: "middle", noBalance: true, objectName: o.name });
  return w;
}
function add(s, bg = C.white) { return ctx.addSlide(s, { master: MASTER, bg }); }

/** 内容页页眉：LOGO / 红条 + 章名 / 竖线 + 小标签 / 页码 / 底部色条 */
function chrome(slide, s) {
  T(slide, "LOGO", { x: 0.38, y: 0, w: 0.9, h: HEAD, fontSize: 19, bold: true, color: C.red, fontFace: F.num, charSpacing: 1, valign: "middle", noBalance: true });
  rect(slide, 1.22, 0, 12.31 - 1.22, HEAD, C.red);
  const name = s._sectionTitle || "";
  const ns = name ? one(name, { w: 8.2, max: 20, min: 12, bold: true }) : 0;
  if (name) T(slide, name, { x: 1.42, y: 0, w: 8.2, h: HEAD, fontSize: ns, bold: true, color: C.white, valign: "middle", noBalance: true });
  const lx = 1.42 + (name ? Math.min(8.1, wid(name, { fontSize: ns, bold: true }) + 0.3) : 0.1);
  if (s.eyebrow && lx < 10.85) {
    vline(slide, lx, 0.15, HEAD - 0.3, "FFFFFF", 1);
    T(slide, s.eyebrow, { x: lx + 0.18, y: 0, w: Math.max(0.8, 10.85 - lx - 0.18), h: HEAD, fontSize: 12, color: C.white, valign: "middle", noBalance: true });
  }
  rect(slide, 12.31, 0, W - 12.31, HEAD, C.dark);
  T(slide, `- ${s._index} -`, { x: 12.31, y: 0, w: W - 12.31, h: HEAD, fontSize: 12, color: C.white, fontFace: F.num, align: "center", valign: "middle", noBalance: true });
  rect(slide, 0, FOOT, W, H - FOOT, C.red);
  rect(slide, 0, FOOT, 0.95, H - FOOT, C.dark);
}
/** 内容页标题块：红圆编号 + 黑粗标题，返回正文起点 y */
function titleBlock(slide, s, o = {}) {
  const x = o.x ?? L, y = o.y ?? 0.98, d = 0.64;
  const w = o.w ?? (R - x - d - 0.2);
  oval(slide, x, y, d, C.red);
  T(slide, String(s._seq || 1).padStart(2, "0"), { x, y, w: d, h: d, fontSize: 18, bold: true, color: C.white, fontFace: F.num, align: "center", valign: "middle", noBalance: true });
  const size = ctx.fit(s.title, { w, h: Math.max(0.72, o.maxH || 0.72), max: o.max || 26, min: 16, bold: true, lineSpacingMultiple: 1.12 });
  const th = Hh(s.title, { w, fontSize: size, bold: true, lineSpacingMultiple: 1.12 });
  T(slide, s.title, { x: x + d + 0.2, y: y - 0.03, w, h: Math.max(d, th), fontSize: size, bold: true, color: C.ink, valign: "middle", lineSpacingMultiple: 1.12 });
  return y + Math.max(d, th) + (o.gap ?? 0.3);
}
/** 引导语：红竖条 + 深灰字 */
function lead(slide, s, y, o = {}) {
  if (!s.lead) return y;
  const x = o.x ?? L, w = o.w ?? (R - x), size = o.size || 13.5;
  const h = Hh(s.lead, { w: w - 0.3, fontSize: size });
  rect(slide, x, y + 0.03, 0.06, h - 0.06, C.red, { name: o.name });
  T(slide, s.lead, { x: x + 0.22, y, w: w - 0.3, h, fontSize: size, color: C.body, objectName: o.name });
  return y + h + (o.gap ?? 0.28);
}
function concH(s, w = R - L) { return s.conclusion ? Math.max(0.56, Hh(s.conclusion, { w: w - 0.5, fontSize: 13, bold: true }) + 0.22) : 0; }
function conclusion(slide, s, y, o = {}) {
  if (!s.conclusion) return y;
  const x = o.x ?? L, w = o.w ?? (R - x);
  const h = Math.max(0.56, Hh(s.conclusion, { w: w - 0.5, fontSize: 13, bold: true }) + 0.22);
  rect(slide, x, y, w, h, C.redL);
  rect(slide, x, y, 0.07, h, C.red);
  T(slide, s.conclusion, { x: x + 0.3, y, w: w - 0.5, h, fontSize: 13, bold: true, color: C.redD, valign: "middle" });
  return y + h;
}
/** 红色小方块项目符号 + 文字，返回占用高度 */
function bullet(slide, str, x, y, w, size = 12.5, o = {}) {
  const h = Hh(str, { w: w - 0.28, fontSize: size });
  rect(slide, x, y + size / 72 * 0.42, 0.11, 0.11, o.fill || C.red);
  T(slide, str, { x: x + 0.28, y, w: w - 0.28, h, fontSize: size, color: o.color || C.body });
  return h;
}
const srcLine = (slide, s) => {
  if (!s.source) return FOOT - 0.18;
  const h = Hh(s.source, { w: R - L, fontSize: 9 });
  T(slide, `来源：${s.source}`, { x: L, y: FOOT - 0.16 - h, w: R - L, h, fontSize: 9, color: C.gray });
  return FOOT - 0.16 - h - 0.16;
};

/* ---------------- 封面 / 结尾 ---------------- */
async function coverPage(s, closing) {
  ctx.pickLayout(s, [closing ? "thanks" : "hero"]);
  const slide = ctx.addSlide(s, { master: MASTER, bg: "image" });
  slide.addImage({ path: ctx.asset("bg_white.jpg"), x: 0, y: 0, w: W, h: H });
  T(slide, "LOGO", { x: 0.55, y: 0.32, w: 1.1, h: 0.44, fontSize: 22, bold: true, color: C.red, fontFace: F.num, charSpacing: 1, valign: "middle", noBalance: true });
  await ctx.pic(slide, s, 0, 6.85, 0.55, 6.45, 4.96, { fallback: "figures.png", name: "配图" });

  const x = 0.95, bw = 5.85;
  let y = 1.12;
  if (!closing && s.tag) { T(slide, s.tag, { x, y, w: bw, h: 0.5, fontSize: 26, color: C.ink, noBalance: true }); y += 0.62; }
  const size = ctx.fit(s.title, { w: bw, h: 2.35, max: 84, min: 40, bold: true, lineSpacingMultiple: 1.06 });
  const th = Hh(s.title, { w: bw, fontSize: size, bold: true, lineSpacingMultiple: 1.06 });
  T(slide, s.title, { x, y, w: bw, h: th, fontSize: size, bold: true, color: C.red, lineSpacingMultiple: 1.06, noBalance: true });
  y += th + 0.16;
  rect(slide, x, y, 0.92, 0.05, C.red);
  y += 0.22;
  if (s.subtitle) {
    const ss = one(s.subtitle, { w: bw, max: 19, min: 13 });
    T(slide, s.subtitle, { x, y, w: bw, h: ss / 72 * 1.4, fontSize: ss, color: "6E6E6E", noBalance: true });
    y += ss / 72 * 1.4 + 0.16;
  }
  const desc = closing ? s.body : s.desc;
  if (desc) {
    const dh = Hh(desc, { w: bw - 0.2, fontSize: 13 });
    T(slide, desc, { x, y, w: bw - 0.2, h: dh, fontSize: 13, color: C.body });
    y += dh + 0.22;
  }
  const who = ctx.deck.meta?.author;
  if (who && y < 6.2) {
    oval(slide, x, y + 0.04, 0.26, C.red);
    T(slide, who, { x: x + 0.4, y, w: bw - 0.4, h: 0.34, fontSize: 12.5, color: C.dark, valign: "middle", noBalance: true });
  }
  if (closing && s.tag) T(slide, s.tag, { x: x + 0.4, y: y + 0.42, w: bw - 0.4, h: 0.3, fontSize: 12, color: C.gray, noBalance: true });
}
async function cover(s) { return coverPage(s, false); }
async function closing(s) { return coverPage(s, true); }

/* ---------------- 目录 ---------------- */
async function toc(s) {
  const n = s.items.length;
  const layout = ctx.pickLayout(s, ["cards", "list"]);
  const slide = add(s);
  // 居中标题：目录 + 红底 CONTENTS
  const t = s.title || "目录";
  const ts = one(t, { w: 3.2, max: 44, min: 30, bold: true });
  const tw = wid(t, { fontSize: ts, bold: true });
  const lw = 2.05, total = tw + 0.34 + lw, x0 = Math.max(L, (W - total) / 2);
  T(slide, t, { x: x0, y: 0.5, w: tw + 0.05, h: 0.86, fontSize: ts, bold: true, color: C.red, valign: "middle", noBalance: true });
  rect(slide, x0 + tw + 0.34, 0.64, lw, 0.56, C.red);
  T(slide, "CONTENTS", { x: x0 + tw + 0.34, y: 0.64, w: lw, h: 0.56, fontSize: 15, color: C.white, fontFace: F.num, charSpacing: 2, align: "center", valign: "middle", noBalance: true });
  if (s.desc) T(slide, s.desc, { x: L, y: 1.44, w: R - L, h: 0.32, fontSize: 12, color: C.gray, align: "center", noBalance: true });

  const top = s.desc ? 2.16 : 1.92;
  if (layout === "cards") {
    const dw = n <= 5 ? 3.7 : 2.45;
    const right = W - dw - 0.95;
    const rh = Math.min(1.02, (7.0 - top) / n);
    const size = Math.min(21, rh * 24);
    s.items.forEach((it, i) => {
      const y = top + i * rh;
      T(slide, "PART", { x: 0.95, y: y + 0.04, w: 0.78, h: 0.42, fontSize: 11, bold: true, color: C.red, fontFace: F.num, charSpacing: 0.5, valign: "middle", noBalance: true });
      rect(slide, 1.78, y + 0.04, 0.54, 0.42, C.red);
      T(slide, num2(i), { x: 1.78, y: y + 0.04, w: 0.54, h: 0.42, fontSize: 13, bold: true, color: C.white, fontFace: F.num, align: "center", valign: "middle", noBalance: true });
      T(slide, it.head, { x: 2.55, y, w: right - 2.55, h: 0.5, fontSize: size, bold: true, color: C.ink, valign: "middle", noBalance: true });
      if (it.sub) T(slide, it.sub, { x: 2.55, y: y + 0.46, w: right - 2.6, h: 0.3, fontSize: 11, color: C.gray, noBalance: true });
      if (i < n - 1) hline(slide, 0.95, y + rh - 0.08, right - 0.95, C.line, 0.75);
    });
    const imgH = dw * (862 / 985);
    slide.addImage({ path: ctx.asset("ladders.png"), x: W - dw - 0.3, y: H - imgH, w: dw, h: imgH });
  } else {
    const cols = n > 4 ? 2 : 1, rows = Math.ceil(n / cols);
    const cw = (R - L - (cols - 1) * 0.7) / cols;
    const rh = Math.min(1.5, (7.05 - top) / rows);
    s.items.forEach((it, i) => {
      const c = Math.floor(i / rows), r = i % rows;
      const x = L + c * (cw + 0.7), y = top + r * rh;
      T(slide, num2(i), { x, y: y - 0.02, w: 0.95, h: 0.62, fontSize: 32, bold: true, color: "B87878", fontFace: F.num, valign: "middle", noBalance: true });
      T(slide, it.head, { x: x + 1.05, y: y + 0.02, w: cw - 1.05, h: 0.42, fontSize: one(it.head, { w: cw - 1.1, max: 19, min: 14, bold: true }), bold: true, color: C.ink, valign: "middle", noBalance: true });
      if (it.sub) T(slide, it.sub, { x: x + 1.05, y: y + 0.46, w: cw - 1.05, h: 0.3, fontSize: 11, color: C.body, noBalance: true });
      hline(slide, x, y + rh - 0.14, cw, C.line, 0.75);
    });
  }
}

/* ---------------- 章节页 ---------------- */
async function section(s) {
  const layout = ctx.pickLayout(s, ["banner", "split"]);
  const slide = add(s);
  const part = (s._part || "PART 01").replace(/^PART\s*/, "");
  if (layout === "banner") {
    const ph = Math.max(3.0, Math.min(3.55, H - 3.95));
    await ctx.pic(slide, s, 0, 0, H - ph, W, ph, { fallback: "boxing.png", name: "横幅图" });
    T(slide, "LOGO", { x: 0.45, y: 0.26, w: 1.0, h: 0.42, fontSize: 20, bold: true, color: C.red, fontFace: F.num, charSpacing: 1, valign: "middle", noBalance: true });
    rect(slide, W - 0.72, 0, 0.72, 0.5, C.red);
    const cx = W / 2;
    // 编号 + PART
    T(slide, part, { x: cx - 1.6, y: 1.02, w: 0.95, h: 0.62, fontSize: 40, bold: true, color: C.red, fontFace: F.num, align: "right", valign: "middle", lineSpacingMultiple: 1, noBalance: true });
    T(slide, "PART", { x: cx - 0.5, y: 1.2, w: 1.0, h: 0.4, fontSize: 12, color: C.dark, fontFace: F.num, charSpacing: 2, align: "left", valign: "middle", noBalance: true });
    hline(slide, cx - 1.7, 1.75, 3.4, C.dark, 1);
    // 标题
    const tw = 9.6, ts = ctx.fit(s.title, { w: tw, h: 1.15, max: 44, min: 26, bold: true, lineSpacingMultiple: 1.1 });
    const th = Hh(s.title, { w: tw, fontSize: ts, bold: true, lineSpacingMultiple: 1.1 });
    T(slide, s.title, { x: (W - tw) / 2, y: 1.95, w: tw, h: th, fontSize: ts, bold: true, color: C.red, align: "center", lineSpacingMultiple: 1.1 });
    let y = 1.95 + th + 0.14;
    if (s.en) { T(slide, s.en.toUpperCase(), { x: cx - 4.5, y, w: 9, h: 0.3, fontSize: 11, color: C.gray, fontFace: F.num, charSpacing: 1.5, align: "center", noBalance: true }); y += 0.34; }
    if (s.desc) {
      const dh = Math.min(0.42, Hh(s.desc, { w: 8.6, fontSize: 12 }));
      T(slide, s.desc, { x: cx - 4.3, y, w: 8.6, h: dh, fontSize: 12, color: C.body, align: "center" });
      y += dh + 0.08;
    }
    if (s.keywords?.length) {
      const ws = s.keywords.map((k) => wid(k, { fontSize: 11 }) + 0.42);
      const tot = ws.reduce((a, b) => a + b, 0) + (ws.length - 1) * 0.16;
      let xx = cx - tot / 2;
      const yy = Math.min(y + 0.04, H - ph - 0.42);
      s.keywords.forEach((k, i) => {
        rect(slide, xx, yy, ws[i], 0.34, C.redL);
        T(slide, k, { x: xx, y: yy, w: ws[i], h: 0.34, fontSize: 11, color: C.redD, align: "center", valign: "middle", noBalance: true });
        xx += ws[i] + 0.16;
      });
    }
  } else {
    const pw = 4.9, ph = 4.6, px = W - pw - 0.55, py = 1.5;
    await ctx.pic(slide, s, 0, px, py, pw, ph, { fallback: "photo_shadow.jpg", name: "照片" });
    rect(slide, px, py - 0.18, 0.62, 0.09, C.red);
    rect(slide, px, py + ph + 0.14, pw, 0.09, C.red);
    T(slide, "LOGO", { x: 0.45, y: 0.3, w: 1.0, h: 0.42, fontSize: 20, bold: true, color: C.red, fontFace: F.num, charSpacing: 1, valign: "middle", noBalance: true });
    const x = 0.9, w = px - x - 0.7;
    let y = 1.35;
    rect(slide, x - 0.28, y + 0.12, 0.08, 2.6, C.red);
    T(slide, part, { x, y, w: 1.0, h: 0.62, fontSize: 40, bold: true, color: C.red, fontFace: F.num, lineSpacingMultiple: 1, noBalance: true });
    T(slide, "PART", { x: x + 1.15, y: y + 0.14, w: 1.0, h: 0.4, fontSize: 12, color: C.dark, fontFace: F.num, charSpacing: 2, valign: "middle", noBalance: true });
    y += 0.86;
    const ts = ctx.fit(s.title, { w, h: 2.2, max: 46, min: 26, bold: true, lineSpacingMultiple: 1.1 });
    const th = Hh(s.title, { w, fontSize: ts, bold: true, lineSpacingMultiple: 1.1 });
    T(slide, s.title, { x, y, w, h: th, fontSize: ts, bold: true, color: C.ink, lineSpacingMultiple: 1.1 });
    y += th + 0.16;
    hline(slide, x, y, 0.9, C.red, 2.5);
    y += 0.26;
    if (s.en) { T(slide, s.en.toUpperCase(), { x, y, w, h: 0.3, fontSize: 11, color: C.gray, fontFace: F.num, charSpacing: 1.5, noBalance: true }); y += 0.36; }
    if (s.desc) { const dh = Hh(s.desc, { w: w - 0.2, fontSize: 12 }); T(slide, s.desc, { x, y, w: w - 0.2, h: dh, fontSize: 12, color: C.body }); y += dh + 0.26; }
    if (s.keywords?.length) s.keywords.forEach((k, i) => {
      if (y + 0.34 > 6.9) return;
      rect(slide, x, y, 0.1, 0.1, C.red);
      T(slide, k, { x: x + 0.24, y: y - 0.07, w: w - 0.3, h: 0.3, fontSize: 12, color: C.dark, valign: "middle", noBalance: true });
      y += 0.38;
    });
  }
}

/* ---------------- 3 要点 ---------------- */
async function points3(s) {
  const layout = ctx.pickLayout(s, ["columns", "imageTop", "list"]);
  const slide = add(s);
  chrome(slide, s);
  let y = titleBlock(slide, s);
  const cH = concH(s), bottom = FOOT - 0.22 - (cH ? cH + 0.2 : 0);
  if (layout === "columns") {
    y = lead(slide, s, y, { gap: 0.3 });
    const gap = 0.42, cw = (R - L - 2 * gap) / 3, ch = bottom - y;
    const bodyS = 13;
    const blocks = s.items.map((it) => {
      const hs = one(it.head, { w: cw - 0.9, max: 19, min: 14, bold: true });
      return 0.72 + 0.34 + Hh(it.head, { w: cw - 0.9, fontSize: hs, bold: true }) + 0.3 + Hh(it.body, { w: cw - 0.7, fontSize: bodyS });
    });
    const cardH = Math.min(ch, Math.max(...blocks) + 1.15);
    const yt = y + (ch - cardH) / 2;
    s.items.forEach((it, i) => {
      const x = L + i * (cw + gap);
      const hs = one(it.head, { w: cw - 0.9, max: 19, min: 14, bold: true });
      const hh = Hh(it.head, { w: cw - 0.9, fontSize: hs, bold: true });
      const bh = Hh(it.body, { w: cw - 0.7, fontSize: bodyS });
      const block = blocks[i];
      const yy = yt + Math.max(0.34, (cardH - block) / 2);
      rect(slide, x, yt, cw, cardH, C.track);
      rect(slide, x, yt, cw, 0.07, C.red);
      oval(slide, x + 0.34, yy, 0.72, C.red);
      T(slide, String(i + 1), { x: x + 0.34, y: yy, w: 0.72, h: 0.72, fontSize: 21, bold: true, color: C.white, fontFace: F.num, align: "center", valign: "middle", noBalance: true });
      T(slide, it.head, { x: x + 0.34, y: yy + 1.06, w: cw - 0.9, h: hh, fontSize: hs, bold: true, color: C.ink, valign: "middle", noBalance: true });
      hline(slide, x + 0.34, yy + 1.06 + hh + 0.16, 0.62, C.red, 2.5);
      T(slide, it.body, { x: x + 0.34, y: yy + 1.06 + hh + 0.3, w: cw - 0.7, h: bh, fontSize: bodyS, color: C.body });
    });
  } else if (layout === "imageTop") {
    y = lead(slide, s, y, { gap: 0.22 });
    const gap = 0.32, cw = (R - L - 2 * gap) / 3;
    const bodyH = Math.max(...s.items.map((it) => Hh(it.body, { w: cw, fontSize: 12 })));
    const ph = Math.max(1.8, Math.min(3.15, bottom - y - 0.72 - bodyH - 0.1));
    for (let i = 0; i < 3; i++) {
      const x = L + i * (cw + gap), it = s.items[i];
      await ctx.pic(slide, s, i, x, y, cw, ph, { fallback: PHOTOS[i], name: "照片" });
      const x2 = tagBlock(slide, it.head, x + 0.18, y + ph - 0.62, 0.46, { maxW: cw - 0.36, size: 15 });
      T(slide, it.body, { x, y: y + ph + 0.16, w: cw, h: bodyH, fontSize: 12, color: C.body });
    }
  } else {
    const pw = 4.5, tw = R - L - pw - 0.55;
    await ctx.pic(slide, s, 0, R - pw, y - 0.1, pw, Math.min(4.9, bottom - y + 0.1), { fallback: PHOTOS[1], name: "照片" });
    const rh = Math.min(1.55, (bottom - y) / 3);
    s.items.forEach((it, i) => {
      const yy = y + i * rh;
      T(slide, num2(i), { x: L, y: yy, w: 0.7, h: 0.5, fontSize: 26, bold: true, color: "B87878", fontFace: F.num, valign: "middle", noBalance: true });
      T(slide, it.head, { x: L + 0.78, y: yy, w: tw - 0.78, h: 0.42, fontSize: one(it.head, { w: tw - 0.8, max: 18, min: 14, bold: true }), bold: true, color: C.ink, valign: "middle", noBalance: true });
      T(slide, it.body, { x: L + 0.78, y: yy + 0.44, w: tw - 0.8, h: rh - 0.5, fontSize: 12, color: C.body });
      if (i < 2) hline(slide, L, yy + rh - 0.14, tw, C.line, 0.75);
    });
  }
  if (cH) conclusion(slide, s, bottom + 0.2);
}

/* ---------------- 4 要点 ---------------- */
async function points4(s) {
  const layout = ctx.pickLayout(s, ["quad", "columns"]);
  const slide = add(s);
  chrome(slide, s);
  let y = titleBlock(slide, s);
  const cH = concH(s), bottom = FOOT - 0.22 - (cH ? cH + 0.2 : 0);
  if (layout === "quad") {
    y = lead(slide, s, y, { gap: 0.26 });
    const gap = 0.5, cw = (R - L - gap) / 2, rh = (bottom - y - 0.3) / 2;
    s.items.forEach((it, i) => {
      const x = L + (i % 2) * (cw + gap), yy = y + Math.floor(i / 2) * (rh + 0.3);
      tagBlock(slide, it.head, x + 0.68, yy + rh / 2 - 0.28, 0.56, { w: 1.85, size: 15 });
      T(slide, num2(i), { x, y: yy + rh / 2 - 0.28, w: 0.55, h: 0.56, fontSize: 15, bold: true, color: "B87878", fontFace: F.num, align: "right", valign: "middle", noBalance: true });
      T(slide, it.body, { x: x + 2.75, y: yy + 0.06, w: cw - 2.75, h: rh - 0.12, fontSize: 13, color: C.body, valign: "middle" });
      hline(slide, x, yy + rh, cw, C.line, 0.75);
    });
  } else {
    y = lead(slide, s, y, { gap: 0.26 });
    const gap = 0.34, cw = (R - L - 3 * gap) / 4;
    const bodyH = Math.max(...s.items.map((it) => Hh(it.body, { w: cw, fontSize: 12 })));
    const block = 0.68 + 0.5 + bodyH + 0.1;
    const yt = y + Math.max(0.1, (bottom - y - block) / 2);
    s.items.forEach((it, i) => {
      const x = L + i * (cw + gap);
      T(slide, num2(i), { x, y: yt, w: cw, h: 0.62, fontSize: 34, bold: true, color: C.red, fontFace: F.num, lineSpacingMultiple: 1, noBalance: true });
      rect(slide, x, yt + 0.68, 0.55, 0.05, C.red);
      T(slide, it.head, { x, y: yt + 0.82, w: cw, h: 0.5, fontSize: one(it.head, { w: cw, max: 17, min: 13, bold: true }), bold: true, color: C.ink, valign: "middle", noBalance: true });
      T(slide, it.body, { x, y: yt + 1.42, w: cw, h: bodyH, fontSize: 12, color: C.body });
    });
  }
  if (cH) conclusion(slide, s, bottom + 0.2);
}

/* ---------------- 对比 ---------------- */
async function compare(s) {
  const layout = ctx.pickLayout(s, ["vs", "braces"]);
  const slide = add(s);
  chrome(slide, s);
  let y = titleBlock(slide, s);
  const cH = concH(s), bottom = FOOT - 0.22 - (cH ? cH + 0.2 : 0);
  if (layout === "vs") {
    y = lead(slide, s, y, { gap: 0.26 });
    const gap = 1.1, cw = (R - L - gap) / 2;
    [[s.left, L], [s.right, L + cw + gap]].forEach(([side, x], k) => {
      if (!side) return;
      rect(slide, x, y, cw, 0.62, C.red);
      T(slide, side.head, { x, y, w: cw, h: 0.62, fontSize: one(side.head, { w: cw - 0.4, max: 19, min: 14, bold: true }), bold: true, color: C.white, align: "center", valign: "middle", noBalance: true });
      const its = side.items || [];
      const rh = Math.min(1.15, (bottom - y - 0.86) / Math.max(1, its.length));
      const size = Math.min(13.5, Math.max(11.5, rh * 19));
      its.forEach((t, i) => {
        const yy = y + 0.86 + i * rh;
        T(slide, t, { x: x + 0.1, y: yy + (rh - 0.3) / 2, w: cw - 0.15, h: Math.min(0.7, Hh(t, { w: cw - 0.2, fontSize: size }) + 0.06), fontSize: size, color: C.body, valign: "top" });
        if (i < its.length - 1) hline(slide, x, yy + rh - 0.1, cw, C.line, 0.5);
      });
    });
    oval(slide, W / 2 - 0.45, y + 0.06, 0.9, C.white, { line: C.red, lw: 2.5 });
    T(slide, "VS", { x: W / 2 - 0.45, y: y + 0.06, w: 0.9, h: 0.9, fontSize: 15, bold: true, color: C.red, fontFace: F.num, align: "center", valign: "middle", noBalance: true });
  } else {
    y = lead(slide, s, y, { gap: 0.2 });
    const rowH = (bottom - y - 0.3) / 2;
    [s.left, s.right].forEach((side, k) => {
      if (!side) return;
      const yy = y + k * (rowH + 0.3), its = side.items || [];
      tagBlock(slide, side.head, L, yy + 0.16, 0.5, { w: 1.85, size: 16 });
      box(slide, "LEFT_BRACE", L + 2.0, yy + 0.02, 0.24, Math.min(rowH - 0.16, 2.3), null, { line: C.red, lw: 2.25 });
      const tx = L + 2.42, rh = Math.min(0.66, (rowH - 0.1) / Math.max(1, its.length));
      its.forEach((t, i) => T(slide, t, { x: tx, y: yy + 0.06 + i * rh, w: R - tx, h: rh - 0.06, fontSize: 12.5, color: C.body }));
    });
  }
  if (cH) conclusion(slide, s, bottom + 0.2);
}

/* ---------------- 数据 ---------------- */
function parseNum(v) { const m = String(v).replace(/,/g, "").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; }
function unitOf(v) { const s = String(v); if (/%/.test(s)) return "%"; if (/亿/.test(s)) return "亿"; if (/万/.test(s)) return "万"; if (/元/.test(s)) return "元"; return ""; }
async function stats(s) {
  const vals = s.items.map((it) => parseNum(it.value));
  const units = s.items.map((it) => unitOf(it.value));
  const allPct = units.every((u) => u === "%") && vals.every((v) => v !== null && v >= 0 && v <= 100);
  const layout = ctx.pickLayout(s, [allPct ? "bars" : null, s.chart?.values ? "chart" : null, "numbers"]);
  const slide = add(s);
  chrome(slide, s);
  let y = titleBlock(slide, s);
  const bottom = srcLine(slide, s);
  if (layout === "bars") {
    const pw = 3.5, ph = Math.min(4.3, bottom - y);
    await ctx.pic(slide, s, 0, L, y, pw, ph, { fallback: PHOTOS[0], name: "照片" });
    const x = L + pw + 0.7, w = R - x;
    let yy = lead(slide, s, y, { x, w, gap: 0.3 });
    const n = s.items.length, rh = Math.min(1.15, (bottom - yy) / n);
    s.items.forEach((it, i) => {
      const ry = yy + i * rh;
      T(slide, it.label, { x, y: ry, w: w - 1.4, h: 0.34, fontSize: 13, bold: true, color: C.ink, valign: "middle", noBalance: true });
      rect(slide, x, ry + 0.44, w - 1.4, 0.16, C.track);
      rect(slide, x, ry + 0.44, Math.max(0.06, (w - 1.4) * vals[i] / 100), 0.16, C.red);
      T(slide, it.value, { x: R - 1.25, y: ry + 0.16, w: 1.25, h: 0.52, fontSize: 22, bold: true, color: C.red, fontFace: F.num, align: "right", valign: "middle", noBalance: true });
    });
  } else if (layout === "chart") {
    let yy = lead(slide, s, y, { gap: 0.2 });
    const lw = 4.15, n = s.items.length, rh = (bottom - yy) / n;
    s.items.forEach((it, i) => {
      const ry = yy + i * rh;
      rect(slide, L, ry + 0.08, 0.06, rh - 0.26, C.red);
      T(slide, it.value, { x: L + 0.24, y: ry, w: lw - 0.3, h: Math.min(0.72, rh * 0.56), fontSize: Math.min(30, one(it.value, { w: lw - 0.3, max: 30, min: 19, bold: true })), bold: true, color: C.red, fontFace: F.num, valign: "middle", noBalance: true });
      T(slide, it.label, { x: L + 0.24, y: ry + Math.min(0.72, rh * 0.56), w: lw - 0.3, h: 0.3, fontSize: 11.5, color: C.body, noBalance: true });
    });
    const cx = L + lw + 0.5, cw = R - cx;
    const ch = s.chart || {};
    const labels = ch.labels || s.items.map((it) => it.label);
    const values = ch.values || vals;
    let cy = yy;
    if (ch.title) { T(slide, ch.title, { x: cx, y: cy, w: cw, h: 0.32, fontSize: 13, color: C.ink, noBalance: true }); hline(slide, cx, cy + 0.38, cw, C.line, 0.75); cy += 0.5; }
    slide.addChart(ctx.charts.BAR, [{ name: ch.title || "数据", labels, values }], {
      x: cx, y: cy, w: cw, h: Math.max(1.6, bottom - cy), barDir: "col", chartColors: [C.red], barGapWidthPct: 70,
      catAxisLabelColor: C.body, valAxisLabelColor: C.gray, catAxisLabelFontSize: 10, valAxisLabelFontSize: 9, catAxisLabelFontFace: F.body,
      valGridLine: { color: "EDEDED", size: 0.5 }, catAxisLineShow: false, valAxisLineShow: false,
      showValue: true, dataLabelColor: C.ink, dataLabelFontSize: 10, dataLabelFormatCode: ch.unit === "%" ? '0"%"' : "General", showLegend: false,
    });
  } else {
    let yy = lead(slide, s, y, { gap: 0.4 });
    const n = s.items.length, gap = 0.32, cw = (R - L - (n - 1) * gap) / n, chh = Math.min(4.0, bottom - yy);
    s.items.forEach((it, i) => {
      const x = L + i * (cw + gap);
      rect(slide, x, yy, cw, chh, i % 2 ? C.track : "FAF7F7");
      rect(slide, x, yy, cw, 0.09, C.red);
      const vH = Math.min(1.15, chh * 0.32);
      T(slide, it.value, { x: x + 0.18, y: yy + chh * 0.16, w: cw - 0.36, h: vH, fontSize: one(it.value, { w: cw - 0.36, max: 44, min: 22, bold: true }), bold: true, color: C.red, fontFace: F.num, align: "center", valign: "middle", noBalance: true });
      hline(slide, x + cw / 2 - 0.3, yy + chh * 0.16 + vH + 0.16, 0.6, C.line, 1.5);
      T(slide, it.label, { x: x + 0.18, y: yy + chh * 0.16 + vH + 0.34, w: cw - 0.36, h: chh * 0.36, fontSize: 13, color: C.body, align: "center" });
    });
  }
}

/* ---------------- 时间线 ---------------- */
async function timeline(s) {
  const n = s.items.length;
  const layout = ctx.pickLayout(s, ["axis", "rows"]);
  const slide = add(s);
  chrome(slide, s);
  let y = titleBlock(slide, s);
  const cH = concH(s), bottom = FOOT - 0.22 - (cH ? cH + 0.2 : 0);
  if (layout === "axis") {
    y = lead(slide, s, y, { gap: 0.2 });
    const colW = (R - L) / n, axisY = y + (bottom - y) * 0.52;
    const bodyH = Math.max(...s.items.map((it) => (it.body ? Hh(it.body, { w: colW - 0.45, fontSize: 11.5 }) : 0)));
    hline(slide, L, axisY, R - L, C.line, 1.5);
    hline(slide, L, axisY, R - L, C.red, 0.75);
    s.items.forEach((it, i) => {
      const cx = L + colW * (i + 0.5), up = i % 2 === 0;
      oval(slide, cx - 0.13, axisY - 0.13, 0.26, C.red);
      oval(slide, cx - 0.05, axisY - 0.05, 0.1, C.white);
      const tw = colW - 0.4;
      if (up) {
        T(slide, it.time, { x: cx - tw / 2, y: axisY - 0.62, w: tw, h: 0.34, fontSize: one(it.time, { w: tw, max: 15, min: 11, bold: true }), bold: true, color: C.red, fontFace: F.num, align: "center", valign: "middle", noBalance: true });
        T(slide, it.head, { x: cx - tw / 2, y: axisY - 0.62 - 0.42 - bodyH - 0.4, w: tw, h: 0.4, fontSize: one(it.head, { w: tw, max: 16, min: 12, bold: true }), bold: true, color: C.ink, align: "center", valign: "middle", noBalance: true });
        if (it.body) T(slide, it.body, { x: cx - tw / 2, y: axisY - 0.62 - bodyH - 0.34, w: tw, h: bodyH, fontSize: 11.5, color: C.body, align: "center" });
      } else {
        T(slide, it.time, { x: cx - tw / 2, y: axisY + 0.28, w: tw, h: 0.34, fontSize: one(it.time, { w: tw, max: 15, min: 11, bold: true }), bold: true, color: C.red, fontFace: F.num, align: "center", valign: "middle", noBalance: true });
        T(slide, it.head, { x: cx - tw / 2, y: axisY + 0.66, w: tw, h: 0.4, fontSize: one(it.head, { w: tw, max: 16, min: 12, bold: true }), bold: true, color: C.ink, align: "center", valign: "middle", noBalance: true });
        if (it.body) T(slide, it.body, { x: cx - tw / 2, y: axisY + 1.08, w: tw, h: bodyH, fontSize: 11.5, color: C.body, align: "center" });
      }
    });
  } else {
    const axisX = L + 1.55, rh = Math.min(1.3, (bottom - y) / n);
    const y0 = y + ((bottom - y) - rh * n) / 2;
    vline(slide, axisX, y0 + 0.08, rh * n - 0.2, C.line, 1.5);
    s.items.forEach((it, i) => {
      const yy = y0 + i * rh;
      T(slide, it.time, { x: L, y: yy + 0.02, w: 1.32, h: 0.36, fontSize: one(it.time, { w: 1.32, max: 14, min: 11, bold: true }), bold: true, color: C.red, fontFace: F.num, align: "right", valign: "middle", noBalance: true });
      oval(slide, axisX - 0.1, yy + 0.1, 0.2, C.white, { line: C.red, lw: 2 });
      T(slide, it.head, { x: axisX + 0.32, y: yy, w: R - axisX - 0.32, h: 0.38, fontSize: one(it.head, { w: R - axisX - 0.4, max: 17, min: 13, bold: true }), bold: true, color: C.ink, valign: "middle", noBalance: true });
      if (it.body) T(slide, it.body, { x: axisX + 0.32, y: yy + 0.4, w: R - axisX - 0.32, h: rh - 0.48, fontSize: 12, color: C.body });
      if (i < n - 1) hline(slide, L, yy + rh - 0.1, R - L, C.line, 0.75);
    });
  }
  if (cH) conclusion(slide, s, bottom + 0.2);
}

/* ---------------- 图文 ---------------- */
async function imageText(s) {
  const layout = ctx.pickLayout(s, ["side", "panel"]);
  const slide = add(s);
  chrome(slide, s);
  if (layout === "side") {
    const pw = 5.9;
    await ctx.pic(slide, s, 0, W - pw, HEAD, pw, FOOT - HEAD, { fallback: PHOTOS[2], name: "照片" });
    rect(slide, W - pw - 0.05, HEAD, 0.05, FOOT - HEAD, C.red);
    const w = W - pw - 1.5;
    let y = titleBlock(slide, s, { w: w - 0.84, maxH: 0.95 });
    const bodyS = ctx.fit(s.body, { w, h: 2.3, max: 14, min: 11 });
    const bh = Hh(s.body, { w, fontSize: bodyS });
    T(slide, s.body, { x: L, y, w, h: bh, fontSize: bodyS, color: C.body });
    y += bh + 0.34;
    if (s.points?.length) {
      hline(slide, L, y - 0.18, w, C.line, 0.75);
      s.points.forEach((p, i) => { const h = bullet(slide, p, L, y, w, 12.5); y += h + 0.14; });
    }
    if (s.conclusion) conclusion(slide, s, Math.min(y + 0.16, FOOT - 0.1 - concH(s, w)), { w });
  } else {
    const pw = 7.0;
    await ctx.pic(slide, s, 0, 0, HEAD, pw, FOOT - HEAD, { fallback: PHOTOS[3], name: "照片" });
    rect(slide, pw, HEAD, W - pw, FOOT - HEAD, C.white);
    rect(slide, pw, HEAD, W - pw, 0.1, C.red);
    const x = pw + 0.55, w = W - pw - 1.05;
    T(slide, String(s._sectionTitle || "培训要点"), { x, y: HEAD + 0.42, w, h: 0.3, fontSize: 11, bold: true, color: C.red, charSpacing: 1, noBalance: true });
    const ts = ctx.fit(s.title, { w, h: 1.35, max: 30, min: 20, bold: true, lineSpacingMultiple: 1.15 });
    const th = Hh(s.title, { w, fontSize: ts, bold: true, lineSpacingMultiple: 1.15 });
    T(slide, s.title, { x, y: HEAD + 0.78, w, h: th, fontSize: ts, bold: true, color: C.ink, lineSpacingMultiple: 1.15 });
    let y = HEAD + 0.78 + th + 0.24;
    rect(slide, x, y, 0.8, 0.05, C.red);
    y += 0.24;
    const bodyS = ctx.fit(s.body, { w, h: 1.9, max: 13.5, min: 11 });
    const bh = Hh(s.body, { w, fontSize: bodyS });
    T(slide, s.body, { x, y, w, h: bh, fontSize: bodyS, color: C.body });
    y += bh + 0.24;
    if (s.points?.length) s.points.forEach((p) => { if (y > FOOT - 0.6) return; const h = bullet(slide, p, x, y, w, 12); y += h + 0.12; });
    if (s.conclusion) {
      const cy = FOOT - 0.16 - concH(s, w);
      conclusion(slide, s, Math.max(y + 0.1, cy), { x, w });
    }
  }
}

/* ---------------- 金句 ---------------- */
async function quote(s) {
  ctx.pickLayout(s, ["big"]);
  const slide = ctx.addSlide(s, { master: MASTER, bg: "image" });
  slide.addImage({ path: ctx.asset("bg_white.jpg"), x: 0, y: 0, w: W, h: H });
  T(slide, "LOGO", { x: 0.55, y: 0.32, w: 1.1, h: 0.44, fontSize: 20, bold: true, color: C.red, fontFace: F.num, charSpacing: 1, valign: "middle", noBalance: true });
  T(slide, "“", { x: 1.05, y: 0.95, w: 2.6, h: 2.2, fontSize: 190, bold: true, color: "F2D2D2", fontFace: "Georgia", lineSpacingMultiple: 1, noBalance: true, objectName: "装饰引号" });
  rect(slide, 1.95, 2.32, 0.09, 2.5, C.red);
  vline(slide, W - 1.15, 1.7, 3.3, C.red, 3);
  const x = 2.35, w = 9.3;
  const size = ctx.fit(s.text, { w, h: 3.0, max: 30, min: 18, lineSpacingMultiple: 1.45 });
  const th = Hh(s.text, { w, fontSize: size, lineSpacingMultiple: 1.45 });
  const y = Math.max(2.0, 3.3 - th / 2);
  T(slide, s.text, { x, y, w, h: th, fontSize: size, color: C.ink, lineSpacingMultiple: 1.45 });
  if (s.author) {
    hline(slide, x, y + th + 0.34, 0.52, C.red, 2.5);
    T(slide, s.author, { x: x + 0.68, y: y + th + 0.16, w: w - 0.68, h: 0.36, fontSize: 13, color: C.dark, valign: "middle", noBalance: true });
  }
  rect(slide, 0, FOOT, W, H - FOOT, C.red);
  rect(slide, 0, FOOT, 0.95, H - FOOT, C.dark);
}

/* ---------------- 表格 ---------------- */
async function table(s) {
  ctx.pickLayout(s, ["grid"]);
  const slide = add(s);
  chrome(slide, s);
  let y = titleBlock(slide, s);
  const cH = concH(s), bottom = FOOT - 0.22 - (cH ? cH + 0.2 : 0);
  y = lead(slide, s, y, { gap: 0.24 });
  const rows = s.rows || [], cols = s.columns, tw = R - L;
  const widths = cols.map((c, j) => Math.max(wid(c, { fontSize: 13.5, bold: true }), ...rows.map((r) => Math.min(4.2, wid(r[j] || "", { fontSize: 11.5 }))), 1.0) + 0.45);
  const sum = widths.reduce((a, b) => a + b, 0), cw = widths.map((v) => (v / sum) * tw);
  const rh = Math.min(0.72, (bottom - y) / (rows.length + 1));
  const data = [cols.map((c) => ({ text: c, options: { bold: true, color: C.white, fill: { color: C.red }, fontSize: 13.5, align: "center" } }))];
  rows.forEach((r, i) => data.push(cols.map((_, j) => ({ text: r[j] || "", options: { color: C.body, fill: { color: i % 2 ? C.track : C.white }, fontSize: 11.5 } }))));
  slide.addTable(data, { x: L, y, w: tw, colW: cw, rowH: rh, fontFace: F.body, valign: "middle", margin: [0, 0.14, 0, 0.14], border: { type: "solid", color: "E0E0E0", pt: 0.75 } });
  if (cH) conclusion(slide, s, bottom + 0.2);
}

/* ---------------- 步骤 ---------------- */
async function steps(s) {
  ctx.pickLayout(s, ["arrow"]);
  const slide = add(s);
  chrome(slide, s);
  let y = titleBlock(slide, s);
  const cH = concH(s), bottom = FOOT - 0.22 - (cH ? cH + 0.2 : 0);
  y = lead(slide, s, y, { gap: 0.34 });
  const n = s.items.length, gap = 0.3, cw = (R - L - (n - 1) * gap) / n;
  const bodyH = Math.max(...s.items.map((it) => Hh(it.body, { w: cw - 0.12, fontSize: 13 })));
  const ah = 1.02;
  const block = ah + 0.4 + 0.5 + 0.2 + Math.min(bodyH, 2.0);
  const bandY = y + Math.max(0.26, (bottom - y - block) / 2);
  s.items.forEach((it, i) => {
    const x = L + i * (cw + gap);
    box(slide, "CHEVRON", x, bandY, cw, ah, i % 2 ? C.redD : C.red);
    T(slide, num2(i), { x: x + 0.3, y: bandY, w: cw - 0.6, h: ah, fontSize: 28, bold: true, color: C.white, fontFace: F.num, align: "center", valign: "middle", noBalance: true });
    const hy = bandY + ah + 0.4;
    T(slide, it.head, { x, y: hy, w: cw - 0.06, h: 0.46, fontSize: one(it.head, { w: cw - 0.1, max: 18, min: 13, bold: true }), bold: true, color: C.ink, valign: "middle", noBalance: true });
    rect(slide, x, hy + 0.52, 0.5, 0.04, C.red);
    T(slide, it.body, { x, y: hy + 0.68, w: cw - 0.06, h: Math.min(bodyH, bottom - hy - 0.68), fontSize: 13, color: C.body });
  });
  if (cH) conclusion(slide, s, bottom + 0.2);
}

/* ---------------- 入口 ---------------- */
async function render(deck, c) {
  ctx = c;
  ctx.pres.defineSlideMaster({ title: MASTER, background: { color: C.white } });
  await ctx.renderAll({ cover, toc, section, points3, points4, compare, stats, timeline, imageText, quote, closing, table, steps });
}
module.exports = { render };
