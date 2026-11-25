# PPT 模板库（动效跟原模板走）

输入主题 / 文案 → 模板 3 选 1 → 自动生成完整 PPT（配图、翻页、入场动画、自动质检）。
内容（`deck.json`）和模板分开：同一份内容可以换任何模板重画。

模板入库时把原模板 .pptx 里的翻页和动画**原样抽出来**（`tools/motion_extract.py` → `templates/<id>/motion.json`），生成时照着写进去。用哪个模板，PPT 就和那个模板动得一模一样：哪一下单击、哪一块、什么效果、什么方向、多长时间，都一样。

## 快速开始

1. 在这个文件夹里打开你常用的 AI 编程工具（Codex、Claude Code、Cursor、Gemini CLI 等），第一次先说「帮我安装」，AI 会装好依赖并跑一遍自测。
2. 做 PPT：说「用 ppt2-generate 帮我做一个关于 XX 的 PPT」。
3. 加模板：上传一个 .pptx，说「用 ppt2-template-intake 把这个模板做进库」。

- 想要 AI 配图：安装时 AI 会问你要接口地址和 key（写进 `.env`）；不要的话就用模板原图。
- 想用自己的照片：把照片放进 `projects/<项目名>/photos/`，AI 看过每张照片后分配到合适的页面。
- 用 claude.ai 网页版或 Claude 桌面 App：把这个文件夹连接到对话，说「帮我安装」。
- 版权：`templates/*/assets/` 里的图片来自网络模板，版权归原作者，仅供个人学习使用；分享或商用前换成 AI 生成的图片。

### 现有模板

| 模板 | 色调 | 风格 | 适合 | 动效（来自原模板） |
|---|---|---|---|---|
| 深蓝新程 `navy-journey` | 深色封面 + 白底内容 | 商务、专业、简洁 | 年终总结、工作汇报、述职、新年计划 | 翻页飞过；页眉从左擦除、正文从底擦除；环形 / 双圆页圆形缩小 2 秒 |
| 橙意扁平 `orange-flat` | 浅灰底 + 橙色拨片、长投影 | 简洁、商务、活泼 | 工作总结、述职、商务汇报、工作计划 | 翻页「门」1.4 秒；每页翻完自动连播：主体飞入 / 浮入 / 缩放 → 长投影淡入 → 文字擦除 / 浮入 |
| 红白培训 `red-training` | 白底 + 正红页眉条 | 商务、专业、简洁 | 企业培训、领导力、团队管理、内训课件 | 翻页按页面类型：封面门 / 目录 comb / 章节百叶窗 / 内容页推进 / 数据页传送带 / 结尾飞机；原模板无入场动画，页面进来即完整呈现 |

## 目录

```
├── core/                 公共引擎
│   ├── render.js         渲染入口：deck.json → .pptx（配图 → 写入动效 → 质检 → 报告）
│   ├── motion.js         按模板的 motion.json 给元素分组、写入翻页和入场动画
│   ├── engine.js         渲染上下文 ctx（模板画页面时用的 API，ctx.g 给元素分组）
│   ├── spec.js           模板标准的机器可读版本（页面类型、槽位、字数上限）
│   ├── validate-deck.js  校验 deck.json
│   ├── qa.js / textfit.js 自动质检（溢出、单字掉行、重叠、越界、字号、对比度）
│   ├── preview.js        缩略图 + 总览图、导出 PDF（需要 LibreOffice）
│   ├── select.js / card.js  3 选 1 打分 / 预览卡片
│   ├── selftest.js       模板入库自测（含 motion.json 检查）
│   ├── photos.js         用户照片索引 + 编号总览图
│   └── images.js / gen_image.js   配图：gpt-image-2 / Pexels / 模板原图 / 占位图
├── templates/<id>/       build.js（怎么画）+ meta.json（描述）+ motion.json（怎么动）+ assets/ + preview/
├── tools/
│   ├── motion_extract.py 从原 .pptx 抽出翻页和动画：中文清单 + 原始 XML
│   ├── pptx_extract.py   把原模板里的渐变矢量装饰抠成透明 PNG
│   └── gen_assets.js     按清单用 AI 生成模板素材（替换网络原图）
├── fixtures/test_deck.json   标准测试文案（自测用）
├── projects/             每个 PPT 一个文件夹（deck.json + out/ + generated/）
├── TEMPLATE_SPEC.md      模板标准（第 6 节是 motion.json）
├── .agents/skills/       项目自带的 skill：ppt2-generate（做 PPT）、ppt2-template-intake（模板入库）
├── .claude/skills/       同上（Claude Code 读，用 npm run sync-skills 同步）
└── .env                  配图接口（Base URL / apikey / Model），不要分享
```

## 常用命令

```bash
node install.js                                                   # 第一次：装依赖 + 自测
node core/render.js projects/demo/deck.json                       # 生成
node core/render.js projects/demo/deck.json --images ai           # AI 配图（读 .env）
node core/render.js projects/demo/deck.json --images template     # 模板原图（不联网）
node core/render.js projects/demo/deck.json --animation auto      # 动画自动播放；original = 和原模板一样（默认）；off = 只留翻页
node core/render.js projects/demo/deck.json --template other-id   # 换模板，内容不变
node core/render.js projects/demo/deck.json --preview --pdf       # 顺便出总览图和 PDF

python3 tools/motion_extract.py 原模板.pptx work/motion           # 入库：抽出原模板的动效
node core/selftest.js navy-journey                                # 入库自测
python3 tools/motion_extract.py projects/_selftest_navy-journey/max/max.pptx work/check   # 核对生成的 PPT 动效
```

Windows PowerShell 一样用，例如 `node core\render.js projects\demo\deck.json --images ai`。

## 动效怎么来的

1. `motion_extract.py` 读原 .pptx 每页的 `<p:transition>` 和 `<p:timing>`，列出「第几下单击 → 哪个元素 → 什么效果」，每种效果的 XML 原样保存（目标元素换成 `{SPID}` 占位）。
2. 入库时把这些效果写进 `templates/<id>/motion.json`，按页面类型排好顺序（例如内容页：页眉从左擦除 → 正文从底擦除）。
3. 模板的 build.js 用 `ctx.g("header")`、`ctx.g("body")` 给元素分组；引擎把同组元素包成一个组合（和原模板一样整块动），再按 motion.json 写入。
4. 生成时可选：和原模板一样（默认）/ 自动播放（效果不变，单击改成自动）/ 不要入场动画（翻页保留）。

LibreOffice 的预览图里看不到动效，要在 PowerPoint 里放映才看得到；低版本 PowerPoint / WPS 不支持的新式翻页会自动退回原模板写好的替代效果（例如飞过 → 淡出）。
