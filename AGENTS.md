# PPT 模板库 · 给 AI 的说明

这个文件夹是「多模板 PPT 生成系统」：**每个模板的翻页和入场动画都是从原模板 .pptx 里原样抽出来的（`templates/<id>/motion.json`），生成的 PPT 动起来和原模板一模一样。**
结构是 `core/` 引擎 + `templates/` 模板 + 项目里自带的两个 skill：
- `.agents/skills/`：Codex 在这个文件夹里启动时会自动读取（这份是主版本）
- `.claude/skills/`：Claude Code 读取（由 `npm run sync-skills` 从上面同步，不要单独改）

skill 跟着项目走，**不要**把它们复制到用户的 `~/.agents/skills`、`~/.claude/skills` 等个人目录。

> **不管你是哪个 AI 工具**（Codex、Claude Code、Cursor、Gemini CLI、Copilot、OpenCode、Trae、Kiro、Windsurf……）：
> 用户要做 PPT 时，先把 `.agents/skills/ppt2-generate/SKILL.md` **全文读一遍并照着做**；要新增模板时读 `.agents/skills/ppt2-template-intake/SKILL.md`。
> 你的工具会不会自动加载 skill 都没关系，只要照这两个文件做，结果都一样。

## 第一次使用 / 用户说「帮我安装」

用中文、用大白话告诉用户你在做什么。

1. 检查 Node.js：运行 `node -v`，需要 18 以上。没有就帮用户装：Windows 用 `winget install OpenJS.NodeJS.LTS`，macOS 用 `brew install node`。
2. 在本文件夹运行 `node install.js`：装依赖，再给每个模板生成一份测试 PPT。看到「✅ 准备好了」才算成功。npm 慢或失败就先运行 `npm config set registry https://registry.npmmirror.com` 再重试。
3. 问用户要不要 AI 配图。要的话请他提供接口地址（Base URL）、key、模型名，按 `.env.example` 的格式写进本文件夹的 `.env`。不要在对话里复述或打印 key。
4. 可选：LibreOffice，用来出预览总览图和 PDF。先问用户，别擅自装。Windows 用 `winget install TheDocumentFoundation.LibreOffice`，macOS 用 `brew install --cask libreoffice`。
5. 告诉用户：以后在这个文件夹里新开 Codex / Claude Code 会话，说「用 ppt2-generate 帮我做一个关于 XX 的 PPT」就行。

没有 `node_modules/` 时，用户直接要做 PPT 也一样：先自动跑 `npm install`，再开始。

### claude.ai 网页版 / Claude 桌面 App

这些环境不会读项目里的 skill：
- 有 `propose_skills` 工具：读 `.agents/skills/*/SKILL.md`，原样作为新 skill 提交给用户保存。
- 没有这个工具：运行 `npm run skill-zips` 生成 `dist/*.zip`，让用户在 Customize > Skills > + > Create skill > Upload a skill 里上传。
- 模板库本身：用的时候在对话里连接这个文件夹，或者上传它的 zip。

## 做 PPT（最重要）

- **必须走模板库**：只写 `projects/<项目>/deck.json`，再运行 `node core/render.js projects/<项目>/deck.json`。完整流程见 `.agents/skills/ppt2-generate/SKILL.md`（3 选 1 → 设置 → 大纲 → 生成 → 质检 → 修改）。
- 不要自己写 pptxgenjs / python-pptx / HTML 代码去画页面，也不要用别的 PPT skill（ppt-master、pptx、slides 等）代替，否则出来的不是模板样式。
- 新增模板：按 `.agents/skills/ppt2-template-intake/SKILL.md` 做。
- 模板标准、字数上限、deck.json 格式在 `TEMPLATE_SPEC.md`，常用命令在 `README.md`。

## 维护

- 改 skill 只改 `.agents/skills/` 里的，改完运行 `npm run sync-skills`。
- 不要改 `core/` 和别的模板，除非用户明确要求。
- `.env` 里是用户的 key：不打印，不提交，不发给别人。
- `templates/*/assets/` 里的图片来自网络模板，只能个人学习使用。用户要公开发布或收费时，提醒他改用 AI 配图。
