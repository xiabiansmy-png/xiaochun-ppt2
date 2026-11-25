/**
 * 用 AI 重新生成某个模板的图片素材（把网络原图换成可分享的 AI 图）
 *
 *   node tools/gen_assets.js <模板id>                 生成 templates/<id>/assets.ai.json 里列出的全部图片
 *   node tools/gen_assets.js <模板id> bg_wash.jpg     只重画这一张（可写多个文件名）
 *
 * - 读根目录 .env 的图片接口（和 core/gen_image.js 一样），并发 3 张。
 * - 每张先写到临时文件，成功后统一转成 JPEG（最长边 1920）覆盖 assets/ 里的同名文件；失败的保留原文件。
 * - 中转返回的比例和请求不一致时（差 10% 以上）自动裁成请求的比例：有 "focus": [x, y] 就以它为中心，否则自动找主体。
 * - 生成完如果模板里有 derive.js，自动运行它（例如从整页背景派生内容页背景）。
 * - 生成记录写到 templates/<id>/assets/ai_manifest.json。
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { providers, loadDotEnv, setupProxy } = require("../core/images");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

(async () => {
  const [id, ...only] = process.argv.slice(2);
  if (!id) throw new Error("用法：node tools/gen_assets.js <模板id> [文件名…]");
  const root = path.join(__dirname, "..");
  const tdir = path.join(root, "templates", id);
  const listFile = path.join(tdir, "assets.ai.json");
  if (!fs.existsSync(listFile)) throw new Error(`没有找到 ${path.relative(root, listFile)}`);
  const spec = JSON.parse(fs.readFileSync(listFile, "utf8"));
  const assets = path.join(tdir, "assets");
  loadDotEnv(root);
  setupProxy();
  const jobs = spec.images.filter((j) => !only.length || only.includes(j.file));
  console.log(`接口：${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}   模型：${process.env.OPENAI_IMAGE_MODEL || "gpt-image-2"}`);
  console.log(`共 ${jobs.length} 张，通常每张 20~90 秒……`);
  const manifestFile = path.join(assets, "ai_manifest.json");
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : {};
  let ok = 0, next = 0;
  await Promise.all(Array.from({ length: Math.min(3, jobs.length) }, async () => {
    while (next < jobs.length) {
      const j = jobs[next++];
      const [w, h] = j.size.split("x").map(Number);
      const prompt = j.noStyle ? j.prompt : `${j.prompt}\n${spec.style || ""}`;
      const tmp = path.join(assets, `.tmp_${j.file}`);
      const t0 = Date.now();
      try {
        const info = await providers.openai({ id: j.file, w, h, size: j.size }, prompt, tmp);
        // 中转不一定按请求尺寸出图（例如要竖版却给横版）：比例差 10% 以上时，按画面主体裁成请求的比例
        const m = await sharp(tmp).metadata(), want = w / h, got = m.width / m.height;
        let img = sharp(tmp);
        if (Math.abs(Math.log(got / want)) > 0.1) {
          const cw = got > want ? Math.round(m.height * want) : m.width, ch = got > want ? m.height : Math.round(m.width / want);
          if (Array.isArray(j.focus)) { // assets.ai.json 里可写 "focus": [x, y]（0~1，裁切中心），否则自动找主体
            const left = Math.round(clamp(j.focus[0] * m.width - cw / 2, 0, m.width - cw)), top = Math.round(clamp(j.focus[1] * m.height - ch / 2, 0, m.height - ch));
            img = img.extract({ left, top, width: cw, height: ch });
          } else img = img.resize(cw, ch, { fit: "cover", position: sharp.strategy.attention });
          console.log(`  ${j.file}：返回 ${m.width}x${m.height}，已裁成 ${cw}x${ch}`);
        }
        const buf = await img.toBuffer();
        await sharp(buf).resize(1920, 1920, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toFile(path.join(assets, j.file));
        fs.unlinkSync(tmp);
        manifest[j.file] = { source: info.source, prompt, date: new Date().toISOString() };
        ok++;
        console.log(`✓ ${j.file}（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
      } catch (e) {
        try { fs.unlinkSync(tmp); } catch {}
        console.error(`✗ ${j.file} 失败，保留原文件：${e.message}`);
      }
    }
  }));
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  const derive = path.join(tdir, "derive.js");
  if (ok && fs.existsSync(derive)) await require(derive)(assets);
  console.log(`完成：成功 ${ok} / ${jobs.length}`);
  if (ok < jobs.length) process.exitCode = 1;
})().catch((e) => { console.error("✗ " + e.message); process.exit(1); });
