/**
 * Render entry point: deck.json → .pptx
 * ------------------------------------------------------------------
 *   node core/render.js projects/<项目>/deck.json [选项]
 *
 * Options (all optional; when omitted, deck.json's settings are used, then the defaults):
 *   --template <id>        render with another template (switch template, content unchanged); written back to deck.json
 *   --images ai|web|template|mock   image source: AI-generated / web search (Pexels) / template originals / offline placeholders
 *   --animation original|auto|off    entrance animations: same as the source template (default) / play automatically / off
 *   --out <file>           output path (default <project>/out/<title>.pptx)
 *   --preview              after rendering, generate thumbnails for every page + an overview image (requires LibreOffice)
 *   --pdf                  also export a PDF with the same name (requires LibreOffice; or "Save as PDF" in PowerPoint)
 *   --force                render even if deck.json fails validation
 *
 * Process: validate → pass 1 collects image requests → images fetched concurrently (cached by prompt) → pass 2 draws for real
 *       → write .pptx → page transitions + entrance animations from the template's motion.json (copied from the source .pptx) → QA → report.json
 * Every template carries its own motion (templates/<id>/motion.json), so the same template always moves the same way.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PAGE_TYPES, ENGINE_VERSION } = require("./spec");
const { validateDeck } = require("./validate-deck");
const { createContext, prepareDeck } = require("./engine");
const { createImageResolver, loadDotEnv } = require("./images");
const { applyMotion, loadMotion } = require("./motion");
const { runQA, formatIssues } = require("./qa");

const ROOT = path.join(__dirname, "..");
const PROVIDER = { ai: "openai", web: "pexels", template: "template", mock: "mock", openai: "openai", pexels: "pexels" };

function loadTemplate(id) {
  const dir = path.join(ROOT, "templates", id);
  const metaFile = path.join(dir, "meta.json");
  if (!fs.existsSync(metaFile)) throw new Error(`找不到模板 ${id}（${metaFile}）`);
  const meta = JSON.parse(fs.readFileSync(metaFile, "utf8"));
  const mod = require(path.join(dir, "build.js"));
  if (typeof mod.render !== "function") throw new Error(`模板 ${id} 的 build.js 没有导出 render(deck, ctx)`);
  return { dir, meta, mod };
}
const safeName = (s) => String(s || "deck").replace(/[\\/:*?"<>|\s]+/g, "_").slice(0, 40);

async function render(deckFile, opts = {}) {
  deckFile = path.resolve(deckFile);
  const projectDir = path.dirname(deckFile);
  const deck = JSON.parse(fs.readFileSync(deckFile, "utf8"));
  deck.settings ||= {};
  if (opts.template) deck.settings.template = opts.template;
  const tid = deck.settings.template;
  if (!tid) throw new Error("deck.json 的 settings.template 没有指定模板，或用 --template 指定");
  const { dir: templateDir, meta, mod } = loadTemplate(tid);
  if (meta.engine && meta.engine.split(".")[0] !== ENGINE_VERSION.split(".")[0]) console.warn(`[render] 模板引擎版本 ${meta.engine} 与当前 ${ENGINE_VERSION} 不一致`);

  // 1. Validate
  const v = validateDeck(deck, meta, projectDir);
  v.warnings.forEach((w) => console.log("[deck] ⚠ " + w));
  if (v.errors.length) {
    v.errors.forEach((e) => console.log("[deck] ✗ " + e));
    if (!opts.force) throw new Error(`deck.json 有 ${v.errors.length} 个错误，先修正（或加 --force 强制渲染）`);
  }

  // 2. Settings
  loadDotEnv(ROOT);
  const imageSource = opts.images || deck.settings.imageSource || (process.env.IMAGE_PROVIDER === "openai" ? "ai" : process.env.IMAGE_PROVIDER) || "template";
  let animation = opts.animation || deck.settings.animation || "original";
  if (animation === "click") animation = "original";
  const prepared = prepareDeck(deck, meta, PAGE_TYPES);
  const cacheDir = path.join(projectDir, ".cache");

  // 3. Pass 1: collect image requests (dry run, no image processing)
  const dryCtx = createContext({ deck: JSON.parse(JSON.stringify(prepared)), meta, templateDir, cacheDir, dry: true, projectDir });
  await mod.render(dryCtx.deck, dryCtx);
  const requests = dryCtx._requests;

  // 4. Images
  const provider = PROVIDER[imageSource] || "template";
  const resolver = createImageResolver({
    slots: requests, assetsDir: path.join(templateDir, "assets"), outDir: path.join(projectDir, "generated"), envDir: ROOT,
    topic: deck.meta?.topic || deck.meta?.title || "", style: meta.imageStyle || undefined, provider,
  });
  if (provider !== "template") console.log(`[render] 配图 ${Object.keys(requests).length} 张，来源 ${imageSource}（已生成过的直接用缓存）`);
  await resolver.prefetch();

  // 5. Pass 2: draw for real
  fs.rmSync(cacheDir, { recursive: true, force: true });
  const ctx = createContext({ deck: prepared, meta, templateDir, cacheDir, resolver, dry: false, projectDir });
  await mod.render(prepared, ctx);
  if (ctx._records.length !== deck.slides.length) ctx.warn(`页数不一致：deck ${deck.slides.length} 页，模板画了 ${ctx._records.length} 页`);

  const outFile = path.resolve(opts.out || path.join(projectDir, "out", `${safeName(deck.meta?.title)}_${tid}.pptx`));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  await ctx.pres.writeFile({ fileName: outFile });

  // 6. Page transitions + animations: exactly as the source template (motion.json)
  const motion = loadMotion(templateDir);
  let motionPlan = null;
  if (motion) {
    const res = await applyMotion(outFile, { pages: ctx._records.map((r) => ({ type: r.type, layout: r.layout })), motion, mode: animation });
    console.log(res.summary);
    res.warnings.forEach((w) => ctx.warn(w));
    motionPlan = res.plan;
  } else ctx.warn(`模板 ${tid} 没有 motion.json：不加翻页和动画（模板入库时要从原 .pptx 抽出动效）`);

  // 7. QA + report
  const issues = runQA(ctx._records, meta.qa || {});
  ctx._warnings.forEach((w) => issues.push({ page: 0, id: "-", type: "-", level: "warn", kind: "template", msg: w }));
  // user photos cropped too hard (e.g. a portrait photo in a wide frame)
  ctx._frames.filter((f) => f.file && f.kept < 0.55).forEach((f) => issues.push({ page: f.page, id: f.id, type: f.type, level: "warn", kind: "photo",
    msg: `照片 ${f.file} 放进 ${f.aspect >= 1 ? "横" : "竖"}框（${f.aspect}）只保留了 ${Math.round(f.kept * 100)}%：换一张比例相近的照片、换版式，或用 focus 指定保留哪部分` }));
  console.log(formatIssues(issues));
  const manifest = resolver.manifest();
  const failedImages = Object.entries(manifest).filter(([, m]) => m.error).map(([k, m]) => ({ key: k, error: m.error }));
  const report = {
    file: outFile, template: tid, pages: ctx._records.length, imageSource, animation,
    motion: motionPlan,
    slides: ctx._records.map((r, i) => ({ page: i + 1, id: r.id, type: r.type, layout: r.layout || null })),
    issues, failedImages, images: manifest,
    frames: ctx._frames,   // every image frame: page / id / idx / frame ratio / user photo used (file) / share kept
    renderedAt: new Date().toISOString(),
  };
  const reportFile = outFile.replace(/\.pptx$/i, ".report.json");
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  // Write back deck.json when the template was switched (slide content is not changed)
  if (opts.template) fs.writeFileSync(deckFile, JSON.stringify(deck, null, 2));

  if (opts.pdf) {
    try { report.pdf = require("./preview").toPdf(outFile); console.log(`[render] PDF：${report.pdf}`); }
    catch (e) { console.warn("[render] PDF 跳过：" + e.message); }
  }
  if (opts.preview) {
    const { previewDeck } = require("./preview");
    report.preview = await previewDeck(outFile);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  }
  console.log(`[render] ✓ ${outFile}（${report.pages} 页）\n[render] 报告：${reportFile}`);
  return report;
}

module.exports = { render, loadTemplate, ROOT };

if (require.main === module) {
  const a = process.argv.slice(2);
  const get = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const file = a.find((x, i) => !x.startsWith("--") && !["--template", "--images", "--animation", "--out"].includes(a[i - 1]));
  if (!file) { console.error("用法：node core/render.js <deck.json> [--template id] [--images ai|web|template|mock] [--animation original|auto|off] [--out f.pptx] [--preview] [--pdf] [--force]"); process.exit(2); }
  render(file, { template: get("--template"), images: get("--images"), animation: get("--animation"), out: get("--out"), preview: a.includes("--preview"), pdf: a.includes("--pdf"), force: a.includes("--force") })
    .then((r) => process.exit(r.issues.some((i) => i.level === "error") ? 3 : 0))
    .catch((e) => { console.error("[render] ✗ " + e.message); process.exit(1); });
}
