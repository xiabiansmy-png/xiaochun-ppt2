/**
 * 模板标准的机器可读版本（与 TEMPLATE_SPEC.md 保持一致）
 * ------------------------------------------------------------------
 * - PAGE_TYPES：每种页面类型的内容槽位 + 字数上限
 * - 字数按「字」计：汉字 / 全角符号 = 1，大写英文字母 = 0.7，其他半角字符（小写字母、数字、符号、空格）= 0.5
 * - 模板必须能装下「上限」长度的内容而不溢出；内容方（deck.json）不得超过上限
 *
 * 槽位写法：
 *   { t: "text", max: 16, required: true }                       文字
 *   { t: "list", min: 3, max: 3, of: { head: {...}, body: {...} } } 条目数组
 *   { t: "image" }                                                配图：{ prompt, query?, alt? } 生成，或 { file, focus?, alt? } 用户自己的照片（相对项目文件夹）
 */
const ENGINE_VERSION = "1.0";

const T = (max, required = false) => ({ t: "text", max, required });
const IMG = (required = false) => ({ t: "image", required });

/** 每页都可以带的公共字段 */
const COMMON = {
  id: { t: "id", required: true },         // 页面唯一 id（s01、s02…），改稿时用来定位，配图缓存也按它命名
  type: { t: "type", required: true },
  layout: { t: "layout" },                 // 指定版式；不写则由模板自动轮换（相邻页不重复）
  eyebrow: T(16),                          // 标题上方的小标签，如 "01 · WORK"；不写则模板可自动生成或省略
  notes: { t: "notes" },                   // 演讲稿，写进备注，不限字数
  source: T(60),                           // 数据 / 引文出处；stats 页必填
  images: { t: "images" },                 // 额外配图 [{prompt,…}]：多图版式用第 2、3… 张；不写则由主图提示词派生
};

const PAGE_TYPES = {
  cover: {
    name: "封面",
    required: true,
    slots: { title: T(16, true), subtitle: T(24), desc: T(50), tag: T(16), image: IMG() },
  },
  toc: {
    name: "目录",
    required: true,
    slots: {
      title: T(6), desc: T(40),
      items: { t: "list", min: 3, max: 8, required: true, of: { head: T(8, true), sub: T(12) } },
      image: IMG(),
    },
  },
  section: {
    name: "章节页",
    required: true,
    slots: {
      title: T(12, true), en: T(24), desc: T(44),
      keywords: { t: "list", min: 0, max: 5, of: "text", itemMax: 4 },
      image: IMG(),
    },
    // part（PART 01 …）由引擎按 section 出现顺序自动编号，写进 slide._part
  },
  points3: {
    name: "3 要点",
    required: true,
    slots: {
      title: T(16, true), lead: T(40),
      items: { t: "list", min: 3, max: 3, required: true, of: { head: T(8, true), body: T(30, true), icon: { t: "icon" } } },
      conclusion: T(36), image: IMG(),
    },
  },
  points4: {
    name: "4 要点",
    required: true,
    slots: {
      title: T(14, true), lead: T(40),
      items: { t: "list", min: 4, max: 4, required: true, of: { head: T(6, true), body: T(22, true), icon: { t: "icon" } } },
      conclusion: T(40), image: IMG(),
    },
  },
  compare: {
    name: "对比",
    required: true,
    slots: {
      title: T(16, true), lead: T(40),
      left: { t: "group", required: true, of: { head: T(8, true), icon: { t: "icon" }, items: { t: "list", min: 2, max: 4, required: true, of: "text", itemMax: 16 } } },
      right: { t: "group", required: true, of: { head: T(8, true), icon: { t: "icon" }, items: { t: "list", min: 2, max: 4, required: true, of: "text", itemMax: 16 } } },
      conclusion: T(40), image: IMG(),
    },
  },
  stats: {
    name: "数据",
    required: true,
    slots: {
      title: T(16, true), lead: T(50),
      items: { t: "list", min: 2, max: 4, required: true, of: { value: T(6, true), label: T(16, true) } },
      chart: { t: "chart" },               // 可选：{ type: "bar", unit: "百万个", title: "≤20字" }，数值取 items 的 value 数字部分或 chart.values
      source: T(60, true),
      image: IMG(),
    },
  },
  timeline: {
    name: "时间线",
    required: true,
    slots: {
      title: T(20, true), lead: T(44),
      items: { t: "list", min: 3, max: 5, required: true, of: { time: T(6, true), head: T(6, true), body: T(20) } },
      conclusion: T(36),
    },
  },
  imageText: {
    name: "大图配文",
    required: true,
    slots: {
      title: T(16, true), body: T(80, true),
      points: { t: "list", min: 0, max: 3, of: "text", itemMax: 20 },
      conclusion: T(36), image: IMG(true),
    },
  },
  quote: {
    name: "金句 / 引言",
    required: true,
    slots: { text: T(40, true), author: T(20), image: IMG() },
  },
  closing: {
    name: "结尾",
    required: true,
    slots: { title: T(16, true), body: T(60), tag: T(16), image: IMG() },
  },

  /* ---------- 可选页面类型：模板可以不实现；生成前先查 meta.pageTypes ---------- */
  table: {
    name: "表格",
    required: false,
    slots: {
      title: T(16, true), lead: T(40),
      columns: { t: "list", min: 2, max: 4, required: true, of: "text", itemMax: 8 },
      rows: { t: "rows", min: 2, max: 5, required: true, cellMax: 18 },
      conclusion: T(40), image: IMG(),
    },
  },
  steps: {
    name: "步骤",
    required: false,
    fallback: "timeline", // 模板没实现时，引擎把 step 转成 timeline（time = STEP 01…）
    slots: {
      title: T(16, true), lead: T(50),
      items: { t: "list", min: 3, max: 4, required: true, of: { head: T(10, true), body: T(30, true) } },
      image: IMG(),
    },
  },
};

const REQUIRED_TYPES = Object.keys(PAGE_TYPES).filter((k) => PAGE_TYPES[k].required);

/** 字数：汉字 / 全角 = 1，大写字母 = 0.7，其他半角 = 0.5（换行不计） */
function charLen(s) {
  let n = 0;
  for (const ch of String(s ?? "").replace(/\n/g, "")) n += ch.charCodeAt(0) >= 0x2000 ? 1 : /[A-Z]/.test(ch) ? 0.7 : 0.5;
  return n;
}

/** 页面类型 → 翻页效果分组 */
const TRANSITION_KIND = { cover: "cover", section: "divider", closing: "closing" };

module.exports = { ENGINE_VERSION, PAGE_TYPES, REQUIRED_TYPES, COMMON, charLen, TRANSITION_KIND };
