/** Generate the "page types and word limits" table for TEMPLATE_SPEC.md from spec.js: node core/spec-table.js */
const { PAGE_TYPES } = require("./spec");
const fmt = (k, d) => {
  if (d.t === "text") return `\`${k}\` ≤${d.max}${d.required ? "（必填）" : ""}`;
  if (d.t === "image") return `\`${k}\` 配图${d.required ? "（必填）" : ""}`;
  if (d.t === "icon") return `\`${k}\` 图标名`;
  if (d.t === "chart") return `\`${k}\` 图表设置（可选）`;
  if (d.t === "rows") return `\`${k}\` ${d.min}～${d.max} 行，每格 ≤${d.cellMax}`;
  if (d.t === "group") return `\`${k}\` { ${Object.entries(d.of).map(([a, b]) => fmt(a, b)).join("，")} }${d.required ? "（必填）" : ""}`;
  if (d.t === "list") {
    const n = d.min === d.max ? `${d.min}` : `${d.min}～${d.max}`;
    const inner = d.of === "text" ? `每条 ≤${d.itemMax}` : `每条 { ${Object.entries(d.of).map(([a, b]) => fmt(a, b)).join("，")} }`;
    return `\`${k}\` ${n} 条，${inner}${d.required ? "（必填）" : ""}`;
  }
  return `\`${k}\``;
};
const rows = Object.entries(PAGE_TYPES).map(([k, v]) =>
  `| \`${k}\` | ${v.name}${v.required ? "" : "（可选）"} | ${Object.entries(v.slots).map(([a, b]) => fmt(a, b)).join("<br>")} |`);
console.log("| type | 页面 | 槽位与字数上限 |\n|---|---|---|\n" + rows.join("\n"));
