/**
 * Automatic QA: based on the elements recorded during rendering, checks overflow, single-character line drops, overlap, out-of-bounds placement, font sizes that are too small, and contrast
 * Output: [{ page, id, level: "error"|"warn", kind, msg }]
 *   error = must be fixed (shorten text / change layout / switch template); warn = review in the rendered image and decide
 */
const { measure } = require("./textfit");
const W = 13.333, H = 7.5;

function lum(hex) {
  const c = String(hex || "000000").replace("#", "").padEnd(6, "0");
  const v = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function contrast(a, b) { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }
function mix(top, under, transparency) {
  const t = Math.min(100, Math.max(0, transparency)) / 100;
  const p = (h) => [0, 2, 4].map((i) => parseInt(String(h).slice(i, i + 2), 16));
  const [a, b] = [p(top), p(under)];
  return a.map((v, i) => Math.round(v * (1 - t) + b[i] * t).toString(16).padStart(2, "0")).join("");
}
const contains = (e, x, y) => x >= e.x - 1e-3 && x <= e.x + e.w + 1e-3 && y >= e.y - 1e-3 && y <= e.y + e.h + 1e-3;

function textExtent(e, m) {
  const hh = Math.min(e.h, m.needH);
  const top = e.valign === "middle" ? e.y + (e.h - hh) / 2 : e.valign === "bottom" ? e.y + e.h - hh : e.y;
  return { x: e.x, y: top, w: Math.min(e.w, m.longest + 0.02 || e.w), h: hh };
}
function inter(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

function runQA(records, { minBodyPt = 11, minPt = 9 } = {}) {
  const issues = [];
  records.forEach((rec, pi) => {
    const page = pi + 1;
    const add = (level, kind, msg) => issues.push({ page, id: rec.id, type: rec.type, layout: rec.layout, level, kind, msg });
    const texts = rec.elements.filter((e) => e.kind === "text" && e.text && e.text.trim() && !/装饰|deco/i.test(e.name)); // elements whose name contains "装饰" (decoration) are not checked
    const measured = new Map();
    for (const e of texts) {
      const m = measure(e.text, { w: e.w, fontSize: e.fontSize, bold: e.bold, charSpacing: e.charSpacing,
        lineSpacingMultiple: e.lineSpacingMultiple, paraSpaceAfter: e.paraSpaceAfter, indent: e.bullet ? 0.32 : 0 });
      measured.set(e, m);
      const snippet = e.text.replace(/\n/g, "⏎").slice(0, 24);
      // 1 Overflow
      if (!e.rotate && m.needH > e.h * 1.1 + 0.04) add("error", "overflow", `文字溢出：需要约 ${m.needH.toFixed(2)}" 高，框只有 ${e.h.toFixed(2)}"（${m.lines} 行，${e.fontSize}pt）「${snippet}」`);
      // 2 Single-character line drop
      if (m.orphan) add("warn", "orphan", `最后一行只剩「${m.orphan}」：用 \\n 手动断行或增删一两个字「${snippet}」`);
      // 3 Out of bounds / too close to the edge
      if (e.x < -0.01 || e.y < -0.01 || e.x + e.w > W + 0.01 || e.y + e.h > H + 0.01) add("error", "bounds", `文本框超出画布「${snippet}」`);
      else {
        const ext = textExtent(e, m);
        if (ext.x < 0.3 || ext.y < 0.25 || ext.x + ext.w > W - 0.3 || ext.y + ext.h > H - 0.2) add("warn", "edge", `文字离页面边缘太近「${snippet}」`);
      }
      // 4 Font size
      const len = e.text.replace(/\s/g, "").length;
      if (e.fontSize < minPt) add("error", "fontsize", `字号 ${e.fontSize}pt 太小「${snippet}」`);
      else if (e.fontSize < minBodyPt - 0.6 && len > 30 && !/来源|出处|source/i.test(e.text)) add("warn", "fontsize", `正文 ${e.fontSize}pt 小于 ${minBodyPt}pt「${snippet}」`);
      // 5 Contrast
      let bg = null, unknown = false;
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      if (e.fill) bg = e.fill;
      else {
        const under = rec.elements.filter((o) => o.order < e.order && o.kind !== "text" && contains(o, cx, cy) && (o.kind === "image" || (o.kind === "shape" && o.fill)));
        const layers = [];
        for (let k = under.length - 1; k >= 0; k--) {
          const o = under[k];
          if (o.kind === "image") { if (!/叶影|static/.test(o.name)) { unknown = !layers.length; break; } continue; }
          layers.push(o);
          if ((o.transparency || 0) < 50) break;
        }
        if (!unknown) {
          bg = rec.bg && rec.bg !== "image" ? rec.bg : null;
          if (!bg && !layers.length) unknown = true;
          for (let k = layers.length - 1; k >= 0; k--) bg = bg ? mix(layers[k].fill, bg, layers[k].transparency) : layers[k].fill;
        }
      }
      if (bg && !unknown) {
        const c = contrast(e.color, bg);
        const big = e.fontSize >= 18 || (e.bold && e.fontSize >= 14);
        if (c < 2) add("error", "contrast", `对比度 ${c.toFixed(1)} 太低（字 #${e.color} / 底 #${bg}）「${snippet}」`);
        else if (c < (big ? 2.6 : 3)) add("warn", "contrast", `对比度 ${c.toFixed(1)} 偏低（字 #${e.color} / 底 #${bg}）「${snippet}」`);
      }
    }
    // 6 Text-on-text overlap (by the estimated extent the text actually occupies)
    for (let a = 0; a < texts.length; a++) for (let b = a + 1; b < texts.length; b++) {
      const A = textExtent(texts[a], measured.get(texts[a])), B = textExtent(texts[b], measured.get(texts[b]));
      const I = inter(A, B);
      if (I > 0.2 * Math.min(A.w * A.h, B.w * B.h) && I > 0.02) {
        add("error", "overlap", `文字重叠：「${texts[a].text.slice(0, 12)}」与「${texts[b].text.slice(0, 12)}」`);
      }
    }
  });
  return issues;
}

function formatIssues(issues) {
  if (!issues.length) return "[质检] ✓ 没有发现溢出 / 掉行 / 重叠 / 对比度问题";
  const e = issues.filter((i) => i.level === "error").length;
  return `[质检] ${e} 个错误，${issues.length - e} 条提示\n` +
    issues.map((i) => `  ${i.level === "error" ? "✗" : "⚠"} 第 ${i.page} 页 ${i.id}（${i.type}${i.layout ? "/" + i.layout : ""}）${i.msg}`).join("\n");
}

module.exports = { runQA, formatIssues, contrast };
