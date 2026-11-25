#!/usr/bin/env node
/**
 * First-time setup (only touches this folder; writes nothing to the user's home directory)
 *   node install.js            check Node → npm install → self-test (generate one test PPT per template)
 *   node install.js --skip-npm skip npm install
 *
 * The skills already live in the project: .agents/skills (read by Codex) and .claude/skills (read by Claude Code).
 * Open Codex / Claude Code in this folder and they're available — no install needed.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const LIB = __dirname;
const args = process.argv.slice(2);
const ok = (m) => console.log("  ✓ " + m), warn = (m) => console.log("  ⚠ " + m), step = (m) => console.log("\n▶ " + m);
const fail = (m) => { console.error("\n✗ " + m); process.exit(1); };
const run = (cmd, a, o = {}) => spawnSync(cmd, a, { cwd: LIB, stdio: o.quiet ? "pipe" : "inherit", shell: process.platform === "win32", encoding: "utf8" });
const has = (cmd) => spawnSync(process.platform === "win32" ? "where" : "which", [cmd], { stdio: "pipe", shell: process.platform === "win32" }).status === 0;

step("检查 Node.js");
if (parseInt(process.versions.node, 10) < 18) fail(`Node.js 版本太低（${process.versions.node}），需要 18 以上。Windows：winget install OpenJS.NodeJS.LTS；macOS：brew install node`);
ok(`Node ${process.versions.node}`);

if (!args.includes("--skip-npm")) {
  step("安装依赖（npm install，第一次大约 1～3 分钟）");
  if (run("npm", ["install", "--no-audit", "--no-fund"]).status !== 0) fail("npm install 失败。网络慢可以先运行：npm config set registry https://registry.npmmirror.com ，再重新运行 node install.js");
  ok("依赖已安装");
}
try { for (const m of ["pptxgenjs", "sharp", "react-icons/fi", "jszip"]) require(path.join(LIB, "node_modules", m)); }
catch (e) { fail("依赖不完整：" + e.message + "。请重新运行 node install.js"); }

step("skill（项目内自带，不用安装）");
for (const d of [".agents/skills", ".claude/skills"]) {
  const p = path.join(LIB, d);
  const list = fs.existsSync(p) ? fs.readdirSync(p).filter((s) => fs.existsSync(path.join(p, s, "SKILL.md"))) : [];
  list.length ? ok(`${d}：${list.join("、")}`) : warn(`${d} 里没有 skill`);
}

step("自测：用模板原图为每个模板生成一份测试 PPT");
const pdir = path.join(LIB, "projects", "_install_test");
fs.mkdirSync(pdir, { recursive: true });
const deck = JSON.parse(fs.readFileSync(path.join(LIB, "fixtures", "test_deck.json"), "utf8"));
let allOk = true;
for (const t of fs.readdirSync(path.join(LIB, "templates")).filter((t) => fs.existsSync(path.join(LIB, "templates", t, "meta.json")))) {
  const meta = JSON.parse(fs.readFileSync(path.join(LIB, "templates", t, "meta.json"), "utf8"));
  const f = path.join(pdir, `${t}.json`), out = path.join(pdir, `${t}.pptx`);
  fs.writeFileSync(f, JSON.stringify({ ...deck, settings: { ...deck.settings, template: t, imageSource: "template" }, slides: deck.slides.filter((x) => meta.pageTypes.includes(x.type) || x.type === "steps") }, null, 2));
  const r = run(process.execPath, [path.join(LIB, "core", "render.js"), f, "--images", "template", "--out", out], { quiet: true });
  const good = r.status === 0 && fs.existsSync(out);
  allOk = allOk && good;
  good ? ok(`${t}（${meta.name}）`) : warn(`${t} 生成失败：${(r.stderr || r.stdout || "").slice(-400)}`);
}
if (!allOk) fail("自测没有全部通过，见上面的报错");

step("可选项");
fs.existsSync(path.join(LIB, ".env")) ? ok("已有 .env（AI 配图）") : warn("没有 .env：AI 配图暂时用不了（会自动用模板原图）。要用就把 .env.example 复制成 .env，填自己的接口地址、key、模型");
const lo = has("soffice") || has("libreoffice") || (process.platform === "win32" && fs.existsSync("C:\\Program Files\\LibreOffice\\program\\soffice.exe"));
lo ? ok("已安装 LibreOffice（预览图 / PDF）") : warn("没装 LibreOffice：PPT 照样能生成，只是没有预览总览图和 PDF。Windows：winget install TheDocumentFoundation.LibreOffice；macOS：brew install --cask libreoffice");

console.log(`\n✅ 准备好了。在这个文件夹里新开一个 AI 会话（Codex、Claude Code、Cursor、Gemini CLI 等都行），说「用 ppt2-generate 帮我做一个关于 XX 的 PPT」。`);
