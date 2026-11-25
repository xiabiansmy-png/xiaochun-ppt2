/**
 * 动效：按模板的 motion.json 写入翻页效果和入场动画
 * ------------------------------------------------------------------
 * 动效来自原模板 .pptx：入库时用 tools/motion_extract.py 原样抽出效果 XML，写进 templates/<id>/motion.json。
 * 所以 PowerPoint 里的任何效果（进入 / 强调 / 退出 / 动作路径、任何翻页）都能一模一样地还原。
 *
 * 模板 build.js 怎么配合：
 *   给要一起动的元素起同一个组名：objectName 写成 ctx.g("header") 或 ctx.g("item0", "标题")（= "M<组名>|说明"）。
 *   引擎把同组元素包成一个组合（和原模板一样整组动），再按 motion.json 给这些组加动画。没有组名的元素保持静止。
 *
 * motion.json 格式：
 * {
 *   "source": "原模板.pptx",
 *   "transition": "flythrough",                    默认翻页（transitions 里的 key；"none" = 无）
 *   "pageTransition": { "closing": "fade" },       可选：某些页面类型用别的翻页
 *   "transitions": { "flythrough": { "name": "飞过 0.8 秒", "xml": "<mc:AlternateContent …>" } },
 *   "effects": { "wipeLeft": { "name": "擦除·自左侧", "durMs": 500, "xml": "<p:par>…{SPID}…</p:par>" } },
 *   "pages": {                                     按页面类型查：先找 "类型.版式"，再找 "类型"，最后 "default"
 *     "cover":   [ { "g": "corner", "fx": "appear" }, { "g": "title", "fx": "randomBars", "chain": true } ],
 *     "toc":     [ { "g": "side", "fx": "wipeBottom" }, { "g": "card*", "fx": ["wipeTop", "wipeBottom"], "rest": "with" } ],
 *     "default": [ { "g": "header", "fx": "wipeLeft" }, { "g": "body", "fx": "wipeBottom" } ]
 *   }
 * }
 * 每一步：
 *   g      组名；以 * 结尾 = 所有以它开头的组（item0、item1…按编号排），页面上没有的组自动跳过
 *   fx     效果 key；数组 = 展开的组依次轮流用
 *   trig   "click"（默认，单击时）| "with"（与上一动画同时）| "after"（上一动画之后）
 *   rest   通配展开后，第 2 个起的触发方式（默认和 trig 一样）
 *   delay  延迟毫秒
 *   chain  true = 这一步虽然是「单击时」，但上一步一开始就自动跟着播放（原模板封面就是这样）
 *   static true = 这个组故意不动（原模板里就是静止的），只是声明一下，免得自测提示「没有动画」
 *
 * 顶层可选 "autoStart": true = 原模板每页翻页后动画自动开始（第一组是「上一动画之后 / 同时」，不用单击）。
 *   这时每页第一步写 "trig": "after" 或 "with"（照原模板），引擎让它在翻页后自动播放；后面的 "click" 步骤照旧要单击。
 *
 * 生成时的动画模式（deck.json settings.animation）：
 *   original（默认）和原模板一模一样 | auto 效果不变，单击改成「上一动画之后」自动播放 | off 不加动画（翻页照旧）
 */
const fs = require("fs");
const path = require("path");
const JSZip = require("module").createRequire(require.resolve("pptxgenjs"))("jszip");

const NS_DECL = {
  mc: "http://schemas.openxmlformats.org/markup-compatibility/2006",
  p14: "http://schemas.microsoft.com/office/powerpoint/2010/main",
  p15: "http://schemas.microsoft.com/office/powerpoint/2012/main",
  p159: "http://schemas.microsoft.com/office/powerpoint/2015/09/main",
};

function loadMotion(templateDir) {
  const f = path.join(templateDir, "motion.json");
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, "utf8"));
}

/* ---------- 把 spTree 的顶层元素切出来 ---------- */
const TAG = /<(\/?)([A-Za-z_][\w.\-]*(?::[\w.\-]+)?)([^>]*?)(\/?)>/g;
function topLevel(xml, from, to) {
  const out = [];
  let depth = 0, start = -1;
  TAG.lastIndex = from;
  let m;
  while ((m = TAG.exec(xml)) && m.index < to) {
    if (xml[m.index + 1] === "?" || xml[m.index + 1] === "!") continue;
    const [, close, , , self] = m;
    if (close) { depth--; if (depth === 0 && start >= 0) { out.push([start, TAG.lastIndex]); start = -1; } }
    else if (self) { if (depth === 0) out.push([m.index, TAG.lastIndex]); }
    else { if (depth === 0) start = m.index; depth++; }
  }
  return out;
}
const attr = (s, re) => { const m = s.match(re); return m ? m[1] : null; };

/** 同组元素包成 <p:grpSp>，返回 { xml, groups: {组名: id} } */
function groupShapes(xml) {
  const open = xml.indexOf("<p:spTree>"), close = xml.lastIndexOf("</p:spTree>");
  if (open < 0) return { xml, groups: {} };
  const inner0 = open + "<p:spTree>".length;
  const els = topLevel(xml, inner0, close).map(([s, e]) => {
    const str = xml.slice(s, e);
    const name = attr(str, /<p:cNvPr [^>]*name="([^"]*)"/) || "";
    const g = (name.match(/^M([^|]+)\|/) || [])[1] || null;
    let box = null;
    const off = str.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/>/), ext = str.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
    if (off && ext) box = [+off[1], +off[2], +ext[1], +ext[2]];
    return { s, e, str, g, box };
  });
  const ids = [...xml.matchAll(/<p:cNvPr [^>]*id="(\d+)"/g)].map((m) => +m[1]);
  let nid = Math.max(1, ...ids) + 1;
  const byGroup = {};
  els.forEach((el, i) => { if (el.g) (byGroup[el.g] ||= []).push(i); });
  const groups = {};
  const replaced = new Map(); // 元素序号 → 替换后的字符串（组放在最后一个成员的位置）
  for (const [g, idxs] of Object.entries(byGroup)) {
    const boxes = idxs.map((i) => els[i].box).filter(Boolean);
    if (!boxes.length) continue;
    const x0 = Math.min(...boxes.map((b) => b[0])), y0 = Math.min(...boxes.map((b) => b[1]));
    const x1 = Math.max(...boxes.map((b) => b[0] + b[2])), y1 = Math.max(...boxes.map((b) => b[1] + b[3]));
    const id = nid++;
    const xf = `<a:xfrm><a:off x="${x0}" y="${y0}"/><a:ext cx="${x1 - x0}" cy="${y1 - y0}"/><a:chOff x="${x0}" y="${y0}"/><a:chExt cx="${x1 - x0}" cy="${y1 - y0}"/></a:xfrm>`;
    const grp = `<p:grpSp><p:nvGrpSpPr><p:cNvPr id="${id}" name="组 ${g}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr>${xf}</p:grpSpPr>`
      + idxs.map((i) => els[i].str).join("") + `</p:grpSp>`;
    idxs.forEach((i) => replaced.set(i, ""));
    replaced.set(idxs[idxs.length - 1], grp);
    groups[g] = id;
  }
  let res = "", pos = 0;
  els.forEach((el, i) => {
    if (!replaced.has(i)) return;
    res += xml.slice(pos, el.s) + replaced.get(i);
    pos = el.e;
  });
  res += xml.slice(pos);
  return { xml: res, groups };
}

/* ---------- 动画步骤 ---------- */
function stepsFor(motion, type, layout) {
  const p = motion.pages || {};
  return p[`${type}.${layout}`] || p[type] || p.default || [];
}

/** 展开通配、轮换效果、去掉页面上不存在的组 → [{ g, fx, trig, delay, chain }] */
function expand(steps, groups) {
  const out = [];
  const names = Object.keys(groups);
  const num = (s) => +((s.match(/(\d+)$/) || [])[1] ?? 0);
  for (const st of steps) {
    if (st.static) continue;               // declared on purpose: this group stays still (as in the source template)
    const trig = st.trig || "click";
    if (st.g.endsWith("*")) {
      const pre = st.g.slice(0, -1);
      const hits = names.filter((n) => n.startsWith(pre)).sort((a, b) => num(a) - num(b));
      hits.forEach((g, k) => out.push({ g, fx: Array.isArray(st.fx) ? st.fx[k % st.fx.length] : st.fx, trig: k === 0 ? trig : (st.rest || trig), delay: st.delay || 0, chain: k === 0 && !!st.chain }));
    } else if (groups[st.g]) {
      out.push({ g: st.g, fx: Array.isArray(st.fx) ? st.fx[0] : st.fx, trig, delay: st.delay || 0, chain: !!st.chain });
    }
  }
  // 第一步如果因为组不存在被跳过，后面的「同时 / 之后」要升级成单击（startTrig 留着原来的写法，autoStart 时用）
  if (out.length) { out[0].startTrig = out[0].trig; if (out[0].trig !== "click") out[0].trig = "click"; }
  return out;
}

function timingXml(steps, groups, effects, mode, autoStart = false) {
  let id = 2;
  const next = () => ++id;
  const durOf = (fx) => (effects[fx]?.durMs ?? +((effects[fx]?.xml || "").match(/dur="(\d+)"/) || [0, 500])[1]);
  const inst = (fx, spid, node, delay) => {
    const e = effects[fx];
    if (!e) throw new Error(`motion.json 里没有效果 ${fx}`);
    return e.xml.replace(/\{SPID\}/g, spid).replace(/\{NODE\}/g, node).replace(/\{DELAY\}/g, String(delay)).replace(/\{ID\}/g, () => String(next()));
  };

  // 分成「单击组」→「先后段」→「同时的效果」
  const clicks = [];
  for (const st of steps) {
    const trig = mode === "auto" && st.trig === "click" && clicks.length ? "after" : st.trig;
    if (trig === "click" || !clicks.length) clicks.push({ chain: st.chain, segs: [{ items: [st] }] });
    else if (trig === "with") clicks[clicks.length - 1].segs.at(-1).items.push(st);
    else clicks[clicks.length - 1].segs.push({ items: [st] });
  }

  let lastId = null;
  const pars = clicks.map((c, ci) => {
    const clickId = next();
    let t = 0;
    const segXml = c.segs.map((seg, si) => {
      const segId = next();
      const start = t;
      const body = seg.items.map((st, k) => {
        const auto0 = ci === 0 && (mode === "auto" || autoStart);
        const node = k > 0 ? "withEffect" : si > 0 ? "afterEffect"
          : auto0 ? (autoStart && mode !== "auto" && st.startTrig === "with" ? "withEffect" : "afterEffect") : "clickEffect";
        return inst(st.fx, groups[st.g], node, st.delay);
      }).join("");
      t = start + Math.max(...seg.items.map((st) => st.delay + durOf(st.fx)));
      return `<p:par><p:cTn id="${segId}" fill="hold"><p:stCondLst><p:cond delay="${start}"/></p:stCondLst><p:childTnLst>${body}</p:childTnLst></p:cTn></p:par>`;
    }).join("");
    let cond = '<p:cond delay="indefinite"/>';
    const autoPar = mode === "auto" || (autoStart && ci === 0);
    if (autoPar) cond += '<p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond>';
    else if (c.chain && lastId) cond += `<p:cond evt="onBegin" delay="0"><p:tn val="${lastId}"/></p:cond>`;
    lastId = id;
    return `<p:par><p:cTn id="${clickId}" fill="hold"${autoPar ? "" : ' nodeType="clickPar"'}><p:stCondLst>${cond}</p:stCondLst><p:childTnLst>${segXml}</p:childTnLst></p:cTn></p:par>`;
  });
  return '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
    + '<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>' + pars.join("")
    + '</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
    + '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>'
    + "</p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>";
}

function ensureNs(xml, frag) {
  const m = xml.match(/<p:sld\b[^>]*>/);
  if (!m) return xml;
  let root = m[0];
  for (const [pfx, uri] of Object.entries(NS_DECL)) {
    if (frag.includes(`${pfx}:`) && !root.includes(`xmlns:${pfx}=`)) root = root.replace(/>$/, ` xmlns:${pfx}="${uri}">`);
  }
  return xml.replace(m[0], root);
}

/**
 * 写入翻页 + 动画
 * @param file   pptx 路径（原地改写）
 * @param pages  [{ type, layout }]，和幻灯片一一对应
 * @param motion 模板的 motion.json
 * @param mode   "original" | "auto" | "off"
 * @returns { summary, plan: [{ page, type, layout, transition, steps: ["header:wipeLeft", …] }] }
 */
async function applyMotion(file, { pages, motion, mode = "original" }) {
  if (mode === "click") mode = "original";
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const slideFiles = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => +a.match(/(\d+)\.xml/)[1] - +b.match(/(\d+)\.xml/)[1]);
  const plan = [];
  const warn = [];
  for (const [i, name] of slideFiles.entries()) {
    const pg = pages[i] || {};
    let xml = await zip.file(name).async("string");
    xml = xml.replace(/<mc:AlternateContent(?:(?!<\/mc:AlternateContent>)[\s\S])*?<p:transition[\s\S]*?<\/mc:AlternateContent>/g, "")
      .replace(/<p:transition\b[\s\S]*?(?:\/>|<\/p:transition>)/g, "").replace(/<p:timing>[\s\S]*?<\/p:timing>/g, "");
    const g = groupShapes(xml);
    xml = g.xml;
    // 翻页
    const tKey = motion.pageTransition?.[pg.type] || motion.transition;
    const tr = tKey && tKey !== "none" ? motion.transitions?.[tKey] : null;
    let add = tr ? tr.xml : "";
    // 源模板的 <p:transition> 常带 advTm（自动换片毫秒数，常见 advTm="0"），原样写进去 PowerPoint 会自己往后跳。
    // 翻页效果照抄，但换页必须由人控制：统一剥掉 advTm。
    add = add.replace(/\s+advTm="\d*"/g, "");
    // 动画
    const steps = mode === "off" ? [] : expand(stepsFor(motion, pg.type, pg.layout), g.groups);
    const declared = stepsFor(motion, pg.type, pg.layout).map((s) => s.g);
    const missing = declared.filter((d) => !d.endsWith("*") && !g.groups[d]);
    const unused = Object.keys(g.groups).filter((n) => !declared.some((d) => (d.endsWith("*") ? n.startsWith(d.slice(0, -1)) : d === n)));
    if (unused.length) warn.push(`第 ${i + 1} 页（${pg.type}${pg.layout ? "." + pg.layout : ""}）的组 ${unused.join("、")} 在 motion.json 里没有动画，会保持静止`);
    if (steps.length) add += timingXml(steps, g.groups, motion.effects || {}, mode, !!motion.autoStart);
    if (add) {
      xml = ensureNs(xml, add);
      if (xml.includes("</p:clrMapOvr>")) xml = xml.replace("</p:clrMapOvr>", "</p:clrMapOvr>" + add);
      else xml = xml.replace("</p:cSld>", "</p:cSld>" + add);
    }
    zip.file(name, xml);
    plan.push({ page: i + 1, type: pg.type, layout: pg.layout || null, transition: tr ? tr.name || tKey : "无", steps: steps.map((s) => `${s.g}:${s.fx}${s.trig !== "click" ? `(${s.trig})` : ""}`), missing });
  }
  const out = new JSZip();
  for (const [n, f] of Object.entries(zip.files)) if (!f.dir) out.file(n, await f.async("uint8array"), { createFolders: false });
  fs.writeFileSync(file, await out.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  const nAnim = plan.reduce((a, p) => a + p.steps.length, 0);
  const tNames = [...new Set(plan.map((p) => p.transition))].join(" / ");
  const summary = `[动效] 按原模板：翻页 ${tNames}；入场动画 ${mode === "off" ? "已关闭" : `${nAnim} 个（${mode === "auto" ? "自动依次播放" : motion.autoStart ? "和原模板一样，翻页后自动播放" : "和原模板一样"}）`}`;
  return { summary, plan, warnings: warn };
}

module.exports = { applyMotion, loadMotion, groupShapes, expand, stepsFor };
