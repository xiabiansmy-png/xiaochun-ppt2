/**
 * Template preview cards: one card per template, tiled side by side into a single image, for the user to choose from (A / B / C)
 *   node core/card.js --ids navy-journey,a,b --title "用户的标题" [--subtitle "副标题"] [--out cards.jpg]
 *
 * Card contents:
 *   cover thumbnail (rendered live with the user's own title; template original images, no AI images, takes 10–20 s)
 *   + 2 representative content-page thumbnails (preview/sample1.jpg, sample2.jpg, pre-rendered at intake)
 *   + name, one-line description, palette, basic info (style / light-dark / page-type count / image-heavy or not)
 * Without LibreOffice, the cover falls back to preview/cover.jpg (sample title), and the card notes that.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const sharp = require("sharp");
const { render, ROOT } = require("./render");
const { rasterize } = require("./preview");

const CW = 900, PAD = 30;
const FONT = "Noto Sans CJK SC, Source Han Sans SC, Microsoft YaHei, PingFang SC, sans-serif";
const esc = (s) => String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
function wrap(s, n) { const out = []; let cur = ""; for (const ch of String(s || "")) { cur += ch; if (cur.length >= n) { out.push(cur); cur = ""; } } if (cur) out.push(cur); return out; }

async function liveCover(meta, title, subtitle, tmp) {
  const pdir = path.join(tmp, meta.id);
  fs.mkdirSync(pdir, { recursive: true });
  const deck = {
    engine: "1.0", meta: { title },
    settings: { template: meta.id, imageSource: "template", animation: "off" },
    slides: [{ id: "c1", type: "cover", title, ...(subtitle ? { subtitle } : {}) }],
  };
  fs.writeFileSync(path.join(pdir, "deck.json"), JSON.stringify(deck));
  const log = console.log; console.log = () => {};
  try {
    const rep = await render(path.join(pdir, "deck.json"), { out: path.join(pdir, "cover.pptx"), force: true });
    const [img] = rasterize(rep.file, path.join(pdir, "img"), { dpi: 90 });
    return img;
  } finally { console.log = log; }
}

async function makeCard(meta, coverFile, label, note) {
  const dir = path.join(ROOT, "templates", meta.id);
  const coverH = Math.round(CW * 7.5 / 13.333);
  const sw = (CW - 20) / 2, sh = Math.round(sw * 7.5 / 13.333);
  const samples = (meta.preview?.samples || []).map((f) => path.join(dir, f)).filter((f) => fs.existsSync(f)).slice(0, 2);
  const infoTop = coverH + 20 + sh + 26;
  const H = infoTop + 230;
  const comps = [];
  comps.push({ input: await sharp(coverFile).resize(CW, coverH, { fit: "cover" }).toBuffer(), left: 0, top: 0 });
  for (let i = 0; i < samples.length; i++) comps.push({ input: await sharp(samples[i]).resize(Math.round(sw), sh, { fit: "cover" }).toBuffer(), left: i ? Math.round(sw) + 20 : 0, top: coverH + 20 });
  const sw0 = 46;
  const pal = (meta.palette || []).slice(0, 6).map((c, i) =>
    `<rect x="${i * (sw0 + 10)}" y="0" width="${sw0}" height="${sw0}" rx="8" fill="${c.startsWith("#") ? c : "#" + c}" stroke="#00000022"/>`).join("");
  const desc = wrap(meta.description, 34).slice(0, 2);
  const info = [`风格：${(meta.style || []).join(" · ")}`, meta.tone, `${meta.pageTypes?.length || 0} 种页面`, meta.imageHeavy ? "图片较多" : "图片较少"].filter(Boolean).join("　|　");
  const svg = `<svg width="${CW}" height="${H - infoTop}" xmlns="http://www.w3.org/2000/svg">
    <text x="0" y="40" font-family="${FONT}" font-size="34" font-weight="700" fill="#222">${esc(meta.name)}</text>
    ${desc.map((l, i) => `<text x="0" y="${84 + i * 32}" font-family="${FONT}" font-size="22" fill="#555">${esc(l)}</text>`).join("")}
    <g transform="translate(0, ${desc.length > 1 ? 140 : 110})">${pal}</g>
    <text x="0" y="${desc.length > 1 ? 222 : 192}" font-family="${FONT}" font-size="19" fill="#777">${esc(info)}${note ? "　|　" + esc(note) : ""}</text>
  </svg>`;
  comps.push({ input: Buffer.from(svg), left: 0, top: infoTop });
  const badge = `<svg width="84" height="84"><rect width="84" height="84" rx="16" fill="#111" fill-opacity="0.82"/><text x="42" y="58" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="#fff" text-anchor="middle">${label}</text></svg>`;
  comps.push({ input: Buffer.from(badge), left: 18, top: 18 });
  return sharp({ create: { width: CW, height: H, channels: 3, background: "#ffffff" } }).composite(comps).png().toBuffer();
}

async function makeCards({ ids, title, subtitle, out }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cards-"));
  const cards = [];
  for (let i = 0; i < ids.length; i++) {
    const meta = JSON.parse(fs.readFileSync(path.join(ROOT, "templates", ids[i], "meta.json"), "utf8"));
    let cover, note = "";
    try { cover = await liveCover(meta, title, subtitle, tmp); }
    catch (e) {
      cover = path.join(ROOT, "templates", meta.id, meta.preview?.cover || "preview/cover.jpg");
      note = "封面为示例标题";
      console.warn(`[卡片] ${meta.id} 无法现场渲染封面（${e.message}），改用预渲染封面`);
    }
    cards.push(await makeCard(meta, cover, "ABCDEFG"[i], note));
    console.log(`[卡片] ${"ABCDEFG"[i]}. ${meta.name}`);
  }
  const metas = await Promise.all(cards.map((c) => sharp(c).metadata()));
  const W = cards.length * CW + (cards.length + 1) * PAD, Hh = Math.max(...metas.map((m) => m.height)) + PAD * 2;
  out = path.resolve(out || path.join(ROOT, "projects", "_cards", "cards.jpg"));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp({ create: { width: W, height: Hh, channels: 3, background: "#f2f1f4" } })
    .composite(cards.map((c, i) => ({ input: c, left: PAD + i * (CW + PAD), top: PAD })))
    .jpeg({ quality: 86 }).toFile(out);
  console.log(`[卡片] → ${out}`);
  return out;
}

module.exports = { makeCards };

if (require.main === module) {
  const a = process.argv.slice(2);
  const get = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const ids = (get("--ids") || "").split(/[,，]/).filter(Boolean);
  if (!ids.length || !get("--title")) { console.error('用法：node core/card.js --ids a,b,c --title "标题" [--subtitle "副标题"] [--out cards.jpg]'); process.exit(2); }
  makeCards({ ids, title: get("--title"), subtitle: get("--subtitle"), out: get("--out") }).catch((e) => { console.error(e); process.exit(1); });
}
