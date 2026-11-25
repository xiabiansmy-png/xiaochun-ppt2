---
name: "ppt2-generate"
description: "在 PPT 模板库（ppt-make2.0，根目录有 core/motion.js）里做 PPT 时使用，用户提到「深蓝新程 / 动效和原模板一样」也用：从库里挑 3 个模板让用户选，用 core/render.js 生成 .pptx，翻页和入场动画和原模板 PPT 一模一样，带配图，用户的照片可由 AI 看图分配；支持改页、换版式、整份换模板。"
---

# PPT 生成（动效跟原模板走）

每个模板的翻页效果和入场动画，都是入库时从原模板 .pptx 里原样抽出来的（`templates/<id>/motion.json`），生成时照着写进去。同一个模板做出来的 PPT，动起来和原模板一模一样。

主题 / 文案 → 模板 3 选 1 → 一次性设置 → （分配用户照片）→（确认大纲）→ 自动生成并质检 → 交付 → 局部修改。
代码和模板都在**模板库**里（根目录有 `core/`、`templates/`、`TEMPLATE_SPEC.md`），本 skill 只讲流程。

> **硬性规则（违反就不是用户要的样式）**
> 1. PPT 只能由模板库的 `node core/render.js <deck.json>` 生成。你只写 `deck.json`（内容），**不要自己写 pptxgenjs / python-pptx / HTML 代码去画页面**，也不要改 `templates/` 里的文件。
> 2. **不要改用其他 PPT 类 skill**（如 ppt-master、pptx、slides、lark-slides 等）或通用做法替代本流程。
> 3. 模板只能从 `templates/` 里选（`node core/select.js` 列出的那些）；用户指定了模板就在 deck.json 里写 `settings.template`。
> 4. 找不到模板库或 `core/render.js` 跑不起来时，停下来告诉用户原因，不要自己另做一份。

> **在其他 AI 工具里用**：文中的 `AskUserQuestion`（选择题）、`SendUserFile`（发文件）、`device_*`（操作用户电脑）是 Claude 的工具名。你的工具里没有的话就用等价做法：选择题直接在对话里列出 A / B / C 让用户回复；发文件就告诉用户文件的完整路径（预览图能显示就直接显示）；在用户电脑上运行的工具直接在项目根目录执行命令。

开工前先读模板库的 `README.md` 和 `TEMPLATE_SPEC.md`（页面类型字数上限、deck.json 格式）。

## 第 0 步：拿到模板库

**模板库就是本 skill 所在的项目文件夹**：本文件在 `<模板库>/.agents/skills/ppt2-generate/`（或 `.claude/skills/`）里，往上三级就是根目录（有 `core/render.js`、`templates/`）。

按顺序找：
1. 当前工作目录（或它的上级）里有 `core/render.js` + `templates/`（在项目文件夹里打开的 Codex / Claude Code）→ 直接在根目录运行命令，项目放在 `projects/` 下。
2. 在 claude.ai / Claude 桌面 App 里：用户已连接的文件夹里有 `core/render.js` + `templates/` → 能用 `device_bash` 就直接在用户电脑上运行（AI 配图只能在那里生成）；启动失败就用 `device_stage_files` 把 `core/`、`templates/`、`fixtures/`、`package.json` 搬进工作区（每次最多 50 个文件，分几次），在工作区里做，结果用 `device_commit_files` 写回。
3. 对话里上传了模板库 zip → 解压到一个新的空目录。
4. 都没有 → 请用户在模板库文件夹里打开，或连接文件夹 / 上传 zip，拿到之前不写代码。

依赖：在库根目录 `node -e "require('pptxgenjs');require('sharp');require('react-icons/fi')"`，缺了（或没有 `node_modules/`）就先运行 `npm install`（第一次使用时会这样，不用问用户；要求 Node 18+）。**绝不打印或引用 `.env` 里的 key。**

## 第 1 步：问题集中在前面问完（最多两轮，之后全自动）

**第一轮** —— 用户没说想要的风格就问（AskUserQuestion，选择题）：简洁 / 科技 / 商务 / 文艺 / 国潮 / 其他（可自己填）。已经说了就跳过。

同时把内容拆成结构化大纲（内部草稿，先不展示）：需要几页、有没有数据 / 时间线 / 对比、配图多少。

**3 选 1：**
```bash
node core/select.js --style 文艺,简洁 --topic "主题或文案前几句" --json [--exclude 已看过的id]
node core/card.js --ids a,b,c --title "用户的标题" [--subtitle "副标题"] --out projects/<项目>/cards.jpg
```
用 SendUserFile 发 cards.jpg，再问：A / B / C / 换一批。**这一条消息只问选模板**：不要顺带列默认设置、不要说「按默认设置制作」、不要提依赖安装进度，等用户选完再进入第二轮。
- 「换一批」：把看过的 id 放进 `--exclude`；结果里 `exhausted: true` 时告诉用户「该风格的模板看完了，以下是相近风格」。
- 库里不足 3 个模板时，有几个给几个；只有 1 个就直接说明并跳过选择。
- 用户说有很多自己的照片时，优先推荐 `imageHeavy: true` 的模板（图框多，照片才用得上）。

**第二轮：设置选择题**（用户选完模板后，单独一条消息，一次问完 4 项。每项都是选择题，用户可以只回「默认」）

先检查库根目录有没有 `.env`（只看文件在不在，不读内容），决定配图的默认项：有 `.env` → 默认「AI 生成」；没有 → 默认「模板原图」，并在 AI 生成那一项后面注明「需先配置 key」。**用户提过有自己的照片，或者 `projects/<项目>/photos/` 里已经有照片 → 默认「用我自己的照片」。**

- **Claude**：用 AskUserQuestion，4 个问题放在一个问题框里，默认项放第一个并标「（推荐）」。
- **其他 AI 工具**：严格按下面的格式发，不加别的说明（★ 是默认项）：

```
已选：深蓝新程 ✅ 生成前确认 4 项：

1️⃣ 页数　　★a 标准 15～20 页　b 精简约 10 页　c 详细 25 页以上
2️⃣ 内容　　★a 补充核实过的数据和案例（标注来源）　b 严格按我的原文
3️⃣ 配图　　★a AI 生成　b 用我自己的照片（不够的自动补图）　c 网上找图　d 模板原图
4️⃣ 动画　　★a 和原模板一样（单击出现还是翻页后自动连播，都照原模板）　b 自动播放（效果不变，翻页后自动依次出现）　c 不要入场动画（翻页效果保留）

直接回「默认」，或者只写要改的，比如「3b 4c」
```

| 设置 | 选项 | deck.json |
|---|---|---|
| 页数 | 标准 15～20 / 精简约 10 / 详细 25+ | 决定 slides 数量 |
| 内容 | 补充数据和案例 / 严格按原文 | 影响写作 |
| 配图 | AI 生成 / 用我自己的照片 / 网上找图 / 模板原图 | `settings.imageSource`：ai / web / template；「用我自己的照片」= 有照片的图框写 `image.file`（见第 2.5 步），剩下的图框用 `imageSource` 补：有 `.env` 用 ai，没有用 template |
| 入场动画 | 和原模板一样 / 自动播放 / 不要 | `settings.animation`：original / auto / off（翻页效果三种都保留，跟原模板一样） |

- 用户在前面的消息里已经说过的项，从选择题里去掉；4 项都说过就跳过这一轮。
- 用户选了「AI 生成」但没有 `.env`：告诉用户「AI 配图需要接口地址和 key」，请他提供后写进 `.env`（不要复述 key）；不想配就改用模板原图。
- 用户选了「网上找图」但 `.env` 里没有 Pexels key：同样先说明，或者改用模板原图。
- 无人值守：全部用默认值（动画用 original），交付时说明。

## 第 2 步：写 deck.json

建 `projects/<项目英文简写>/deck.json`（格式见 TEMPLATE_SPEC 第 5 节）。规则：

1. **页面结构**：cover →（toc）→ 用 section 分 2～4 个部分 → closing。一页一个观点，相邻两页不用同一种类型。
2. **按内容选页面类型**：3 个并列要点 → points3；4 个 → points4；两种做法 / 前后对比 → compare；数字 → stats；演进 → timeline；一个场景 + 说明 → imageText；一句值得记住的话 → quote；表格 / 步骤 → table / steps（先查所选模板 `meta.pageTypes` 有没有）。
3. **字数上限是硬约束**：按 TEMPLATE_SPEC 第 4 节每个槽位的上限写（汉字 1、大写字母 0.7、其他半角 0.5）。不硬塞、不凑字，宁可删减。
4. **数据**：绝不编造数字。选了「允许补充数据」时先联网核实，把出处写进 `source`；`stats` 页 `source` 必填。「严格按原文」模式只用原文里的数字。
5. **配图**：每页 `image.prompt` 写中文画面描述（不要求画面里出现文字），`query` 写英文搜图词，`alt` 写替代文字。多图版式可加 `images`。
6. **演讲稿**：用户要演讲稿时写进每页的 `notes`。
7. `id` 用 s01、s02… 依次编号；之后增页用新 id（s21…），删掉的页面的 id 不再使用。

然后校验：`node core/validate-deck.js projects/<项目>/deck.json`，有错误就改到通过。

## 第 2.5 步：分配用户自己的照片（选了「用我自己的照片」才做）

用户把照片放进 `projects/<项目>/photos/`（可以有子文件夹）。照片在别的文件夹时，用 `--from` 复制进来。**不要修改、重命名或删除用户的原照片。**

1. **建索引和总览图**：
   ```bash
   node core/photos.js projects/<项目> [--from "照片所在文件夹"]
   ```
   会生成 `photos/_index.json`（编号、路径、横竖、比例、是否低清）和 `photos/_sheets/sheet_01.jpg …`（编号总览图，每张 12 格，照片完整显示）。手机竖拍的方向会自动转正。读不了的格式（如 HEIC）会列出来，请用户转成 JPG。
2. **看图**：用 Read 逐张看总览图。看完把每张照片的描述写进 `_index.json` 的 `desc`：画面内容、主体在画面哪里、适合放哪种页面、有没有问题（糊、暗、低清、有无关的人）。之后改页就不用再看一遍。
3. **查图框**：先渲染一次，拿到每个图框的位置和比例：
   ```bash
   node core/render.js projects/<项目>/deck.json --images template
   ```
   `out/*.report.json` 里的 `frames` 会逐个列出图框：`page`（第几页）、`id`、`idx`（第几张图：0 是 `image`，1 起是 `images[0]`…）、`aspect`（宽 ÷ 高，大于 1 是横框）。
4. **分配**（判断依据按重要性排）：
   - **内容对得上**：照片画面和这一页讲的事有关。团队合影、活动现场放封面、章节页或结尾；具体场景、产品、成果放大图配文页和要点页；数据页的图框放和这个数字相关的画面。
   - **横竖对得上**：横图进横框，竖图进竖框。比例差太多会被裁掉一大半（下面第 5 条会提示）。
   - **质量**：最清楚、构图最好的照片放大图框（整页、半页）；低清的只放小图框，或者不用。
   - **同一张照片只用一次**，照片不够时才重复。同一页的多张图（`images`）选风格接近的。
   - **主体不在画面中间**（人站在左边、产品在右下角）时写 `focus: [x, y]`，取值 0～1，表示要保留的中心点，例如 `[0.3, 0.45]`。
   - **不要为了用掉照片去编内容**。照片比图框多时，可以把某页换成图框更多的版式（`layout`，例如 3 张图的版式），或者问用户要不要加一页照片展示。
5. **写进 deck.json**：
   ```json
   "image": { "file": "photos/团队合影.jpg", "focus": [0.5, 0.35], "alt": "年会团队合影" },
   "images": [ { "file": "photos/IMG_2031.jpg" }, { "prompt": "没有合适照片时写提示词，按 settings.imageSource 补图" } ]
   ```
   路径相对项目文件夹（deck.json 所在的文件夹）。没分到照片的图框保留 `prompt`，按 `settings.imageSource` 补图。
6. **渲染后检查**：质检里 `kind: "photo"` 的提示表示照片被裁掉太多（只剩不到 55%）。这时换一张比例接近的照片、换版式，或者调 `focus`。然后看有照片的页面的缩略图，确认人脸和主体没被裁掉、没有被文字压住。
7. **交付时告诉用户**：哪几页用了哪张照片（用编号和文件名），哪些照片没用上、为什么（重复、模糊、和内容无关），哪些图框是补的图。

## 第 3 步：确认大纲（可跳过）

长文 / 正式场合：逐页列出（页码 · 类型 · 标题 · 要点，一页一行；用了用户照片的页面注明照片编号），问「按这个生成吗？还是要改哪里？」。短内容或用户说「直接生成」就跳过。

## 第 4 步：生成 + 自动质检（最多 3 轮）

```bash
node core/render.js projects/<项目>/deck.json --preview
```
- 选了 AI 配图、又是在云端工作区运行（连不上用户 localhost 中转）：先用 `--images template` 在云端检查版式，交付时告诉用户在自己电脑上运行 `node core/render.js projects/<项目>/deck.json --images ai`（配图有缓存，只会补图）。能在用户电脑上运行时，渲染前先告诉用户「共 N 张图，预计约 N×30 秒」。
- 读质检输出（也在 `out/*.report.json` → `issues`）：
  - `overflow` / `overlap` / `bounds` 错误 → **改 deck.json**（删字、拆页、换 `layout`），不改模板。
  - `orphan`（单字掉行）→ 增删一两个字；`contrast` / `fontsize` → 换版式；解决不了就记为模板问题。
- **看总览图**（`out/*_preview/overview.jpg`），可疑页用 Read 放大看：拥挤、空洞、图片裁切难看、残留模板示例文字。
- 修完重新渲染，3 轮后停，把剩余问题在交付时说明。
- 校验：有 pptx skill 时运行 `python3 <pptx skill>/scripts/office/validate.py out/xxx.pptx`，必须 PASSED；环境里没有这个脚本就跳过。

## 第 5 步：交付

- SendUserFile 发 .pptx + overview.jpg（总览图在对话里就能看）。用户要 PDF 就加 `--pdf` 渲染。
- 有连接文件夹时：deck.json、out/、generated/ 已经在项目文件夹里（stage 方式工作时要 commit 回去）。
- 回复几句话：页数和结构、所用模板、配图来源、动画设置（说明动效来自原模板，例如「翻页飞过，页眉从左擦除、正文从底擦除」，从 `out/*.report.json` 的 `motion` 读）、补充了哪些数据和出处、遗留问题。不要声称看过翻页 / 动画效果（渲染图里没有，要在 PowerPoint 里放映才看得到）。

## 第 6 步：修改循环（全部局部重做）

| 用户说 | 做法 |
|---|---|
| 改第 N 页的文字 | 改 deck.json 对应页 → 重新渲染（配图有缓存，只重画改过提示词的图） |
| 给第 N 页换个版式 | 从 `meta.layouts` 里该类型的另一个值写进 `layout` |
| 重新生成第 N 页的图 | 改该页 `image.prompt`（或删 `generated/` 里对应文件） |
| 第 N 页换一张照片 / 用第 K 张照片 | 改该页 `image.file`（照片编号见 `photos/_index.json`）；照片裁得不好就调 `focus` |
| 又加了一批照片 | 放进 `photos/` 后重新运行 `node core/photos.js`（已写的描述会保留），只看新增的照片再分配 |
| 增删页、调顺序 | 改 `slides`，新页用新 id |
| 整份换个模板 | 重走第 1 步的 3 选 1（排除当前模板），`--template <新id>`，内容不变；新模板缺某个可选类型时先把那几页改掉 |
| 动画太多 / 想自动播放 | 改 `settings.animation`：off（只留翻页）/ auto（自动播放）/ original（和原模板一样） |
| 想换一种动效 | 动效跟着模板走，不能单独换：换一个模板（内容不变），或者用「模板入库」（ppt2-template-intake）改这个模板的 motion.json |

改完重复第 4 步的质检，只重看改过的页，再交付。

## 注意

- 不要为了修内容去改 `templates/` 里的文件（包括 motion.json）；发现模板本身的毛病（例如字数在上限内仍溢出、某类页面不动），告诉用户应该用「模板入库」skill（ppt2-template-intake）修模板。
- 模板自带的图片多为网络素材：自用没问题，分享或收费的场合建议选 AI 配图或用户自己的照片。
- 用户的照片可能有人脸、证件等隐私内容：只用在这份 PPT 里，不要上传到别处。