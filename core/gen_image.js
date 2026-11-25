/**
 * 单独生成一张图片（读取同目录 .env 里的接口地址、key 和模型）
 *
 *   node core/gen_image.js                          用默认提示词（《AI 时代》封面）生成一张
 *   node core/gen_image.js "提示词"                  按你的提示词生成，默认 1536x1024
 *   node core/gen_image.js "提示词" 1024x1536        指定尺寸（宽x高，16 的倍数）
 *
 * 结果保存在 generated/ 文件夹，文件名带时间。
 */
const fs = require("fs");
const path = require("path");
const { providers, loadDotEnv, setupProxy, DEFAULT_STYLE } = require("./images");

const DEFAULT_PROMPT =
  "黄昏时分的现代城市天际线，玻璃幕墙反射柔和的紫色与琥珀色天光，远处亮起点点灯光，象征一个新时代的到来。\n" + DEFAULT_STYLE;

(async () => {
  loadDotEnv(path.join(__dirname, ".."));
  setupProxy();
  const prompt = process.argv[2] || DEFAULT_PROMPT;
  const [W, H] = (process.argv[3] || "1536x1024").split("x").map(Number);
  if (!W || !H) throw new Error("尺寸格式应为 宽x高，例如 1536x1024");
  const outDir = path.join(__dirname, "..", "generated");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  let outFile = path.join(outDir, `image_${stamp}.jpg`);
  for (let i = 2; fs.existsSync(outFile); i++) outFile = path.join(outDir, `image_${stamp}_${i}.jpg`);
  console.log(`接口：${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}`);
  console.log(`模型：${process.env.OPENAI_IMAGE_MODEL || "gpt-image-2"}   尺寸：${W}x${H}   质量：${process.env.IMAGE_QUALITY || "medium"}`);
  console.log("生成中，通常需要 20~90 秒……");
  const t0 = Date.now();
  const info = await providers.openai({ id: "single", w: W, h: H, size: `${W}x${H}` }, prompt, outFile);
  console.log(`✓ 完成（${((Date.now() - t0) / 1000).toFixed(1)}s，${info.source}）`);
  console.log("保存到：" + outFile);
})().catch((e) => { console.error("✗ 生成失败：" + e.message); process.exit(1); });
