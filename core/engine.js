/**
 * Render context (ctx): the shared capabilities a template uses while drawing. Templates only handle "how it's drawn", nothing else
 * ------------------------------------------------------------------
 * The template's build.js exports  render(deck, ctx), usually written as:
 *
 *   async function render(deck, ctx) {
 *     ctx.pres.defineSlideMaster({ title: "BASE", background: { color: "7B7584" } });
 *     await ctx.renderAll({ cover, toc, section, points3, ... });   // one function per page type
 *   }
 *   async function cover(s, ctx) {                                   // s = one page from deck.json
 *     const slide = ctx.addSlide(s, { master: "BASE", bg: "7B7584" });
 *     await ctx.pic(slide, s, 0, 0.8, 1.7, 6, 4.7, { radius: 0.78, fallback: "image1.jpeg" });
 *     slide.addText(s.title, { x: 7.3, y: 2.4, w: 5, h: 1, fontSize: 54 });
 *   }
 *
 * What ctx provides:
 *   ctx.pres                    pptxgenjs instance (LAYOUT_WIDE 13.333 × 7.5 already set)
 *   ctx.deck / ctx.meta         deck.json content / the template's meta.json
 *   ctx.addSlide(s, {master,bg}) creates a page (bg: background color, or "image" when the background is an image; used by the contrast check): records elements automatically (for QA), writes notes, records the page type (for transitions)
 *   ctx.pickLayout(s, [...])    choose a layout: use s.layout if given, otherwise rotate among the candidates (same type never repeats layout on adjacent pages)
 *   ctx.pic(slide, s, idx, x, y, w, h, opts)   place an image (AI-generated / web search / template original, handled by the engine)
 *   ctx.image(s, idx, w, h, opts) → image path (crop / rounded corners / circle / transparency already applied)
 *   ctx.prep(file, w, h, opts)  process a template asset (decorations such as leaf shadows, device mockup frames)
 *   ctx.asset(file)             absolute path of a template asset
 *   ctx.icon(name, color, def)  Feather icon → PNG data that addImage accepts (name such as "search", "pen-tool")
 *   ctx.warn(msg)               report an issue during drawing (goes into the QA report)
 *   ctx.measure(text, {w, fontSize, bold, charSpacing, lineSpacingMultiple}) → { lines, needH, orphan }
 *   ctx.fit(text, {w, h, max, min, ...}) → the largest font size that fits in the box (min if nothing fits; QA will flag it)
 *   ctx.fitLine(text, {w, max, min, ...}) → the largest font size that fits on a single line
 *   ctx.balance(text, {w, fontSize, ...}) → rebalances line breaks when the last line has only 1–2 characters (text already containing \n is left alone)
 *   ctx.g(group, label)         → objectName "M<group>|label": elements sharing a group are wrapped into one PowerPoint group
 *                                 and animated together as motion.json says. Elements without a group stay still.
 *
 * Fields the engine fills into each page (prefixed with _, templates may read them):
 *   _index (from 1)  _part ("PART 01", only on section pages)  _sectionNo  _sectionTitle  _en (section English name)
 *   _num ("01", content page's number within its section)  _layout (layout actually used)
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");
const { TRANSITION_KIND } = require("./spec");
const { measure } = require("./textfit");

let FiMod = null, React = null, RDS = null;
function fiComponent(name) {
  FiMod ||= require("react-icons/fi");
  if (!name) return null;
  const key = "Fi" + String(name).split(/[-_ ]/).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  return FiMod[key] || null;
}


/** The largest font size that fits on a single line */
function fitLine(text, { w, max = 14, min = 8, step = 0.5, ...o }) {
  for (let size = max; size >= min; size -= step) if (measure(text, { w, fontSize: size, ...o }).lines <= 1) return size;
  return min;
}
/** The largest font size that fits in the box */
function fit(text, { w, h, max = 32, min = 10, step = 1, ...o }) {
  for (let size = max; size >= min; size -= step) if (measure(text, { w, fontSize: size, ...o }).needH <= h + 1e-3) return size;
  return min;
}
/** Avoid single-character line drops: rebalance line breaks by roughly equal character count per line, preferring breaks after punctuation */
const PUNCT = /^[，。、；：！？”’）》,.;:!?)]$/;
function balance(text, o) {
  text = String(text ?? "");
  if (!text || text.includes("\n")) return text;
  const m = measure(text, o);
  if (m.lines <= 1 || !m.orphan) return text;
  const toks = text.match(/[\u2e80-\uffff]|[^\s\u2e80-\uffff]+\s*|\s+/g) || [];
  const units = (t) => [...t].reduce((a, ch) => a + (ch.charCodeAt(0) < 0x2000 ? 0.55 : 1), 0);
  const cum = []; let acc = 0;
  for (const t of toks) { acc += units(t); cum.push(acc); }
  const total = acc;
  for (const lines of [m.lines, m.lines + 1]) {
    const target = total / lines, breaks = [];
    for (let k = 1; k < lines; k++) {
      const ideal = k * target, prev = breaks.length ? breaks[breaks.length - 1] : -1;
      let best = -1, bestScore = Infinity;
      for (let i = prev + 1; i < toks.length - 1; i++) {
        if (PUNCT.test((toks[i + 1] || "").trim())) continue;            // never put punctuation at the start of a line
        const d = cum[i] - ideal;
        if (d < -3 || d > 2) continue;
        const score = Math.abs(d) - (PUNCT.test(toks[i].trim()) ? 2.5 : 0); // breaking right after punctuation scores better
        if (score < bestScore) { bestScore = score; best = i; }
      }
      if (best < 0) break;
      breaks.push(best);
    }
    if (breaks.length !== lines - 1) continue;
    const out = []; let from = 0;
    for (const b of [...breaks, toks.length - 1]) { out.push(toks.slice(from, b + 1).join("").trimEnd()); from = b + 1; }
    const res = out.join("\n");
    const m2 = measure(res, o);
    if (m2.lines <= lines && !m2.orphan) return res;
  }
  return text;
}

function createContext({ deck, meta, templateDir, cacheDir, resolver, dry, projectDir }) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.title = deck.meta?.title || "";
  if (deck.meta?.author) pres.author = deck.meta.author;
  if (meta.fonts) pres.theme = { headFontFace: meta.fonts.head, bodyFontFace: meta.fonts.body };

  const records = [];      // per page: { slide, type, bg, elements: [] }
  const kinds = [];        // per page: transition group
  const requests = {};     // image requests (collected during the dry pass)
  const frames = [];       // every image frame drawn: { page, id, idx, w, h, file? } (for assigning user photos)
  const warnings = [];
  const layoutCount = {};
  let prevSlide = null, seq = 0;
  const iconCache = new Map();

  /* ---------- Image processing (crop to the frame ratio, rounded corners / circle / transparency / mirroring) ---------- */
  async function prep(file, w, h, { radius = 0, circle = false, alpha = 1, flip = false, crop = true, gray = false, focus = null } = {}) {
    const src = path.isAbsolute(file) ? file : path.join(templateDir, "assets", file);
    if (dry) return src;
    const st = fs.statSync(src);
    const key = crypto.createHash("sha1").update([src, st.mtimeMs, w, h, radius, circle, alpha, flip, crop, gray, focus].join("|")).digest("hex").slice(0, 12);
    const m = await sharp(src).metadata();
    const rot = (m.orientation || 1) >= 5;                       // phone photos: EXIF says "rotate 90°"
    const mw = rot ? m.height : m.width, mh = rot ? m.width : m.height;
    const needMask = radius > 0 || circle || alpha < 1;
    const ext = needMask || m.format === "png" ? "png" : "jpg";
    const out = path.join(cacheDir, `${String(++seq).padStart(3, "0")}_${key}.${ext}`);
    let base = sharp(src).rotate(), bw = mw, bh = mh;          // rotate() with no argument = auto-orient by EXIF
    if (crop && Array.isArray(focus)) {                         // crop around the given center point (0~1) instead of the center
      const want = w / h, got = mw / mh;
      const cw = got > want ? Math.round(mh * want) : mw, ch = got > want ? mh : Math.round(mw / want);
      const cl = (v, a, b) => Math.max(a, Math.min(b, v));
      const left = Math.round(cl(focus[0] * mw - cw / 2, 0, mw - cw)), top = Math.round(cl(focus[1] * mh - ch / 2, 0, mh - ch));
      base = sharp(await base.jpeg({ quality: 95 }).toBuffer()).extract({ left, top, width: cw, height: ch });
      bw = cw; bh = ch;
    }
    const ppi = Math.min(bw / w, bh / h, 220);
    const W = Math.max(8, Math.round(w * ppi)), H = Math.max(8, Math.round(h * ppi));
    let img = base.resize(W, H, { fit: crop ? "cover" : "fill", position: "centre" });
    if (flip) img = img.flop();
    if (gray) img = img.grayscale();
    if (needMask) {
      const r = circle ? Math.min(W, H) / 2 : radius * ppi;
      const mask = circle
        ? `<svg width="${W}" height="${H}"><ellipse cx="${W / 2}" cy="${H / 2}" rx="${W / 2}" ry="${H / 2}" fill="#fff" fill-opacity="${alpha}"/></svg>`
        : `<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="${r}" ry="${r}" fill="#fff" fill-opacity="${alpha}"/></svg>`;
      img = img.ensureAlpha().composite([{ input: Buffer.from(mask), blend: "dest-in" }]);
    }
    if (ext === "png") await img.png().toFile(out); else await img.jpeg({ quality: 88 }).toFile(out);
    return out;
  }

  /* ---------- Images bound to deck content ---------- */
  function imageSpec(s, idx) {
    const main = s.image || {};
    const extra = (s.images || [])[idx - 1];
    const spec = idx === 0 ? main : extra || {};
    const base = spec.prompt || (idx > 0 && main.prompt ? `${main.prompt}（换一个角度：细节特写或相关的另一个场景）` : null)
      || `与「${s.title || s.text || deck.meta?.title || ""}」相关的画面`;
    return { prompt: base, query: spec.query || main.query || "", alt: spec.alt || main.alt || s.title || "", file: spec.file || null, focus: spec.focus || null };
  }
  async function image(s, idx, w, h, opts = {}) {
    const key = `${s.id}_${idx}`;
    const fb = opts.fallback ? (path.isAbsolute(opts.fallback) ? opts.fallback : path.join(templateDir, "assets", opts.fallback)) : null;
    const spec = imageSpec(s, idx);
    const frame = { page: records.length, id: s.id, type: s.type, layout: s._layout || null, idx, w: +w.toFixed(2), h: +h.toFixed(2), aspect: +(w / h).toFixed(2) };
    // the user's own photo (deck.json: image.file / images[n].file, relative to the project folder)
    if (spec.file) {
      const f = path.isAbsolute(spec.file) ? spec.file : path.join(projectDir || process.cwd(), spec.file);
      if (fs.existsSync(f)) {
        frames.push({ ...frame, file: spec.file });
        if (dry) return f;
        const m = await sharp(f).metadata(), rot = (m.orientation || 1) >= 5;
        const pa = rot ? m.height / m.width : m.width / m.height, fa = w / h;
        frame.kept = +Math.min(pa / fa, fa / pa).toFixed(2);   // share of the photo that survives cropping
        frames[frames.length - 1] = { ...frame, file: spec.file };
        return prep(f, w, h, { ...opts, focus: spec.focus || opts.focus });
      }
      if (!dry) warnings.push(`${s.id} 第 ${idx + 1} 张图：找不到照片 ${spec.file}，改用${resolver?.provider === "template" ? "模板原图" : "生成的配图"}`);
    }
    frames.push(frame);
    if (dry) {
      requests[key] = { w, h, ...imageSpec(s, idx), fallback: fb || path.join(templateDir, "assets", meta.defaultImage || "") };
      return fb || requests[key].fallback;
    }
    return prep(resolver.path(key), w, h, opts);
  }

  /* ---------- Page creation + element recording ---------- */
  const sections = new Set();
  function addSlide(s, { master, bg } = {}) {
    const sectionTitle = s._sectionTitle || deck.meta?.firstSection || "开篇";
    if (!sections.has(sectionTitle)) { sections.add(sectionTitle); pres.addSection({ title: sectionTitle }); }
    const slide = pres.addSlide({ masterName: master, sectionTitle });
    const rec = { id: s.id, type: s.type, layout: s._layout, bg: bg || null, elements: [] };
    records.push(rec);
    kinds.push(TRANSITION_KIND[s.type] || "content");
    let order = 0;
    const push = (e) => rec.elements.push({ ...e, order: order++ });
    const box = (o) => ({ x: +o.x || 0, y: +o.y || 0, w: +o.w || 0, h: +o.h || 0 });
    const _t = slide.addText.bind(slide), _i = slide.addImage.bind(slide), _s = slide.addShape.bind(slide),
      _tb = slide.addTable.bind(slide), _c = slide.addChart.bind(slide);
    slide.addText = (text, o = {}) => {
      const runs = Array.isArray(text) ? text : [{ text, options: {} }];
      const str = runs.map((r, i) => (r.text ?? "") + (r.options?.breakLine && i < runs.length - 1 ? "\n" : "")).join("");
      const r0 = runs[0]?.options || {};
      push({ kind: "text", ...box(o), text: str, fontSize: r0.fontSize || o.fontSize || 18, bold: !!(r0.bold ?? o.bold),
        charSpacing: o.charSpacing || 0, lineSpacingMultiple: o.lineSpacingMultiple || 1, paraSpaceAfter: o.paraSpaceAfter || 0,
        bullet: runs.some((r) => r.options?.bullet) || !!o.bullet, color: (r0.color || o.color || "000000").replace("#", ""),
        fill: o.fill?.color, name: o.objectName || "", valign: o.valign, rotate: o.rotate || 0 });
      return _t(text, o);
    };
    slide.addImage = (o = {}) => { push({ kind: "image", ...box(o), name: o.objectName || "" }); return _i(o); };
    slide.addShape = (shape, o = {}) => {
      const fill = o.fill && o.fill.type !== "none" ? o.fill.color : null;
      push({ kind: "shape", shape, ...box(o), fill: fill && fill.replace("#", ""), transparency: o.fill?.transparency || 0, name: o.objectName || "" });
      return _s(shape, o);
    };
    slide.addTable = (rows, o = {}) => { push({ kind: "table", ...box(o) }); return _tb(rows, o); };
    slide.addChart = (t, d, o = {}) => { push({ kind: "chart", ...box(o) }); return _c(t, d, o); };
    if (s.notes) slide.addNotes(s.notes);
    prevSlide = s;
    return slide;
  }

  function pickLayout(s, candidates) {
    candidates = candidates.filter(Boolean);
    let choice;
    if (s.layout && candidates.includes(s.layout)) choice = s.layout;
    else {
      const n = layoutCount[s.type] = (layoutCount[s.type] ?? -1) + 1;
      choice = candidates[n % candidates.length];
      const prev = records.length ? records[records.length - 1] : null; // the most recent page
      if (prev && prev.type === s.type && prev.layout === choice && candidates.length > 1) choice = candidates[(n + 1) % candidates.length];
    }
    s._layout = choice;
    return choice;
  }

  async function icon(name, color, def = "circle") {
    const Comp = fiComponent(name) || fiComponent(def) || fiComponent("circle");
    const key = Comp.name + color;
    if (iconCache.has(key)) return iconCache.get(key);
    React ||= require("react"); RDS ||= require("react-dom/server");
    const svg = RDS.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: 256 }));
    const data = "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
    iconCache.set(key, data);
    return data;
  }

  const ctx = {
    pres, deck, meta, dry, templateDir,
    shapes: pres.shapes, charts: pres.charts,
    addSlide, pickLayout, prep, image, icon,
    asset: (f) => path.join(templateDir, "assets", f),
    async pic(slide, s, idx, x, y, w, h, opts = {}) {
      const p = await image(s, idx, w, h, opts);
      slide.addImage({ path: p, x, y, w, h, altText: imageSpec(s, idx).alt, objectName: opts.name });
    },
    warn: (m) => warnings.push(m),
    g: (group, label = "") => `M${group}|${label}`,
    measure, fit, fitLine, balance,
    async renderAll(pages) {
      for (const s of deck.slides) {
        const fn = pages[s.type];
        if (!fn) throw new Error(`模板 ${meta.id} 没有实现页面类型 ${s.type}`);
        await fn(s, ctx);
        if (records.length && records[records.length - 1].id === s.id) records[records.length - 1].layout = s._layout;
      }
    },
    _records: records, _kinds: kinds, _requests: requests, _warnings: warnings, _frames: frames,
  };
  return ctx;
}

/** Engine pre-processing: numbering, section info, optional-type fallbacks */
function prepareDeck(deck, meta, PAGE_TYPES) {
  const d = JSON.parse(JSON.stringify(deck));
  let sec = 0, num = 0, secTitle = "", secEn = "";
  d.slides.forEach((s, i) => {
    s._index = i + 1;
    if (!meta.pageTypes.includes(s.type) && PAGE_TYPES[s.type]?.fallback === "timeline" && s.type === "steps") {
      s.type = "timeline";
      s.items = (s.items || []).map((it, k) => ({ time: `STEP ${String(k + 1).padStart(2, "0")}`, head: it.head, body: it.body }));
      s._fallbackFrom = "steps";
    }
    if (s.type === "section") {
      sec++; num = 0; secTitle = s.title; secEn = s.en || "";
      s._part = `PART ${String(sec).padStart(2, "0")}`;
    } else if (!["cover", "toc", "closing"].includes(s.type)) num++;
    s._sectionNo = sec; s._sectionTitle = secTitle; s._en = secEn;
    s._num = String(Math.max(sec, 1)).padStart(2, "0");
    s._seq = num;
  });
  return d;
}

module.exports = { createContext, prepareDeck, fiComponent, fit, fitLine, balance };
