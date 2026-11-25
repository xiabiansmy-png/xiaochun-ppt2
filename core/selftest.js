/**
 * Template intake self-test: proves a template meets TEMPLATE_SPEC
 *   node core/selftest.js <模板id> [--fixture fixtures/test_deck.json] [--no-preview]
 *
 * Steps:
 *   1. Check meta.json (required fields, required page types, layout list)
 *   2. Build 3 test decks from the standard test copy and render each (mock images):
 *        sample   test copy as-is (layouts rotate automatically)
 *        max      every layout forced once; every text field stretched to the word limit, lists at maximum count, optional fields all filled
 *        min      every layout forced once; lists at minimum count, optional fields removed
 *   3. Automatic QA (overflow / single-character line drops / overlap / out-of-bounds / font size / contrast) + validate.py (if the pptx skill is found)
 *   4. Render the sample deck with the template's original images and generate preview/ (cover, 2 representative content pages, overview), for preview cards
 * Passing criteria: meta has no errors; none of the 3 decks has QA errors; validate.py passes. Warnings must be reviewed manually in the render images.
 * Output: projects/_selftest_<id>/ (pptx, report, preview images), templates/<id>/preview/
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { PAGE_TYPES, REQUIRED_TYPES, charLen } = require("./spec");
const { render, ROOT } = require("./render");
const { previewDeck, grid } = require("./preview");

const FILLER = "这是用于测试版式容量的示例文字内容";

function stretch(str, max) {
  str = String(str || FILLER).replace(/\n/g, "");
  let out = "", i = 0;
  const chars = [...str];
  while (true) {
    const ch = chars[i % chars.length];
    if (charLen(out + ch) > max) break;
    out += ch; i++;
    if (i > 400) break;
  }
  return out;
}

/** Fill / trim content according to the slot definition: mode = "max" | "min" */
function shape(value, def, mode) {
  if (def.t === "text") {
    if (mode === "min") return def.required ? (value || stretch(FILLER, Math.min(def.max, 4))) : undefined;
    return stretch(value, def.max);
  }
  if (def.t === "list") {
    const arr = Array.isArray(value) && value.length ? value : null;
    const n = mode === "max" ? def.max : def.min;
    if (!n) return mode === "min" ? undefined : [];
    const src = arr || [def.of === "text" ? FILLER : {}];
    return Array.from({ length: n }, (_, k) => {
      const it = src[k % src.length];
      if (def.of === "text") return mode === "max" ? stretch(it, def.itemMax) : (it || "示例");
      const o = {};
      for (const [kk, dd] of Object.entries(def.of)) {
        if (dd.t === "text") o[kk] = mode === "max" ? stretch(it?.[kk], dd.max) : (it?.[kk] || (dd.required ? stretch(FILLER, Math.min(dd.max, 4)) : undefined));
        else if (it?.[kk] !== undefined) o[kk] = it[kk];
      }
      return o;
    });
  }
  if (def.t === "group") {
    const o = {};
    for (const [k, d] of Object.entries(def.of)) { const v = shape(value?.[k], d, mode); if (v !== undefined) o[k] = v; }
    return o;
  }
  if (def.t === "rows") {
    const n = mode === "max" ? def.max : def.min;
    const src = value?.length ? value : [["示例"]];
    return Array.from({ length: n }, (_, r) => (src[r % src.length] || []).map((c) => (mode === "max" ? stretch(c, def.cellMax) : c)));
  }
  return value;
}

function buildStress(fixture, meta, mode) {
  const slides = [];
  for (const type of meta.pageTypes) {
    const def = PAGE_TYPES[type];
    const base = fixture.slides.find((s) => s.type === type);
    if (!base || !def) continue;
    for (const layout of meta.layouts?.[type] || [null]) {
      const s = { id: `${type}_${layout || "x"}`, type };
      if (layout) s.layout = layout;
      for (const [k, d] of Object.entries(def.slots)) {
        if (d.t === "image") { s[k] = base[k] || { prompt: "测试配图" }; continue; }
        if (d.t === "chart") { if (base.chart) s.chart = base.chart; continue; }
        if (d.t === "icon") continue;
        const v = shape(base[k], d, mode);
        if (v !== undefined) s[k] = v;
      }
      if (type === "stats" && mode === "max") s.items = s.items.map((it, i) => ({ ...it, value: ["1.7 亿", "9200 万", "78%", "1,234"][i % 4] }));
      if (base.images) s.images = base.images;
      if (mode === "max" && !["cover", "toc", "section", "closing"].includes(type)) s.eyebrow = stretch("02 · TAKE BACK YOUR TIME", 16);
      slides.push(s);
    }
  }
  return {
    engine: fixture.engine, meta: { ...fixture.meta, title: stretch(fixture.meta.title, 16) },
    settings: { template: meta.id, imageSource: "mock", animation: "original" }, slides,
  };
}

function checkMeta(meta, dir) {
  const errors = [], warns = [];
  for (const k of ["id", "name", "engine", "style", "fits", "tone", "palette", "pageTypes", "layouts", "description"]) if (meta[k] === undefined) errors.push(`meta.json 缺少 ${k}`);
  if (meta.id !== path.basename(dir)) errors.push(`meta.id（${meta.id}）应与文件夹名（${path.basename(dir)}）一致`);
  for (const t of REQUIRED_TYPES) if (!meta.pageTypes?.includes(t)) errors.push(`缺少必需页面类型 ${t}`);
  for (const t of meta.pageTypes || []) {
    if (!PAGE_TYPES[t]) errors.push(`未知页面类型 ${t}`);
    if (!meta.layouts?.[t]?.length) errors.push(`layouts 里没有 ${t} 的版式`);
  }
  if (!fs.existsSync(path.join(dir, "build.js"))) errors.push("缺少 build.js");
  if (!fs.existsSync(path.join(dir, "assets"))) warns.push("没有 assets/ 文件夹（模板原图兜底会失效）");
  if ((meta.description || "").length > 40) warns.push("description 建议 40 字以内（预览卡片放得下）");
  // motion.json (transitions + animations copied from the source .pptx)
  const mf = path.join(dir, "motion.json");
  if (!fs.existsSync(mf)) errors.push("缺少 motion.json（用 tools/motion_extract.py 从原 .pptx 抽出动效后写）");
  else {
    let mo = null;
    try { mo = JSON.parse(fs.readFileSync(mf, "utf8")); } catch (e) { errors.push("motion.json 不是合法 JSON：" + e.message); }
    if (mo) {
      const tks = [mo.transition, ...Object.values(mo.pageTransition || {})].filter((k) => k && k !== "none");
      for (const k of tks) if (!mo.transitions?.[k]?.xml) errors.push(`motion.json：翻页 ${k} 在 transitions 里没有 xml`);
      const fxs = new Set();
      for (const [pk, steps] of Object.entries(mo.pages || {})) for (const st of steps) {
        if (!st.g) errors.push(`motion.json pages.${pk}：有一步没写 g`);
        for (const f of [].concat(st.fx || [])) fxs.add(f);
      }
      for (const f of fxs) {
        const e = mo.effects?.[f];
        if (!e?.xml) errors.push(`motion.json：效果 ${f} 在 effects 里没有 xml`);
        else if (!e.xml.includes("{SPID}")) errors.push(`motion.json：效果 ${f} 的 xml 里没有 {SPID} 占位符`);
      }
      for (const t of meta.pageTypes || []) if (!mo.pages?.[t] && !mo.pages?.default && !Object.keys(mo.pages || {}).some((k) => k.startsWith(t + ".")))
        warns.push(`motion.json 没有 ${t} 的动画（也没有 default），这类页面不会动`);
    }
  }
  return { errors, warns };
}

function findValidator() {
  const c = [process.env.PPTX_VALIDATE, "/mnt/skills/public/pptx/scripts/office/validate.py"].filter(Boolean);
  try {
    const base = "/root/.claude/skills/synced";
    if (fs.existsSync(base)) for (const d of fs.readdirSync(base)) c.push(path.join(base, d, "pptx/scripts/office/validate.py"));
  } catch {}
  return c.find((f) => fs.existsSync(f));
}

async function selftest(id, { fixture = path.join(ROOT, "fixtures", "test_deck.json"), preview = true } = {}) {
  const dir = path.join(ROOT, "templates", id);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8"));
  const out = path.join(ROOT, "projects", `_selftest_${id}`);
  fs.mkdirSync(out, { recursive: true });
  const result = { template: id, meta: checkMeta(meta, dir), decks: {}, validate: {}, pass: false };
  result.meta.errors.forEach((e) => console.log("[meta] ✗ " + e));
  result.meta.warns.forEach((e) => console.log("[meta] ⚠ " + e));

  const fx = JSON.parse(fs.readFileSync(fixture, "utf8"));
  const sample = { ...fx, settings: { ...fx.settings, template: id, imageSource: "mock" }, slides: fx.slides.filter((s) => meta.pageTypes.includes(s.type) || PAGE_TYPES[s.type]?.fallback) };
  const decks = { sample, max: buildStress(fx, meta, "max"), min: buildStress(fx, meta, "min") };
  const validator = findValidator();
  for (const [name, deck] of Object.entries(decks)) {
    const pdir = path.join(out, name);
    fs.mkdirSync(pdir, { recursive: true });
    const file = path.join(pdir, "deck.json");
    fs.writeFileSync(file, JSON.stringify(deck, null, 2));
    console.log(`\n========== ${name}（${deck.slides.length} 页）==========`);
    const rep = await render(file, { out: path.join(pdir, `${name}.pptx`), force: name !== "sample", preview: preview && name !== "sample" });
    const errs = rep.issues.filter((i) => i.level === "error");
    result.decks[name] = { pages: rep.pages, errors: errs.length, warns: rep.issues.length - errs.length, file: rep.file, overview: rep.preview?.overview };
    if (validator) {
      try { execFileSync("python3", [validator, rep.file], { stdio: "pipe" }); result.validate[name] = "PASSED"; }
      catch (e) { result.validate[name] = "FAILED: " + String(e.stdout || e.message).slice(0, 400); }
      console.log(`[validate] ${name}: ${result.validate[name]}`);
    }
  }

  // Template preview images: render the sample deck with the template's original images
  if (preview) {
    const pdir = path.join(out, "sample");
    const rep = await render(path.join(pdir, "deck.json"), { images: "template", out: path.join(pdir, "sample_template_images.pptx"), preview: true });
    if (rep.preview?.pages?.length) {
      const pv = path.join(dir, "preview");
      fs.mkdirSync(pv, { recursive: true });
      const pages = rep.preview.pages;
      const picks = meta.preview?.samplePages || [Math.min(6, pages.length), Math.min(12, pages.length)];
      fs.copyFileSync(pages[0], path.join(pv, "cover.jpg"));
      picks.forEach((n, i) => fs.copyFileSync(pages[n - 1], path.join(pv, `sample${i + 1}.jpg`)));
      await grid(pages, path.join(pv, "overview.jpg"), { cols: 5, width: 360 });
      result.preview = pv;
      console.log(`[预览] 已更新 ${pv}（cover / sample1 / sample2 / overview）`);
    }
  }

  result.pass = !result.meta.errors.length && Object.values(result.decks).every((d) => !d.errors)
    && Object.values(result.validate).every((v) => v === "PASSED");
  fs.writeFileSync(path.join(out, "selftest.json"), JSON.stringify(result, null, 2));
  console.log("\n========== 自测结果 ==========");
  for (const [n, d] of Object.entries(result.decks)) console.log(`  ${n.padEnd(6)} ${d.pages} 页  错误 ${d.errors}  提示 ${d.warns}  ${result.validate[n] ? "validate " + result.validate[n].slice(0, 6) : ""}`);
  if (!validator) console.log("  （没找到 pptx skill 的 validate.py，跳过 XML 校验；可设 PPTX_VALIDATE=路径）");
  console.log(result.pass ? `✓ 模板 ${id} 自测通过` : `✗ 模板 ${id} 自测未通过，详见 ${out}/*/*.report.json`);
  return result;
}

module.exports = { selftest, buildStress };

if (require.main === module) {
  const a = process.argv.slice(2);
  const id = a.find((x) => !x.startsWith("--"));
  if (!id) { console.error("用法：node core/selftest.js <模板id> [--fixture f.json] [--no-preview]"); process.exit(2); }
  const fi = a.indexOf("--fixture");
  selftest(id, { fixture: fi >= 0 ? a[fi + 1] : undefined, preview: !a.includes("--no-preview") })
    .then((r) => process.exit(r.pass ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}
