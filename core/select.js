/**
 * Template picking: scores every template in the library on "desired style + topic" and returns the top N (spread out deliberately, e.g. one light, one dark, one colorful)
 *   node core/select.js --style 科技,简洁 --topic "AI 时代的职场变化" [--exclude a,b] [--n 3] [--json]
 *
 * Scoring:
 *   style matches meta.style +3 each; similar style (see NEIGHBORS) +1.5
 *   topic hits meta.fits keywords +2 each (at most +6); hits meta.avoid −4
 *   Diversity: after one is picked, the rest are −1.5 for the same tone, −1 for the same primary style
 * "Show another batch": put the ids already seen in --exclude; when nothing left matches the requested style, the result's exhausted = true, and similar styles are recommended instead
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const NEIGHBORS = {
  简洁: ["极简", "商务", "清新"], 极简: ["简洁", "清新"], 商务: ["简洁", "专业", "科技"], 专业: ["商务", "简洁"],
  科技: ["未来", "商务", "极简"], 未来: ["科技"], 文艺: ["杂志", "人文", "清新"], 杂志: ["文艺", "时尚"],
  国潮: ["中国风", "复古"], 中国风: ["国潮", "复古"], 复古: ["国潮", "文艺"], 清新: ["简洁", "文艺", "可爱"],
  可爱: ["清新", "活泼"], 活泼: ["可爱", "时尚"], 时尚: ["杂志", "活泼"], 学术: ["简洁", "专业"],
};

function listTemplates() {
  const dir = path.join(ROOT, "templates");
  return fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, "meta.json")))
    .map((d) => ({ dir: path.join(dir, d), ...JSON.parse(fs.readFileSync(path.join(dir, d, "meta.json"), "utf8")) }));
}

function grams(s) { const t = String(s || "").replace(/\s+/g, ""); const g = new Set(); for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2)); return g; }
function hits(topic, word) {
  if (!topic || !word) return false;
  if (topic.includes(word) || word.includes(topic)) return true;
  const a = grams(topic); for (const g of grams(word)) if (a.has(g)) return true;
  return false;
}

function select({ style = [], topic = "", exclude = [], n = 3 } = {}) {
  const all = listTemplates().filter((t) => !exclude.includes(t.id));
  const scored = all.map((t) => {
    let score = 0; const reasons = []; let exact = false;
    for (const s of style) {
      if (t.style?.includes(s)) { score += 3; exact = true; reasons.push(`风格「${s}」`); }
      else if ((NEIGHBORS[s] || []).some((x) => t.style?.includes(x))) { score += 1.5; reasons.push(`相近风格（${s}→${t.style.filter((x) => (NEIGHBORS[s] || []).includes(x)).join("/")}）`); }
    }
    const fit = (t.fits || []).filter((f) => hits(topic, f));
    if (fit.length) { score += Math.min(6, fit.length * 2); reasons.push(`适合：${fit.join("、")}`); }
    const avoid = (t.avoid || []).filter((f) => hits(topic, f));
    if (avoid.length) { score -= 4; reasons.push(`不太适合：${avoid.join("、")}`); }
    return { id: t.id, name: t.name, tone: t.tone, style: t.style, description: t.description, score, exact, reasons };
  }).sort((a, b) => b.score - a.score);

  const picked = [];
  const pool = [...scored];
  while (picked.length < n && pool.length) {
    pool.forEach((c) => {
      c.adj = c.score;
      for (const p of picked) { if (p.tone === c.tone) c.adj -= 1.5; if (p.style?.[0] === c.style?.[0]) c.adj -= 1; }
    });
    pool.sort((a, b) => b.adj - a.adj);
    picked.push(pool.shift());
  }
  const exhausted = style.length > 0 && !scored.some((c) => c.exact);
  return { picked: picked.map(({ adj, ...c }) => c), remaining: Math.max(0, scored.length - picked.length), exhausted, total: listTemplates().length };
}

module.exports = { select, listTemplates };

if (require.main === module) {
  const a = process.argv.slice(2);
  const get = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const split = (v) => (v ? v.split(/[,，、\s]+/).filter(Boolean) : []);
  const r = select({ style: split(get("--style")), topic: get("--topic") || "", exclude: split(get("--exclude")), n: Number(get("--n") || 3) });
  if (a.includes("--json")) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
  console.log(`模板库共 ${r.total} 个，本批 ${r.picked.length} 个，剩余 ${r.remaining} 个${r.exhausted ? "（没有完全匹配该风格的模板了，以下为相近风格）" : ""}`);
  r.picked.forEach((p, i) => console.log(`${"ABCDEFG"[i]}. ${p.name}（${p.id}）  得分 ${p.score}  ${p.tone}  ${p.style.join("/")}  ${p.reasons.join("；")}`));
}
