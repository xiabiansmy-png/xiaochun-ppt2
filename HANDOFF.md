# 交接文档：PPT 模板库

> 写于 2026-11-25。

## 一、目标

用户上传一个 PPT 模板，入库后用它生成的 PPT，特效和动画完全按上传的 PPT 来：每页的翻页效果、哪一下单击、哪一块、什么效果、什么方向、多长时间，都和原模板一样。

## 二、组成

| 部分 | 文件 |
|---|---|
| 渲染入口 | `core/render.js`：校验 → 配图 → 模板绘制 → 写入动效 → 质检 → 报告 |
| 动效 | `core/motion.js`（按 motion.json 分组、写翻页和动画）、`tools/motion_extract.py`（从原 .pptx 抽动效） |
| 绘制 | `core/engine.js`（ctx：pickLayout、pic、fit / measure / balance、`ctx.g` 分组） |
| 配图 | `core/images.js`、`core/gen_image.js`、`core/photos.js`（AI / 网图 / 模板原图 / 用户照片） |
| 质检 / 预览 | `core/qa.js`、`core/textfit.js`、`core/preview.js` |
| 3 选 1 | `core/select.js`、`core/card.js` |
| 标准 / 自测 | `TEMPLATE_SPEC.md`、`core/spec.js`、`core/validate-deck.js`、`core/selftest.js`、`fixtures/test_deck.json` |
| skill | `.agents/skills/ppt2-generate`（做 PPT）、`.agents/skills/ppt2-template-intake`（模板入库） |
| 模板 | `templates/navy-journey/`「深蓝新程」、`templates/sage-blossom/`「莫兰迪花语」、`templates/orange-flat/`「橙意扁平」 |

## 三、动效流水线

1. **抽**：`python3 tools/motion_extract.py 原模板.pptx work/motion` → `motion_source.md`（中文逐页清单）+ `motion_source.json`（原始 XML，目标 id 换成 `{SPID}`，时间节点 id 换成 `{ID}`）。只用 Python 标准库。
   主序列下的每个顶层 `<p:par>` 算一组（不认 `nodeType="clickPar"` 标记，有的软件导出时不写它）；翻页后不用单击就开始的组，清单里标「翻页后自动」。
2. **写**：`templates/<id>/motion.json` = 翻页 XML + 效果 XML + 每种页面类型的步骤（组名、效果、单击 / 同时 / 之后、chain、static、通配 `item*`）。原模板每页翻完自动连播时，顶层加 `"autoStart": true`，每页第一步照原模板写 `with` / `after`。格式见 TEMPLATE_SPEC 第 6 节。
3. **分组**：build.js 里 `objectName: ctx.g("header")`。引擎把同组的顶层元素包成 `<p:grpSp>`（放在最后一个成员的位置），和原模板一样整块动。
4. **写入**：`core/motion.js` 在 `</p:clrMapOvr>` 后写翻页，再写 `<p:timing>`。结构照抄 PowerPoint：每次单击一个 clickPar，里面按先后分段，同一段的效果「与上一动画同时」。`chain` = 原模板封面那种「单击时 + onBegin 跟上一步」的写法。`autoStart` = 第一组带 `onBegin`（跟主序列开始），第一个效果是「同时 / 之后」，不写 clickPar 标记，和这种原模板的写法一样。
5. **模式**：`settings.animation` = `original`（默认，和原模板一样）/ `auto`（单击改成「上一动画之后」，翻页后自动播放）/ `off`（只留翻页）。
6. **核对**：对生成的 PPT 再跑一次 motion_extract，和原模板清单逐页对比。

## 四、模板：navy-journey「深蓝新程」

- 来源：网络模板「新岁启封 共赴未来 · 2027 年终总结」（1ppt.com），25 页（最后一页是网站广告，已丢弃）。原文件和动效清单在 `templates/navy-journey/source/`。
- 原模板动效：翻页全部「飞过」0.8 秒（低版本回退淡出）；7 种入场效果：出现、随机线条（水平）、劈裂（左右向中央收缩）、擦除（自左 / 自底 / 自顶）0.5 秒、形状圆形缩小 2 秒；全部单击触发，封面第 2、3 步跟着第 1 步自动播放。
- 13 种页面类型、23 个版式；自测 sample / max / min 三套 0 错误 0 提示，validate.py 全部 PASSED；对生成的 PPT 重新抽动效，效果 XML 和原文件逐字节一致。
- 原模板没有的版式：目录 list、对比 cards、数据 numbers、金句 night、表格 grid。它们的动效借用原模板最接近的页面（motion.json 每步的 `_from` 写了来源）。
- 原模板第 7、17 页只有页眉动，照片和正文是静止的：对应的 points3.photos、steps.wave 也只有页眉动（写成 `static`）。
- 字体：微软雅黑；封面标题用楷体代替原模板的书法字图片（图片里的字不能编辑）。云端预览没有楷体会显示成宋体。
- 背景图里有「2027」字样，适合 2027 年的年终 / 新年主题。
- 版权：assets/ 是原模板图片，只能自用；分享前要换成 AI 生成的图片。

## 五、模板：sage-blossom「莫兰迪花语」

- 来源：网络模板「文艺清新毕业论文答辩」（WPS 制作，20 页）。原文件在 `templates/sage-blossom/source/`。暖灰白底 #F0ECE9 + 灰绿 #747E6D + 豆沙红 #B87271，四角有机色块、绿叶、线描小花，背景大片浅灰叶影。
- **原模板没有任何动效**：20 页的 `<p:transition/>` 都是空的，也没有 `<p:timing>`（`source/motion_source.md` 可查）。用户选择「设计一套克制的动效」，所以 motion.json 是新设计，是库里唯一一个动效不来自原文件的模板：翻页统一淡出 0.7 秒；每页单击一次，页眉从左擦除 → 正文淡入（自动接着播放）；目录条目、时间线节点依次淡入。以后用户如果在 PowerPoint 里给原文件加了动画，可以重新抽取替换。
- 12 种页面类型（没做可选的 steps，引擎会转成 timeline）、18 个版式。新设计的版式：stats numbers / chart、quote leaf、table grid。自测 sample / max / min 三套 0 错误 0 提示，validate.py 全部 PASSED；对生成的 PPT 重新抽动效，每页 1 次单击，和 motion.json 一致（`source/motion_check_generated.md`）。
- 装饰：原模板的装饰是 4 张 1920×1080 透明 PNG 按 srcRect 裁出来用的，入库时已按原坐标裁成 8 张小图（`assets/deco_*.png`），build.js 按原位置摆放，名字带「装饰」，不参与质检和动画。
- 字体：标题华文中宋（原模板是思源宋体 CN Heavy，多数电脑没装），正文微软雅黑。云端预览没有宋体，会显示成黑体。
- 版权：花叶装饰和照片都是原模板素材，只能自用。

## 六、模板：orange-flat「橙意扁平」

- 来源：网络模板「20XX 工作总结汇报」，25 页（最后一页是结束页，做成 closing）。原文件和动效清单在 `templates/orange-flat/source/`。
- 原模板动效：翻页全部「门」1.4 秒（低版本回退淡出）；18 种入场效果（飞入 8 个方向、淡化、浮入、下降、基本缩放、擦除左 / 右 / 顶、切入、翻转式由远及近、随机线条）；**每页翻完自动连播，没有单击步骤**（motion.json 写 `autoStart`）。内容页的标题栏在原模板里不动，这里也不动。
- 标志元素：圆角三角「拨片」用原模板的贝塞尔路径画成可编辑自定义形状（build.js 的 PICK_PATH，旋转 / 翻转照原模板）；45° 长投影按轮廓拉伸后渐变，生成透明 PNG（名字带 static，质检当透明层）；拨片照片 = 按外框取图 + 同一路径做蒙版。
- 13 种页面类型、20 个版式；自测 sample / max / min 三套 0 错误 0 提示，validate.py 全部 PASSED；重新抽动效：每页都是「翻页后自动」、0 个单击步骤、效果 XML 和原文件逐字节一致。
- 原模板没有的版式：数据 numbers、金句 pick、表格 grid，动效分别借原第 21 页、章节页、第 4 页（`_from` 写了来源）。
- 封面 / 内容页右下角的导航条显示 deck 里各章节名（最多 4 个），没有章节就不显示。
- 版权：assets/ 是原模板照片，只能自用；分享前要换成 AI 生成的图片。

## 七、踩过的坑

- pptxgenjs 的三角形叫 `ISOSCELES_TRIANGLE`，不是 `TRIANGLE`。
- 大号数字（76～110pt）默认行距 1.25 会被质检判溢出：设 `lineSpacingMultiple: 1.0`，框高 = 字号 ÷ 72 × 1.22。
- 先 balance 再量高度：T() 里会自动 balance，Hh() 量的是原文，窄框里两者行数可能不同，质检会报溢出或单字掉行。
- 浅驼 #D9C3B4 上放白字对比度不够，有白字的驼色块用 #A88568。
- wipe 的方向写法：presetSubtype 8 = 自左侧，滤镜 `wipe(left)`；4 = 自底部，`wipe(down)`；1 = 自顶部，`wipe(up)`。直接复制原 XML，不用记。
- 云端连不上用户 localhost 中转，AI 配图要在用户电脑上跑。用户电脑上的 device_bash 起不来时，只能 stage / commit；`.claude/` 目录远程写不了，要用户自己运行 `npm run sync-skills`。

- 质检的行高估算比「字号 ÷ 72 × 1.3」高：单行标题框高直接用 `Hh(文字, {w, fontSize})` 算，别手算。
- 灰字 #8C8C8C 在 #F0ECE9 底上对比度只有 2.9，要用 #767676 以上。
- Georgia 不含中文：「9.5 小时」这种带中文单位的数值要换成中文字体，不然中文回退后变宽、会换行。
- 卡片 / 面板里的文字放不下时，先缩照片、收间距，再降到 12pt（compare.cards、points3.panel 的写法）。
- 解构参数别叫 `valueOf`：`{ valueOf } = {}` 拿到的是 Object.prototype.valueOf，不是 undefined。
- 环形图（BLOCK_ARC）中间写字，质检按外框算底色会判成和文字同色：在弧里面再垫一个白色圆。

## 八、下一步

- 用 ppt2-generate 拿一篇真实文案跑一遍全流程，在 PowerPoint 里放映检查动效。
- 再入库几个模板（最好有每页翻页不同、有强调 / 退出 / 动作路径动画的），验证 motion_extract 对更多效果的覆盖。
- 需要分享时，把 navy-journey、sage-blossom、orange-flat 的图片换成 AI 图。
- 在 PowerPoint 里放映一次 orange-flat，确认「门」翻页后整页自动连播。
- sage-blossom 用真实答辩文案跑一遍，在 PowerPoint 里看宋体标题和淡入效果。
