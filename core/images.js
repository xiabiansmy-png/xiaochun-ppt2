/**
 * 图片来源模块：根据主题自动生成（gpt-image-2）/ 网上搜图（Pexels）/ 用模板原图
 * ------------------------------------------------------------------
 * 在 build.js / build_ai.js 里先定义"图片槽位"，再交给这里统一处理：
 *
 *   const IMG = createImageResolver({ slots, assetsDir, topic });
 *   await IMG.prefetch();              // 并发生成 / 下载全部图片（带缓存）
 *   IMG.path("cover")                  // → 本地图片路径，交给 sharp 裁切后放进 PPT
 *
 * 槽位格式：
 *   cover: {
 *     w: 6.01, h: 4.68,                 // 图框尺寸（英寸），决定出图比例
 *     prompt: "黄昏时分的城市天际线……",  // 给 gpt-image-2 的画面描述（会自动拼上主题和统一风格）
 *     query: "city skyline dusk",        // 给 Pexels 搜图的英文关键词
 *     fallback: "image1.jpeg",           // 失败或选 template 时使用的模板原图
 *     alt: "黄昏中的城市天际线",           // 无障碍替代文字
 *   }
 *
 * 环境变量：
 *   （以下变量都可以写在项目目录的 .env 文件里；.env 里配了 key 时默认用 openai）
 *   IMAGE_PROVIDER     template（默认，用模板原图）| openai | pexels | mock（离线占位图，测试用）
 *   OPENAI_API_KEY     使用 openai 时必填
 *   OPENAI_BASE_URL    可选，默认 https://api.openai.com/v1（可换成兼容 OpenAI 接口的中转地址）
 *   OPENAI_IMAGE_MODEL 可选，默认 gpt-image-2
 *   IMAGE_QUALITY      可选，low | medium（默认）| high | auto
 *   PEXELS_API_KEY     使用 pexels 时必填（https://www.pexels.com/api/ 免费申请）
 *   IMAGE_CONCURRENCY  可选，同时进行的请求数，默认 3
 *   IMAGE_REFRESH=1    可选，忽略缓存、全部重新生成
 *   HTTPS_PROXY        可选，走代理（需要 npm i undici）
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");


/* ---------------- 读取 .env（兼容多种写法） ----------------
 * 支持：OPENAI_API_KEY / apikey / API_KEY、OPENAI_BASE_URL / Base URL / base_url、
 *       OPENAI_IMAGE_MODEL / Model、IMAGE_PROVIDER、IMAGE_QUALITY、PEXELS_API_KEY
 * 已经在命令行里设置的环境变量优先，不会被 .env 覆盖。
 */
const ENV_ALIASES = {
  apikey: "OPENAI_API_KEY", openaiapikey: "OPENAI_API_KEY", key: "OPENAI_API_KEY",
  baseurl: "OPENAI_BASE_URL", openaibaseurl: "OPENAI_BASE_URL", apibase: "OPENAI_BASE_URL", url: "OPENAI_BASE_URL",
  model: "OPENAI_IMAGE_MODEL", imagemodel: "OPENAI_IMAGE_MODEL", openaiimagemodel: "OPENAI_IMAGE_MODEL",
  imageprovider: "IMAGE_PROVIDER", provider: "IMAGE_PROVIDER",
  imagequality: "IMAGE_QUALITY", quality: "IMAGE_QUALITY",
  pexelsapikey: "PEXELS_API_KEY", pexelskey: "PEXELS_API_KEY",
  imageconcurrency: "IMAGE_CONCURRENCY", httpsproxy: "HTTPS_PROXY",
};
let dotEnvLoaded = false;
function loadDotEnv(...dirs) {
  if (dotEnvLoaded) return;
  dotEnvLoaded = true;
  for (const dir of [...dirs, process.cwd()]) {
    const f = path.join(dir, ".env");
    if (!fs.existsSync(f)) continue;
    let n = 0;
    for (const raw of fs.readFileSync(f, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const m = line.match(/^([^=:]+?)\s*[=:]\s*(.*)$/);
      if (!m) continue;
      const name = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, "");
      const norm = name.toLowerCase().replace(/[\s_\-]/g, "");
      const target = ENV_ALIASES[norm] || name.toUpperCase().replace(/\s+/g, "_");
      if (process.env[target] === undefined && val) { process.env[target] = val; n++; }
    }
    // .env 里配了 key、又没指定来源 → 默认用 openai 兼容接口生成
    if (!process.env.IMAGE_PROVIDER && process.env.OPENAI_API_KEY) process.env.IMAGE_PROVIDER = "openai";
    console.log(`[images] 已读取 ${f}（${n} 项）`);
    return;
  }
}

/** 模板没写 imageStyle 时的默认画面风格 */
const DEFAULT_STYLE =
  "摄影风格：编辑杂志感，真实摄影质感，柔和自然光，低饱和度，色彩干净克制，构图简洁、留有呼吸感。" +
  "画面中不要出现任何文字、字母、数字、Logo 或水印。";

function setupProxy() {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!proxy) return;
  const base = process.env.OPENAI_BASE_URL || "";
  if ((process.env.IMAGE_PROVIDER || "") === "openai" && /\/\/(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(base)) return; // 本地中转不走代理
  try {
    const { ProxyAgent, setGlobalDispatcher } = require("undici");
    setGlobalDispatcher(new ProxyAgent(proxy));
    console.log("[images] 使用代理", proxy);
  } catch {
    console.warn("[images] 设置了 HTTPS_PROXY，但没有安装 undici（npm i undici），将直接连接");
  }
}

const round16 = (v) => Math.max(16, Math.round(v / 16) * 16);
/** 按图框比例算 gpt-image-2 的出图尺寸（宽高为 16 的倍数，比例限制在 1:3 ~ 3:1） */
function openaiSize(w, h) {
  const ratio = Math.min(3, Math.max(1 / 3, w / h));
  const long = Math.max(w, h) >= 9 ? 2048 : 1536; // 满版大图给更高分辨率
  return ratio >= 1 ? `${long}x${round16(long / ratio)}` : `${round16(long * ratio)}x${long}`;
}
/** 自定义尺寸被拒时退回的标准尺寸 */
function standardSize(w, h) {
  const r = w / h;
  return r > 1.2 ? "1536x1024" : r < 0.83 ? "1024x1536" : "1024x1024";
}

async function withRetry(fn, label, tries = 3) {
  let delay = 2000;
  for (let i = 1; ; i++) {
    try { return await fn(); } catch (e) {
      const retryable = e.status === 429 || (e.status >= 500 && e.status < 600) || e.code === "ECONNRESET" || e.name === "TypeError";
      if (i >= tries || !retryable) throw e;
      console.warn(`[images] ${label} 第 ${i} 次失败（${e.message}），${delay / 1000}s 后重试`);
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
    }
  }
}
async function httpJson(url, opts) {
  const res = await fetch(url, opts);
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    throw err;
  }
  return JSON.parse(text);
}

/* ---------------- 各个图片来源 ---------------- */
const providers = {
  /** gpt-image-2 生成 */
  async openai(slot, prompt, outFile) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("缺少 OPENAI_API_KEY");
    const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
    const quality = process.env.IMAGE_QUALITY || "medium";
    const call = (size) => withRetry(() => httpJson(`${base}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, size, quality, n: 1, output_format: "jpeg", output_compression: 90 }),
    }), slot.id);
    let size = slot.size || openaiSize(slot.w, slot.h), data;
    try {
      data = await call(size);
    } catch (e) {
      if (e.status !== 400) throw e;
      size = standardSize(slot.w, slot.h); // 自定义尺寸不被接受 → 改用标准尺寸
      console.warn(`[images] ${slot.id} 自定义尺寸被拒，改用 ${size}`);
      data = await call(size);
    }
    const item = data?.data?.[0] || {};
    if (item.b64_json) {
      fs.writeFileSync(outFile, Buffer.from(item.b64_json, "base64"));
    } else if (item.url) { // 部分中转服务返回图片链接
      const res = await fetch(item.url);
      if (!res.ok) throw new Error(`下载生成结果失败 HTTP ${res.status}`);
      fs.writeFileSync(outFile, Buffer.from(await res.arrayBuffer()));
    } else {
      throw new Error("返回结果里既没有 b64_json 也没有 url：" + JSON.stringify(data).slice(0, 200));
    }
    return { source: `${model} · ${size} · ${quality}` };
  },

  /** Pexels 搜图（免费商用；保留摄影师署名） */
  async pexels(slot, _prompt, outFile) {
    const key = process.env.PEXELS_API_KEY;
    if (!key) throw new Error("缺少 PEXELS_API_KEY");
    const r = slot.w / slot.h;
    const orientation = r > 1.2 ? "landscape" : r < 0.83 ? "portrait" : "square";
    const q = encodeURIComponent(slot.query || slot.prompt);
    const data = await withRetry(() => httpJson(
      `${(process.env.PEXELS_API_URL || "https://api.pexels.com/v1").replace(/\/$/, "")}/search?query=${q}&orientation=${orientation}&per_page=15`,
      { headers: { Authorization: key } }), slot.id);
    const photos = data.photos || [];
    if (!photos.length) throw new Error(`Pexels 没搜到：${slot.query}`);
    // 选比例最接近图框、且足够大的那张
    const best = photos
      .filter((p) => Math.max(p.width, p.height) >= 1200)
      .sort((a, b) => Math.abs(Math.log((a.width / a.height) / r)) - Math.abs(Math.log((b.width / b.height) / r)))[0] || photos[0];
    const res = await fetch(best.src.large2x || best.src.original);
    if (!res.ok) throw new Error(`下载图片失败 HTTP ${res.status}`);
    fs.writeFileSync(outFile, Buffer.from(await res.arrayBuffer()));
    return { source: `Pexels · ${best.photographer}`, url: best.url };
  },

  /** 离线占位图（不联网、不花钱，用来检查排版） */
  async mock(slot, prompt, outFile) {
    const W = 1200, H = Math.round(1200 * slot.h / slot.w);
    const esc = (t) => t.replace(/[<&>]/g, "");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9A8FA6"/><stop offset="1" stop-color="#C58D1E"/></linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <text x="50%" y="46%" font-size="${Math.round(W / 14)}" fill="#fff" text-anchor="middle" font-family="sans-serif">${esc(slot.id)}</text>
      <text x="50%" y="58%" font-size="${Math.round(W / 34)}" fill="#fff" text-anchor="middle" font-family="sans-serif">${esc((slot.query || "").slice(0, 40))}</text></svg>`;
    await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toFile(outFile);
    return { source: "mock" };
  },
};

/* ---------------- 对外接口 ---------------- */
function createImageResolver({ slots, assetsDir, outDir, topic = "", style = DEFAULT_STYLE, provider, envDir }) {
  loadDotEnv(envDir || path.dirname(assetsDir));
  provider = provider || process.env.IMAGE_PROVIDER || "template";
  outDir = outDir || path.join(path.dirname(assetsDir), "generated");
  const resolved = {};
  const manifest = {};

  const buildPrompt = (slot) => [topic && `这是一份主题为「${topic}」的演示文稿配图。`, `画面内容：${slot.prompt}`, style].filter(Boolean).join("\n");

  async function resolveOne(id, slot) {
    slot = { id, ...slot };
    const fallback = path.isAbsolute(slot.fallback || "") ? slot.fallback : path.join(assetsDir, slot.fallback);
    if (provider === "template" || !providers[provider]) { resolved[id] = fallback; return; }
    const prompt = buildPrompt(slot);
    // 缓存键：来源 + 模型 + 质量 + 完整提示词 + 画面比例（按 0.1 取整）——换模板时比例相近的图可以复用
    const aspect = (Math.round((slot.w / slot.h) * 10) / 10).toFixed(1);
    const hash = crypto.createHash("sha1").update([provider, process.env.OPENAI_IMAGE_MODEL || "", process.env.IMAGE_QUALITY || "", prompt, slot.query, aspect].join("|")).digest("hex").slice(0, 10);
    const outFile = path.join(outDir, `${id}_${provider}_${hash}.jpg`);
    if (fs.existsSync(outFile) && !process.env.IMAGE_REFRESH) {
      resolved[id] = outFile;
      manifest[id] = { file: path.basename(outFile), cached: true, prompt: slot.prompt, query: slot.query };
      return;
    }
    const t0 = Date.now();
    try {
      const info = await providers[provider](slot, prompt, outFile);
      resolved[id] = outFile;
      manifest[id] = { file: path.basename(outFile), ...info, prompt: slot.prompt, query: slot.query };
      console.log(`[images] ✓ ${id}  ${info.source}  ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    } catch (e) {
      resolved[id] = fallback;
      manifest[id] = { file: path.basename(fallback), error: e.message };
      console.warn(`[images] ✗ ${id} 失败，改用模板原图 ${slot.fallback}：${e.message}`);
    }
  }

  return {
    provider,
    /** 并发处理所有槽位 */
    async prefetch() {
      if (provider !== "template") {
        fs.mkdirSync(outDir, { recursive: true });
        setupProxy();
        console.log(`[images] 来源：${provider}，共 ${Object.keys(slots).length} 张`);
      }
      const ids = Object.keys(slots);
      const limit = Number(process.env.IMAGE_CONCURRENCY || 3);
      let next = 0;
      await Promise.all(Array.from({ length: Math.min(limit, ids.length) }, async () => {
        while (next < ids.length) { const id = ids[next++]; await resolveOne(id, slots[id]); }
      }));
      if (provider !== "template") fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    },
    /** 槽位 id → 图片路径；不是槽位的（如叶影、笔记本外框）按模板素材文件名处理 */
    path(idOrFile) {
      if (resolved[idOrFile]) return resolved[idOrFile];
      if (slots[idOrFile]) { const f = slots[idOrFile].fallback; return path.isAbsolute(f) ? f : path.join(assetsDir, f); }
      return path.join(assetsDir, idOrFile);
    },
    alt(id) { return slots[id]?.alt || ""; },
    /** 用了网图时给出署名列表 */
    manifest() { return manifest; },
    credits() { return Object.values(manifest).filter((m) => m.url).map((m) => `${m.source} ${m.url}`); },
  };
}

module.exports = { createImageResolver, openaiSize, DEFAULT_STYLE, providers, loadDotEnv, setupProxy };
