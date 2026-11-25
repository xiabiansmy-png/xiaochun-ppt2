/**
 * 整理用户自己的照片，给 AI 分配到合适的页面用
 *
 *   node core/photos.js projects/<项目>                       扫描 projects/<项目>/photos/
 *   node core/photos.js projects/<项目> --from "D:\我的照片"    先把这个文件夹（含子文件夹）里的图片复制进 photos/ 再扫描
 *   可选：--per 12（每张总览图放几张，默认 12）
 *
 * 输出（都在 photos/ 里，名字以 _ 开头，不会被当成照片）：
 *   _sheets/sheet_01.jpg …   编号总览图：每格是一张照片（完整显示不裁切），下面写「#编号 横/竖 比例 文件名」，AI 用 Read 看图
 *   _index.json              每张照片：编号、路径（相对项目文件夹，直接写进 deck.json 的 image.file）、宽高、比例、横竖、是否分辨率低
 *                            AI 看完总览图后把每张的画面描述写进 desc 字段；重新运行本脚本会保留已有的 desc / focus
 *
 * 手机照片的 EXIF 方向（竖着拍）会自动转正后再算宽高。HEIC 格式读不了时会列出来，请用户先转成 JPG。
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const EXT = /\.(jpe?g|png|webp|tiff?|gif|avif|heic|heif|bmp)$/i;
const esc = (s) => String(s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]));

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name.startsWith("_")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (EXT.test(e.name)) out.push(p);
  }
  return out.sort((a, b) => a.localeCompare(b, "zh"));
}

async function main() {
  const args = process.argv.slice(2);
  const proj = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--from" && args[args.indexOf(a) - 1] !== "--per");
  if (!proj) throw new Error("用法：node core/photos.js projects/<项目> [--from <照片文件夹>] [--per 12]");
  const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
  const projectDir = path.resolve(proj);
  const photoDir = path.join(projectDir, "photos");
  fs.mkdirSync(photoDir, { recursive: true });

  // 1. 可选：从别的文件夹复制进来
  const from = opt("--from");
  if (from) {
    let n = 0;
    for (const f of walk(path.resolve(from))) {
      let name = path.basename(f), dst = path.join(photoDir, name), k = 2;
      while (fs.existsSync(dst)) { const p = path.parse(name); dst = path.join(photoDir, `${p.name}_${k++}${p.ext}`); }
      fs.copyFileSync(f, dst); n++;
    }
    console.log(`[photos] 已从 ${from} 复制 ${n} 张到 ${path.relative(process.cwd(), photoDir)}`);
  }

  // 2. 读取每张照片
  const indexFile = path.join(photoDir, "_index.json");
  const old = fs.existsSync(indexFile) ? Object.fromEntries(JSON.parse(fs.readFileSync(indexFile, "utf8")).map((p) => [p.file, p])) : {};
  const list = [], bad = [];
  for (const f of walk(photoDir)) {
    const rel = path.relative(projectDir, f).split(path.sep).join("/");
    try {
      const m = await sharp(f).metadata();
      const rot = (m.orientation || 1) >= 5, w = rot ? m.height : m.width, h = rot ? m.width : m.height;
      const aspect = +(w / h).toFixed(2);
      list.push({ no: list.length + 1, file: rel, w, h, aspect, orient: aspect > 1.15 ? "横" : aspect < 0.87 ? "竖" : "方",
        lowRes: Math.max(w, h) < 1000, desc: old[rel]?.desc || "", ...(old[rel]?.focus ? { focus: old[rel].focus } : {}) });
    } catch (e) {
      bad.push(`${rel}（${/heif|heic/i.test(f) ? "HEIC 读不了，请先转成 JPG" : e.message}）`);
    }
  }
  fs.writeFileSync(indexFile, JSON.stringify(list, null, 2));

  // 3. 编号总览图
  const sheetDir = path.join(photoDir, "_sheets");
  fs.rmSync(sheetDir, { recursive: true, force: true });
  fs.mkdirSync(sheetDir, { recursive: true });
  const per = Math.max(4, +opt("--per", 12)), cols = 4, CW = 480, TH = 340, LH = 56, CH = TH + LH, G = 12;
  const sheets = [];
  for (let s = 0; s * per < list.length; s++) {
    const items = list.slice(s * per, (s + 1) * per), rows = Math.ceil(items.length / cols);
    const W = cols * CW + (cols + 1) * G, H = rows * CH + (rows + 1) * G;
    const comps = [];
    for (let i = 0; i < items.length; i++) {
      const p = items[i], x = G + (i % cols) * (CW + G), y = G + Math.floor(i / cols) * (CH + G);
      const thumb = await sharp(path.join(projectDir, p.file)).rotate()
        .resize(CW, TH, { fit: "contain", background: "#E9E9E9" }).jpeg().toBuffer();
      comps.push({ input: thumb, left: x, top: y });
      const name = p.file.replace(/^photos\//, "");
      const label = `<svg width="${CW}" height="${LH}"><rect width="100%" height="100%" fill="#222"/>
        <text x="12" y="37" font-size="26" font-weight="bold" fill="#FFD25A" font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif">#${p.no}</text>
        <text x="${String(p.no).length * 16 + 40}" y="36" font-size="20" fill="#fff" font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif">${esc(`${p.orient} ${p.aspect}${p.lowRes ? " 低清" : ""}  ${name.length > 26 ? name.slice(0, 12) + "…" + name.slice(-12) : name}`)}</text></svg>`;
      comps.push({ input: Buffer.from(label), left: x, top: y + TH });
    }
    const out = path.join(sheetDir, `sheet_${String(s + 1).padStart(2, "0")}.jpg`);
    await sharp({ create: { width: W, height: H, channels: 3, background: "#FFFFFF" } }).composite(comps).jpeg({ quality: 82 }).toFile(out);
    sheets.push(out);
  }

  const c = (o) => list.filter((p) => p.orient === o).length;
  console.log(`[photos] 共 ${list.length} 张：横 ${c("横")}、竖 ${c("竖")}、方 ${c("方")}${list.some((p) => p.lowRes) ? `，低清 ${list.filter((p) => p.lowRes).length} 张` : ""}`);
  if (bad.length) console.log(`[photos] 读不了 ${bad.length} 张：\n  ` + bad.join("\n  "));
  console.log(`[photos] 索引：${path.relative(process.cwd(), indexFile)}`);
  sheets.forEach((f) => console.log(`[photos] 总览：${path.relative(process.cwd(), f)}`));
}

main().catch((e) => { console.error("✗ " + e.message); process.exit(1); });
