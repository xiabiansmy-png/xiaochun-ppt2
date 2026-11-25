#!/usr/bin/env node
/**
 * Sync the skills: .agents/skills (read by Codex, the master copy) → .claude/skills (read by Claude Code)
 * After editing a skill, just edit the copy under .agents/skills/, then run: npm run sync-skills
 * With --zip it also packages dist/<skill>.zip (for claude.ai uploads: Customize > Skills > + > Create skill > Upload a skill)
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, ".agents", "skills"), DST = path.join(ROOT, ".claude", "skills");
const skills = fs.readdirSync(SRC).filter((d) => fs.existsSync(path.join(SRC, d, "SKILL.md")));

function copyDir(a, b) {
  fs.rmSync(b, { recursive: true, force: true });
  fs.mkdirSync(b, { recursive: true });
  for (const f of fs.readdirSync(a)) {
    const s = path.join(a, f), d = path.join(b, f);
    fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}
for (const s of skills) copyDir(path.join(SRC, s), path.join(DST, s));
console.log(`✓ 已同步 ${skills.length} 个 skill：.agents/skills → .claude/skills（${skills.join("、")}）`);

if (process.argv.includes("--zip")) {
  const JSZip = require(path.join(ROOT, "node_modules", "jszip"));
  fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });
  (async () => {
    const add = (zip, dir, prefix) => {
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        fs.statSync(p).isDirectory() ? add(zip, p, `${prefix}/${f}`) : zip.file(`${prefix}/${f}`, fs.readFileSync(p));
      }
    };
    for (const s of skills) {
      const zip = new JSZip();
      add(zip, path.join(SRC, s), s);
      fs.writeFileSync(path.join(ROOT, "dist", `${s}.zip`), await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", createFolders: false }));
    }
    console.log(`✓ 已生成 dist/${skills.join(".zip、dist/")}.zip（claude.ai 网页 / 桌面 App 上传用）`);
  })();
}
