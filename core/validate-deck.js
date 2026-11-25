/**
 * Validate deck.json against the standard (core/spec.js) + the template's meta.json
 *   node core/validate-deck.js projects/xxx/deck.json [--template navy-journey]
 * Returns { errors: [], warnings: [] }; any errors mean the deck should not be rendered
 */
const fs = require("fs");
const path = require("path");
const { PAGE_TYPES, COMMON, charLen } = require("./spec");

let FI = null;
const iconNames = () => (FI ||= new Set(Object.keys(require("react-icons/fi")).map(fiToKebab)));
/** FiPenTool → pen-tool */
function fiToKebab(n) { return n.replace(/^Fi/, "").replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(); }

function validateDeck(deck, meta, baseDir = null) {
  const errors = [], warnings = [];
  const E = (where, msg) => errors.push(`${where}：${msg}`);
  const W = (where, msg) => warnings.push(`${where}：${msg}`);

  if (!deck || !Array.isArray(deck.slides) || !deck.slides.length) { E("deck", "slides 为空"); return { errors, warnings }; }
  if (!deck.meta?.title) W("deck.meta", "缺少 title（文稿标题）");
  const ids = new Set();

  const checkText = (where, v, def) => {
    if (v === undefined || v === null || v === "") { if (def.required) E(where, "必填"); return; }
    if (typeof v !== "string") return E(where, "应为文字");
    const n = charLen(v);
    if (n > def.max) E(where, `超过字数上限（${n} / ${def.max} 字）：${v}`);
  };
  /** 配图：{ prompt, query?, alt? }（生成）或 { file, focus?, alt?, prompt? }（用户自己的照片，路径相对项目文件夹） */
  const checkImage = (where, v) => {
    if (typeof v !== "object" || (!v.prompt && !v.file)) return E(where, "image 应为 { prompt, query?, alt? } 或 { file, focus?, alt? }");
    if (v.file) {
      if (baseDir && !fs.existsSync(path.isAbsolute(v.file) ? v.file : path.join(baseDir, v.file))) W(where, `找不到照片 ${v.file}，渲染时会改用生成的配图`);
      if (v.focus !== undefined && !(Array.isArray(v.focus) && v.focus.length === 2 && v.focus.every((n) => typeof n === "number" && n >= 0 && n <= 1)))
        E(where, "focus 应为 [x, y]，取值 0~1（照片中要保留的中心点，例如 [0.3, 0.4] 表示偏左上）");
    }
  };
  const checkShape = (where, v, def) => {
    if (def.t === "text") return checkText(where, v, def);
    if (def.t === "icon") { if (v && !iconNames().has(v)) W(where, `未知图标 "${v}"，将使用模板默认图标（可选值见 Feather Icons，如 search、pen-tool）`); return; }
    if (def.t === "image") {
      if (!v) { if (def.required) W(where, "缺少配图提示词，将按页面标题自动生成"); return; }
      return checkImage(where, v);
    }
    if (def.t === "group") {
      if (!v) { if (def.required) E(where, "必填"); return; }
      for (const [k, d] of Object.entries(def.of)) checkShape(`${where}.${k}`, v[k], d);
      return;
    }
    if (def.t === "list") {
      const arr = v || [];
      if (!Array.isArray(arr)) return E(where, "应为数组");
      if (!arr.length && !def.required && def.min === 0) return;
      if (!arr.length && !def.required) return;
      if (arr.length < def.min || arr.length > def.max) E(where, `条目数应为 ${def.min === def.max ? def.min : `${def.min}~${def.max}`}，现在是 ${arr.length}`);
      arr.forEach((it, i) => {
        if (def.of === "text") checkText(`${where}[${i}]`, it, { max: def.itemMax, required: true });
        else for (const [k, d] of Object.entries(def.of)) checkShape(`${where}[${i}].${k}`, it?.[k], d);
      });
      return;
    }
    if (def.t === "rows") {
      if (!Array.isArray(v) || v.length < def.min || v.length > def.max) return E(where, `行数应为 ${def.min}~${def.max}`);
      v.forEach((row, i) => (row || []).forEach((c, j) => checkText(`${where}[${i}][${j}]`, c, { max: def.cellMax, required: false })));
      return;
    }
    if (def.t === "chart") {
      if (!v) return;
      if (v.type && v.type !== "bar") W(where, `暂只支持 bar，收到 ${v.type}`);
      if (v.title) checkText(`${where}.title`, v.title, { max: 20 });
    }
  };

  deck.slides.forEach((s, i) => {
    const where = `第 ${i + 1} 页${s?.id ? `（${s.id}）` : ""}`;
    if (!s || typeof s !== "object") return E(where, "格式错误");
    if (!s.id) E(where, "缺少 id"); else if (ids.has(s.id)) E(where, `id 重复：${s.id}`); else ids.add(s.id);
    const def = PAGE_TYPES[s.type];
    if (!def) return E(where, `未知页面类型 "${s.type}"`);
    if (meta) {
      const has = meta.pageTypes?.includes(s.type);
      if (!has && !(def.fallback && meta.pageTypes?.includes(def.fallback))) E(where, `模板 ${meta.id} 不支持页面类型 ${s.type}`);
      else if (!has) W(where, `模板 ${meta.id} 没有 ${s.type}，将改用 ${def.fallback} 呈现`);
      if (s.layout && has && !(meta.layouts?.[s.type] || []).includes(s.layout)) E(where, `模板 ${meta.id} 的 ${s.type} 没有版式 "${s.layout}"（可选：${(meta.layouts?.[s.type] || []).join("、")}）`);
    }
    for (const [k, d] of Object.entries(def.slots)) checkShape(`${where} ${k}`, s[k], d);
    for (const k of ["eyebrow", "source"]) if (!def.slots[k] && s[k]) checkShape(`${where} ${k}`, s[k], COMMON[k]);
    if (s.images !== undefined) {
      if (!Array.isArray(s.images)) E(`${where} images`, "应为数组");
      else s.images.forEach((im, i) => checkImage(`${where} images[${i}]`, im));
    }
    const known = new Set([...Object.keys(def.slots), ...Object.keys(COMMON)]);
    for (const k of Object.keys(s)) if (!known.has(k) && !k.startsWith("_")) W(where, `未知字段 "${k}"（会被忽略）`);
  });
  if (deck.slides[0]?.type !== "cover") W("deck", "第一页通常应为 cover");
  if (deck.slides.at(-1)?.type !== "closing") W("deck", "最后一页通常应为 closing");
  return { errors, warnings };
}

module.exports = { validateDeck, fiToKebab };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error("用法：node core/validate-deck.js <deck.json> [--template id]"); process.exit(2); }
  const deck = JSON.parse(fs.readFileSync(file, "utf8"));
  const ti = process.argv.indexOf("--template");
  const tid = ti > 0 ? process.argv[ti + 1] : deck.settings?.template;
  const metaFile = tid && path.join(__dirname, "..", "templates", tid, "meta.json");
  const meta = metaFile && fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, "utf8")) : null;
  const { errors, warnings } = validateDeck(deck, meta, path.dirname(path.resolve(file)));
  warnings.forEach((w) => console.log("⚠ " + w));
  errors.forEach((e) => console.log("✗ " + e));
  console.log(errors.length ? `✗ ${errors.length} 个错误` : `✓ deck.json 通过（${warnings.length} 条提示）`);
  process.exit(errors.length ? 1 : 0);
}
