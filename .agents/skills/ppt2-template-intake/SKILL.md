---
name: "ppt2-template-intake"
description: "把一个 .pptx 模板做进 PPT 模板库（ppt-make2.0）时使用：分析版式、从原 .pptx 原样抽出翻页效果和入场动画写成 motion.json、写 meta.json 和按页面类型分函数的 build.js、跑入库自测并逐页看图修到通过。用户说「模板入库」「把这个模板做进库」「动效按原 PPT 来」时使用。"
---

# 模板入库（.pptx → 标准模板，动效照原模板）

把一个 .pptx 模板做成 `templates/<id>/`，通过自测后直接放进模板库，「PPT 生成」（ppt2-generate）会自动用上。

**动效必须和原模板一样。** 原模板每页用了什么翻页、哪个元素在第几下单击时用什么效果出现，都要原样还原。做法是用 `tools/motion_extract.py` 把原文件里的效果 XML 直接抽出来，写进 `templates/<id>/motion.json`；build.js 只负责给元素分组，引擎按 motion.json 写入。

**先读 `TEMPLATE_SPEC.md`**（页面类型、字数上限、ctx API、第 6 节动效），再把 `templates/navy-journey/` 的 `build.js` + `motion.json` 当完整范例看一遍。

> **在其他 AI 工具里用**：文中的 `AskUserQuestion`（选择题）、`SendUserFile`（发文件）、`device_*`（操作用户电脑）是 Claude 的工具名。没有的话用等价做法：选择题在对话里列 A / B / C；发文件就告诉用户完整路径；在用户电脑上的工具直接在项目根目录执行命令。

## 第 0 步：准备

1. 拿到模板库：就是本 skill 所在的项目文件夹（根目录有 `core/motion.js`）。在 claude.ai / 桌面 App 里：连接文件夹后能用 `device_bash` 就直接在用户电脑上做；用不了就用 `device_stage_files` 把 `core/`、`tools/`、`fixtures/`、`package.json`、`templates/<范例>` 搬进工作区做，结果用 `device_commit_files` 写回。没有 `node_modules/` 就先 `npm install`。
2. 拿到用户的 .pptx。开工前一次问清（AskUserQuestion，已说过的跳过）：
   - 模板叫什么、id 用什么（小写英文，如 `navy-journey`）
   - 风格标签和适合的主题（不知道就看完模板后给建议让用户确认）
   - 是否要分享 / 收费（决定要不要马上把原图全部换成 AI 图）

## 第 1 步：分析版式

```bash
mkdir -p work/src && cd work/src && unzip -q -o ../../template.pptx      # 解压到新的空目录
```
- 渲染成图：soffice 转 PDF → `pdftoppm -jpeg -r 50` → 逐页看（可用 `core/preview.js` 的 `grid` 拼总览）。
- 读 `ppt/theme/theme1.xml` 取配色和字体；读各 `ppt/slides/slideN.xml` 取关键元素坐标（EMU ÷ 914400 = 英寸）和字号（sz ÷ 100 = pt）。注意组合里的子元素坐标是组内坐标，以渲染图为准。
- 把 `ppt/media/*` 拷到 `templates/<id>/assets/`（广告页、二维码等无关图片不要）。渐变矢量装饰可以用 `tools/pptx_extract.py` 抠成透明 PNG，简单的渐变条直接用 Pillow 画一张 PNG。
- 把原模板每一页对应到页面类型，列一张表（工作笔记）：

| 页面类型 | 借用原模板第几页 | 版式名 | 原页面的动效 |
|---|---|---|---|
| cover | p1 | hero | 四角出现 → 标题随机线条 → 副标题劈裂 |
| points4 | p5、p21 | ring、quad | 页眉从左擦除 → 正文圆形缩小 2 秒 |
| quote | （无） | night | 新设计，沿用章节页的效果 |

每个**必需类型**（cover toc section points3 points4 compare stats timeline imageText quote closing）至少 1 个版式；原模板没有的，按模板的视觉语言自己设计。常用类型（points3/points4/imageText/compare/stats）争取 2 个版式。可选类型（table/steps）原模板有就做。

## 第 2 步：抽动效，写 motion.json（最重要）

```bash
python3 tools/motion_extract.py template.pptx work/motion
```
输出两个文件：
- `motion_source.md`：中文清单。每页的翻页效果，以及「第几下单击 → 哪个元素（名字、位置、文字）→ 什么效果、方向、时长」。翻页后不用单击就自动开始的步骤标「翻页后自动」。**逐页读一遍**，对照渲染图搞清楚每个动画作用在页面的哪一块（标题栏？整块正文？每个条目单独？）。
- `motion_source.json`：同样的内容，带原始 XML。`effects` 里每种效果的 `xml` 已经把目标 id 换成了 `{SPID}`、时间节点 id 换成了 `{ID}`，可以直接复制进 motion.json。

然后写 `templates/<id>/motion.json`（格式见 TEMPLATE_SPEC 第 6 节，范例 `templates/navy-journey/motion.json`）：
1. `transitions`：把原模板用到的翻页 XML 原样复制进来（`slides[n].transition.xml`），起个 key；`transition` 写默认那个。个别页面类型翻页不同就写 `pageTransition`。原模板每页翻页都不一样时，按页面类型分别对应。
2. `effects`：把用到的效果从 `motion_source.json → effects` 复制过来，key 改成好记的名字（`wipeLeft`、`circleIn`…），保留 `name`、`durMs`、`xml`，加一个 `from` 写来自原模板第几页。
3. `pages`：每种页面类型（需要时细到 `类型.版式`）按原页面的顺序写步骤。组名自己定，build.js 里用同样的名字：
   - 原模板整块一起动的（一个组合）→ 一个组，如 `header`、`body`。
   - 原模板每个条目单独动的 → `item0`、`item1`… 写成 `{"g": "item*", "fx": "wipeBottom"}`，几条就展开几步。
   - 同一下单击里几个元素一起动 → 第一步 `trig: "click"`，其余 `"with"`；通配展开时用 `"rest": "with"`；效果轮流用就把 `fx` 写成数组（如目录卡片上下交替）。
   - 原模板写的是「单击时」但上一步一开始就自动跟着播放（清单里标「跟着上一步自动播放」）→ `"chain": true`。
   - 原模板每页翻完就自动连播（清单里第一步标「翻页后自动」）→ motion.json 顶层写 `"autoStart": true`，每页第一步照原模板写 `"trig": "with"` 或 `"after"`，后面的步骤也照抄「同时 / 之后」。范例 `templates/orange-flat/motion.json`。
   - 原页面某块本来就不动 → `{"g": "body", "static": true}`，不要自己加动画。
   - 新设计的页面类型 → 借用原模板最接近的页面的动效（在 `_from` 里写清楚借了哪页）。**不要发明原模板里没有的效果。**
   - 大部分内容页动效相同时写 `default`，特殊的再单独写。
4. 每一步可以加 `_from` 写对应原模板第几页，方便以后查。

## 第 3 步：写 meta.json

字段按 TEMPLATE_SPEC 第 3 节，包括 `"motion": "motion.json"`。注意：
- `tone` 要准（深色 / 浅色 / 彩色），3 选 1 靠它拉开差异。
- `layouts` 必须和 build.js 里实际实现的版式名完全一致。
- `imageStyle` 写和模板配色、气质一致的画风描述（结尾写「画面中不要出现任何文字、Logo 或水印」）。
- `description` ≤ 40 字，写给最终用户看。

## 第 4 步：写 build.js

结构照 navy-journey：设计令牌（颜色、字体）→ 排版组件 → 每种页面类型一个函数 → `render(deck, ctx)` 里 `ctx.renderAll({...})`。

**给元素分组（决定怎么动）**：要一起动的元素用同一个组名，`objectName: ctx.g("header")`；需要说明时 `ctx.g("body", "标题")`。引擎会把同组元素包成 PowerPoint 的「组合」，按 motion.json 加动画，和原模板一样整组擦出来。没写组名的元素（背景、底色块）保持静止。同一组的元素尽量连续添加（组合放在最后一个成员的位置，影响上下层次）。图片：`ctx.pic(..., { name: ctx.g("body", "照片") })`。

硬性要求（自测会查）：
1. **装得下上限**：字数拉满不溢出。标题、标签用 `ctx.fit` / `ctx.fitLine` 自动缩字，纵向堆叠用 `ctx.measure` 算高度，窄框正文用 `ctx.balance`。正文 ≥ 11pt。大号数字要把 `lineSpacingMultiple` 设成 1.0，框高按 字号 ÷ 72 × 1.2 算。
2. **最少时不空洞**：列表条数少、可选字段为空时，整组元素不画或版式自适应（按条数算列数 / 间距 / 卡片高度）。
3. **所有非空文字槽位都要显示**；文字不能画进图片里（原模板的书法字图片要换成可编辑文字）；不写死示例文案。
4. `ctx.addSlide(s, { master, bg })` 必须传 bg（背景色，或 `"image"`）。
5. 图片一律 `ctx.pic(slide, s, idx, …, { fallback: "原图.jpg" })`；装饰文字 objectName 带「装饰」（不参与质检）。
6. 一个类型有多个版式时用 `ctx.pickLayout(s, 候选)`，候选可以按内容过滤（如数值才给 chart）。
7. 浅色底不放白字；浅驼等浅色块上放白字时用加深的颜色；文字离左右边缘 ≥ 0.3"。

## 第 5 步：自测 + 看图 + 核对动效（循环到通过）

```bash
node core/selftest.js <id>
```
- 自测会检查 motion.json：翻页和效果的 XML 都在、`{SPID}` 占位符在、每种页面类型都有动画（或 default）。渲染时如果页面上有组但 motion.json 没写，会提示「会保持静止」：要么补上动画，要么写成 `static`。
- 有错误：看 `projects/_selftest_<id>/{sample,max,min}/*.report.json` → `issues`，改 build.js 再跑。
- **必须自己看图**：`max/max_preview/overview.jpg`、`min/min_preview/overview.jpg`、`templates/<id>/preview/overview.jpg`，可疑页用 Read 放大。检查拥挤、重叠、空洞、风格是否一致、图片裁切。
- **核对动效**：把生成的 PPT 再抽一次，和原模板的清单对照：
  ```bash
  python3 tools/motion_extract.py projects/_selftest_<id>/max/max.pptx work/check
  ```
  逐页对比 `work/check/motion_source.md` 和第 2 步的清单：翻页一样、单击次数一样、每一下的效果 / 方向 / 时长一样、作用的区域对应。
- 通过标准：meta 和 motion.json 无错误；3 套 deck 质检无错误；validate.py PASSED；看图无明显问题；动效核对一致。

## 第 6 步：交付

- 连接了模板库文件夹：模板已在 `templates/<id>/`（stage 方式工作时用 `device_commit_files` 写回 `build.js`、`meta.json`、`motion.json`、`assets/*`、`preview/*`）。
- 否则把 `templates/<id>/` 打包成 zip 发给用户，告诉他解压到模板库的 `templates/` 下。
- 生成预览卡片给用户确认：`node core/card.js --ids <id> --title "示例标题"`。
- 回复：页面类型 / 版式数量、哪些是新设计的、动效对照表（原模板第几页 → 哪些页面类型用它的效果）、自测结果、版权提醒（原图是否为网络素材）。
- 不改 `core/` 引擎和其他模板。发现标准本身需要调整，告诉用户并说明理由，商量后再改 TEMPLATE_SPEC + core/spec.js。
