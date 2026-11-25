/**
 * Preview: .pptx → per-page thumbnails + overview image (one image with every page, viewable right in the conversation)
 *   node core/preview.js out/xxx.pptx [--cols 4] [--width 640]
 * Requires LibreOffice (soffice) and poppler (pdftoppm). Without them, prints a notice and skips; the pptx itself is unaffected.
 * Note: the render shows neither page transitions nor entrance animations (those only play in PowerPoint); LibreOffice shows the fallback effect for p14/p15 transitions.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const sharp = require("sharp");

function findBin(names, extra = []) {
  for (const n of [...extra, ...names]) {
    try {
      if (path.isAbsolute(n)) { if (fs.existsSync(n)) return n; continue; }
      execFileSync(process.platform === "win32" ? "where" : "which", [n], { stdio: "pipe" });
      return n;
    } catch {}
  }
  return null;
}
const SOFFICE = () => process.env.SOFFICE || findBin(["soffice", "libreoffice"], ["C:\\Program Files\\LibreOffice\\program\\soffice.exe", "/Applications/LibreOffice.app/Contents/MacOS/soffice"]);
const PDFTOPPM = () => process.env.PDFTOPPM || findBin(["pdftoppm"]);

/** pptx → pdf (placed next to the pptx, same name) */
function toPdf(pptx) {
  const soffice = SOFFICE();
  if (!soffice) throw new Error("缺少 LibreOffice（soffice），无法导出 PDF；也可以在 PowerPoint 里 另存为 PDF");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pdf-"));
  const src = path.join(tmp, "deck.pptx");
  fs.copyFileSync(pptx, src);
  execFileSync(soffice, ["--headless", `-env:UserInstallation=file://${tmp.replace(/\\/g, "/")}/profile`, "--convert-to", "pdf", "--outdir", tmp, src], { stdio: "pipe", timeout: 170000 });
  const out = pptx.replace(/\.pptx$/i, ".pdf");
  fs.copyFileSync(path.join(tmp, "deck.pdf"), out);
  return out;
}

/** pptx → pdf → jpg images (returns the list of image paths) */
function rasterize(pptx, outDir, { dpi = 60 } = {}) {
  const soffice = SOFFICE(), pdftoppm = PDFTOPPM();
  if (!soffice || !pdftoppm) throw new Error("缺少 LibreOffice（soffice）或 poppler（pdftoppm），无法生成预览图");
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pv-"));
  const src = path.join(tmp, "deck.pptx");
  fs.copyFileSync(pptx, src); // copy to an ASCII path first, so Chinese filenames don't trip up the tools
  execFileSync(soffice, ["--headless", `-env:UserInstallation=file://${tmp.replace(/\\/g, "/")}/profile`, "--convert-to", "pdf", "--outdir", tmp, src], { stdio: "pipe", timeout: 170000 });
  const pdf = path.join(tmp, "deck.pdf");
  if (!fs.existsSync(pdf)) throw new Error("LibreOffice 没有生成 PDF");
  for (const f of fs.readdirSync(outDir)) if (/^page-\d+\.jpg$/.test(f)) fs.rmSync(path.join(outDir, f));
  execFileSync(pdftoppm, ["-jpeg", "-r", String(dpi), pdf, path.join(outDir, "page")], { stdio: "pipe" });
  const pages = fs.readdirSync(outDir).filter((f) => /^page-\d+\.jpg$/.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
  // Normalize filenames to page-01.jpg …
  return pages.map((f, i) => {
    const to = path.join(outDir, `p${String(i + 1).padStart(2, "0")}.jpg`);
    fs.renameSync(path.join(outDir, f), to);
    return to;
  });
}

/** Tile several images into one overview image (page number in the top-left corner) */
async function grid(files, outFile, { cols = 4, width = 480, gap = 12, bg = "#ffffff", labels } = {}) {
  const meta = await sharp(files[0]).metadata();
  const w = width, h = Math.round((meta.height / meta.width) * w);
  const rows = Math.ceil(files.length / cols);
  const W = cols * w + (cols + 1) * gap, Hh = rows * h + (rows + 1) * gap;
  const comps = [];
  for (let i = 0; i < files.length; i++) {
    const x = gap + (i % cols) * (w + gap), y = gap + Math.floor(i / cols) * (h + gap);
    comps.push({ input: await sharp(files[i]).resize(w, h).toBuffer(), left: x, top: y });
    const label = labels ? labels[i] : String(i + 1);
    const lw = 18 + label.length * 9;
    comps.push({ input: Buffer.from(`<svg width="${lw}" height="24"><rect width="${lw}" height="24" rx="4" fill="#000" fill-opacity="0.65"/><text x="${lw / 2}" y="17" font-size="14" fill="#fff" text-anchor="middle" font-family="Arial, sans-serif">${label}</text></svg>`), left: x + 6, top: y + 6 });
  }
  await sharp({ create: { width: W, height: Hh, channels: 3, background: bg } }).composite(comps).jpeg({ quality: 82 }).toFile(outFile);
  return outFile;
}

async function previewDeck(pptx, { cols = 4, width = 480, dpi = 60 } = {}) {
  const dir = pptx.replace(/\.pptx$/i, "_preview");
  try {
    const pages = rasterize(pptx, dir, { dpi });
    const overview = await grid(pages, path.join(dir, "overview.jpg"), { cols, width });
    console.log(`[预览] ${pages.length} 页缩略图 → ${dir}\n[预览] 总览图 → ${overview}`);
    return { dir, pages, overview };
  } catch (e) {
    console.warn("[预览] 跳过：" + e.message);
    return { skipped: e.message };
  }
}

module.exports = { rasterize, grid, previewDeck, toPdf };

if (require.main === module) {
  const a = process.argv.slice(2);
  const get = (k, d) => { const i = a.indexOf(k); return i >= 0 ? Number(a[i + 1]) : d; };
  previewDeck(path.resolve(a[0]), { cols: get("--cols", 4), width: get("--width", 480) }).then((r) => process.exit(r.skipped ? 1 : 0));
}
