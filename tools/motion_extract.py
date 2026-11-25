"""从原模板 .pptx 里原样抽出翻页效果和入场动画（模板入库第 1 步用）
------------------------------------------------------------------
用法:
  python3 tools/motion_extract.py 原模板.pptx [输出文件夹]
输出（默认写到 .pptx 同目录的 <文件名>_motion/）:
  motion_source.json   每页的翻页 + 动画步骤（含原始 XML，可直接复制进 templates/<id>/motion.json）
  motion_source.md     给人看的中文清单：每页「第几下单击 → 哪个元素 → 什么效果、方向、时长」

只用 Python 标准库，不依赖 lxml。
抽出的效果 XML 里：目标元素 id 换成 {SPID}，时间节点 id 换成 {ID}，
触发方式换成 {NODE}，延迟换成 {DELAY}，引擎写入时再填回去。
"""
import json, os, re, sys, zipfile
import xml.etree.ElementTree as ET

NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
EMU = 914400

# ---------- 中文名称 ----------
ENTR = {1: "出现", 2: "飞入", 3: "百叶窗", 4: "盒状", 5: "棋盘", 6: "形状", 7: "切入", 8: "菱形", 9: "向内溶解", 10: "淡化",
        12: "切入", 13: "十字形", 14: "随机线条", 15: "螺旋飞入", 16: "劈裂", 17: "伸展", 18: "阶梯状", 19: "旋转", 20: "楔入",
        21: "轮子", 22: "擦除", 23: "缩放", 24: "随机效果", 25: "飞旋", 26: "弹跳", 27: "彩色打字机", 28: "字幕式", 29: "缓慢进入",
        30: "浮动", 31: "翻转式由远及近", 34: "光速", 35: "玩具风车", 37: "上升", 38: "挥鞭式", 39: "细线", 40: "展开",
        41: "挥舞", 42: "浮入", 43: "中心旋转", 45: "淡化旋转", 47: "下降", 48: "弹跳", 49: "旋转", 50: "压缩", 51: "拉链",
        52: "曲线向上", 53: "基本缩放", 54: "滑翔", 55: "展开", 56: "翻转", 58: "折叠"}
EMPH = {1: "更改填充颜色", 3: "更改字体颜色", 6: "放大/缩小", 7: "更改线条颜色", 8: "陀螺旋", 9: "透明", 14: "闪烁",
        26: "脉冲", 27: "彩色脉冲", 28: "跷跷板", 32: "波浪形"}
CLASS = {"entr": "进入", "emph": "强调", "exit": "退出", "path": "动作路径", "verb": "OLE", "mediacall": "媒体"}
NODE = {"clickEffect": "单击时", "withEffect": "与上一动画同时", "afterEffect": "上一动画之后"}
DIR4 = {1: "自顶部", 2: "自右侧", 4: "自底部", 8: "自左侧", 3: "自右上", 6: "自右下", 9: "自左上", 12: "自左下"}
SUB = {
    6: {16: "缩小", 32: "放大"},
    14: {10: "水平", 5: "垂直"},
    16: {21: "左右向中央收缩", 26: "上下向中央收缩", 37: "中央向左右展开", 42: "中央向上下展开"},
    3: {10: "水平", 5: "垂直"}, 18: {3: "右上", 6: "右下", 9: "左上", 12: "左下"},
}
TRANS = {
    "fade": "淡出", "push": "推进", "wipe": "擦除", "split": "分割", "cover": "覆盖", "pull": "揭开", "zoom": "缩放",
    "circle": "形状·圆", "diamond": "形状·菱形", "plus": "形状·加号", "wedge": "楔入", "wheel": "轮辐", "randomBar": "随机线条",
    "blinds": "百叶窗", "checker": "棋盘", "strips": "阶梯", "dissolve": "溶解", "cut": "切出", "newsflash": "新闻快报", "random": "随机",
    "flythrough": "飞过", "vortex": "涡流", "ripple": "涟漪", "honeycomb": "蜂巢", "glitter": "闪耀", "switch": "切换", "flip": "翻转",
    "gallery": "库", "cube": "立方体", "doors": "门", "box": "框", "window": "窗口", "ferris": "摩天轮", "conveyor": "传送带",
    "pan": "平移", "reveal": "显示", "shred": "碎片", "flash": "闪光", "prism": "棱镜", "warp": "缩放(warp)", "wheelReverse": "反向轮辐",
    "vortex2": "涡流", "morph": "平滑", "pageCurlDouble": "页面卷曲", "pageCurlSingle": "页面卷曲", "airplane": "飞机", "origami": "折纸",
    "fracture": "压碎", "crush": "压碎", "peelOff": "剥离", "curtains": "窗帘", "wind": "风", "prestige": "威望", "drape": "布帘",
}


def effect_name(cls, pid, sub, flt):
    base = (ENTR if cls in ("entr", "exit") else EMPH if cls == "emph" else {}).get(pid, f"效果#{pid}")
    if cls == "path":
        base = "动作路径"
    d = SUB.get(pid, {}).get(sub) or (DIR4.get(sub) if pid in (2, 7, 12, 22, 25, 42, 47) else None)
    s = f"{CLASS.get(cls, cls)}·{base}"
    if d:
        s += f"（{d}）"
    return s


# ---------- 原始字符串里按层级切元素（保留命名空间前缀） ----------
TAG = re.compile(r"<(/?)([A-Za-z_][\w.\-]*:[\w.\-]+|[A-Za-z_][\w.\-]*)([^>]*?)(/?)>")


def find_elements(xml, tag, start=0, end=None):
    """返回 [(s, e)]：xml[s:e] 是一个完整的 <tag ...>...</tag>（任意深度）"""
    end = len(xml) if end is None else end
    out, stack = [], []
    for m in TAG.finditer(xml, start, end):
        if xml[m.start() + 1] in "?!":
            continue
        closing, name, _, selfc = m.group(1), m.group(2), m.group(3), m.group(4)
        if name != tag:
            continue
        if closing:
            if stack:
                s = stack.pop()
                out.append((s, m.end()))
        elif selfc:
            out.append((m.start(), m.end()))
        else:
            stack.append(m.start())
    return sorted(out)


def templatize(par):
    """效果 <p:par> → 模板：spid / cTn id / nodeType / 第一个延迟 → 占位符"""
    t = re.sub(r'spid="\d+"', 'spid="{SPID}"', par)
    t = re.sub(r'(<p:cTn\s+id=")\d+(")', r"\1{ID}\2", t)
    t = re.sub(r'nodeType="(clickEffect|withEffect|afterEffect)"', 'nodeType="{NODE}"', t, count=1)
    t = re.sub(r'(<p:stCondLst><p:cond delay=")(\d+|indefinite)(")', r"\1{DELAY}\3", t, count=1)
    return t


# ---------- 形状信息 ----------
def shape_index(root):
    """spid → {name, kind, box(英寸, 顶层才准), text, top}"""
    idx = {}
    tree = root.find(".//p:cSld/p:spTree", NS)

    def box(el):
        x = el.find("./p:spPr/a:xfrm", NS)
        if x is None:
            x = el.find("./p:grpSpPr/a:xfrm", NS)
        if x is None:
            x = el.find("./p:xfrm", NS)
        if x is None or x.find("a:off", NS) is None:
            return None
        o, e = x.find("a:off", NS), x.find("a:ext", NS)
        return [round(int(o.get("x")) / EMU, 2), round(int(o.get("y")) / EMU, 2), round(int(e.get("cx")) / EMU, 2), round(int(e.get("cy")) / EMU, 2)]

    def walk(parent, top):
        for ch in parent:
            kind = ch.tag.split("}")[1]
            if kind not in ("sp", "pic", "grpSp", "cxnSp", "graphicFrame"):
                continue
            nv = ch.find(".//p:cNvPr", NS)
            texts = "".join(t.text or "" for t in ch.iter("{%s}t" % NS["a"]))
            pics = len(ch.findall(".//p:pic", NS)) + (1 if kind == "pic" else 0)
            idx[nv.get("id")] = {"name": nv.get("name"), "kind": {"sp": "形状/文本", "pic": "图片", "grpSp": "组合", "cxnSp": "线条", "graphicFrame": "表格/图表"}[kind],
                                 "box": box(ch) if top else None, "text": texts[:40], "pictures": pics,
                                 "children": len([c for c in ch if c.tag.split("}")[1] in ("sp", "pic", "grpSp", "cxnSp", "graphicFrame")]) if kind == "grpSp" else 0,
                                 "top": top}
            if kind == "grpSp":
                walk(ch, False)
    walk(tree, True)
    return idx


def transition_of(xml):
    m = re.search(r"<mc:AlternateContent(?:(?!</mc:AlternateContent>).)*?<p:transition.*?</mc:AlternateContent>", xml, re.S)
    raw = m.group(0) if m else None
    if not raw:
        m = re.search(r"<p:transition\b[^>]*?(?:/>|>.*?</p:transition>)", xml, re.S)
        raw = m.group(0) if m else None
    if not raw:
        return None
    # 名称：优先取 Choice 里的新效果
    inner = re.findall(r"<(?:p14|p15|p159|p):(\w+)", raw)
    kinds = [k for k in inner if k not in ("transition", "sndAc", "stSnd", "snd", "endSnd")]
    kind = kinds[0] if kinds else ""
    if kind == "prstTrans":
        pm = re.search(r'prst="(\w+)"', raw)
        kind = pm.group(1) if pm else kind
    dur = re.search(r'p14:dur="(\d+)"', raw) or re.search(r'\bdur="(\d+)"', raw)
    spd = re.search(r'spd="(\w+)"', raw)
    adv = re.search(r'advTm="(\d+)"', raw)
    click = re.search(r'advClick="0"', raw) is None
    if raw.startswith("<p:transition") and re.fullmatch(r"<p:transition\s*/>", raw.strip()):
        return {"name": "无", "kind": "none", "xml": raw}
    return {"name": TRANS.get(kind, kind or "无"), "kind": kind, "durMs": int(dur.group(1)) if dur else None,
            "speed": spd.group(1) if spd else None, "autoAdvanceMs": int(adv.group(1)) if adv and adv.group(1) != "0" else None,
            "advanceOnClick": click, "xml": raw}


def steps_of(xml, shapes):
    m = re.search(r"<p:timing>.*</p:timing>", xml, re.S)
    if not m:
        return [], []
    tm = m.group(0)
    notes = []
    if 'nodeType="interactiveSeq"' in tm:
        notes.append("有「触发器」动画（点某个元素才播放），引擎不支持，已忽略")
    seq = re.search(r'<p:cTn id="\d+"[^>]*nodeType="mainSeq".*?</p:seq>', tm, re.S)
    if not seq:
        return [], notes
    body = seq.group(0)
    steps, click_no = [], 0
    # 主序列里每个 clickPar = 一次单击（或页面开始后自动）
    tops = []
    depth_pars = find_elements(body, "p:par")
    # 只取主序列下的顶层 <p:par>（= clickPar 那一层）。
    # 有的软件导出时不写 nodeType="clickPar"，所以按层级判断，不认这个标记。
    for s, e in depth_pars:
        if not any(ps < s and e <= pe for ps, pe in depth_pars):
            tops.append((s, e))
    for s, e in tops:
        cp = body[s:e]
        first_cond = re.search(r"<p:stCondLst>(.*?)</p:stCondLst>", cp, re.S).group(1)
        chained = "evt=\"onBegin\"" in first_cond
        first_node = re.search(r'presetID="\d+"[^>]*nodeType="(\w+)"|nodeType="(\w+)"[^>]*presetID=', cp)
        first_node = (first_node.group(1) or first_node.group(2)) if first_node else ""
        # 页面开始就自动播放：这一组带 onBegin，且第一个效果不是「单击时」（是「上一动画之后 / 同时」）
        auto_group = chained and first_node in ("afterEffect", "withEffect")
        if not auto_group:
            click_no += 1
        for es, ee in find_elements(cp, "p:par"):
            par = cp[es:ee]
            hm = re.match(r'<p:par><p:cTn ([^>]*)>', par)
            if not hm or "presetID=" not in hm.group(1):
                continue
            a = dict(re.findall(r'(\w+)="([^"]*)"', hm.group(1)))
            pid, sub, cls = int(a.get("presetID", 0)), int(a.get("presetSubtype", 0)), a.get("presetClass", "")
            flt = re.search(r'filter="([^"]+)"', par)
            delay = re.search(r"<p:stCondLst><p:cond delay=\"(\d+|indefinite)\"", par)
            spids = list(dict.fromkeys(re.findall(r'spid="(\d+)"', par)))
            para = re.search(r'<p:pRg st="(\d+)" end="(\d+)"', par)
            durs = [int(d) for d in re.findall(r'dur="(\d+)"', par)]
            tgt = shapes.get(spids[0], {}) if spids else {}
            extra = {"autoStart": True} if auto_group else {}
            steps.append({
                **extra,
                "click": click_no, "trigger": a.get("nodeType", ""), "triggerName": NODE.get(a.get("nodeType", ""), a.get("nodeType", "")),
                "chainedToPrevious": chained and a.get("nodeType") == "clickEffect",
                "delayMs": int(delay.group(1)) if delay and delay.group(1).isdigit() else 0,
                "durMs": max(durs) if durs else None,
                "class": cls, "presetID": pid, "presetSubtype": sub, "filter": flt.group(1) if flt else None,
                "name": effect_name(cls, pid, sub, flt.group(1) if flt else None),
                "target": {"spid": spids[0] if spids else None, **tgt, "paragraphs": [int(para.group(1)), int(para.group(2))] if para else None},
                "xml": templatize(par),
            })
    return steps, notes


def main(src, outdir=None):
    base = os.path.splitext(os.path.basename(src))[0]
    outdir = outdir or os.path.join(os.path.dirname(os.path.abspath(src)), base + "_motion")
    os.makedirs(outdir, exist_ok=True)
    z = zipfile.ZipFile(src)
    pres = z.read("ppt/presentation.xml").decode("utf8")
    rels = z.read("ppt/_rels/presentation.xml.rels").decode("utf8")
    rid2file = {m.group(1): m.group(2) for m in re.finditer(r'Id="(rId\d+)"[^>]*Target="(slides/slide\d+\.xml)"', rels)}
    rid2file.update({m.group(2): m.group(1) for m in re.finditer(r'Target="(slides/slide\d+\.xml)"[^>]*Id="(rId\d+)"', rels)})
    order = [rid2file[r] for r in re.findall(r'<p:sldId [^>]*r:id="(rId\d+)"', pres) if r in rid2file]
    slides, effects = [], {}
    for n, f in enumerate(order, 1):
        xml = z.read("ppt/" + f).decode("utf8")
        root = ET.fromstring(xml)
        shapes = shape_index(root)
        steps, notes = steps_of(xml, shapes)
        for st in steps:
            key = f'{st["class"]}-{st["presetID"]}-{st["presetSubtype"]}-{st["durMs"]}'
            effects.setdefault(key, {"name": st["name"], "durMs": st["durMs"], "usedOn": [], "xml": st["xml"]})
            effects[key]["usedOn"].append(n)
            st["effect"] = key
        slides.append({"page": n, "file": f, "transition": transition_of(xml), "steps": steps, "notes": notes})
    for e in effects.values():
        e["usedOn"] = sorted(set(e["usedOn"]))
    data = {"source": os.path.basename(src), "pages": len(slides), "effects": effects, "slides": slides}
    with open(os.path.join(outdir, "motion_source.json"), "w", encoding="utf8") as fp:
        json.dump(data, fp, ensure_ascii=False, indent=1)

    # 中文清单
    L = [f"# 动效清单：{os.path.basename(src)}", "", f"共 {len(slides)} 页。", "", "## 用到的效果", "",
         "| 效果 key | 名称 | 时长 | 用在第几页 |", "|---|---|---|---|"]
    for k, e in effects.items():
        L.append(f"| `{k}` | {e['name']} | {e['durMs']} ms | {', '.join(map(str, e['usedOn']))} |")
    tr = {}
    for s in slides:
        t = s["transition"]
        name = f"{t['name']}" + (f" {t['durMs']}ms" if t and t.get("durMs") else "") if t else "无"
        tr.setdefault(name, []).append(s["page"])
    L += ["", "## 翻页效果", "", "| 效果 | 页 |", "|---|---|"] + [f"| {k} | {', '.join(map(str, v))} |" for k, v in tr.items()]
    L += ["", "## 逐页动画", ""]
    for s in slides:
        L.append(f"### 第 {s['page']} 页" + (f"（翻页：{s['transition']['name']}）" if s["transition"] else ""))
        if not s["steps"]:
            L.append("- 无动画")
        for st in s["steps"]:
            t = st["target"]
            what = f"{t.get('kind', '?')}「{t.get('name', '')}」" + (f" 文字：{t['text']}" if t.get("text") else "") + (f" 含 {t['pictures']} 张图" if t.get("pictures") else "")
            box = f" 位置 {t['box']}" if t.get("box") else ""
            chain = "（跟着上一步自动播放）" if st["chainedToPrevious"] else ""
            when = "翻页后自动" if st.get("autoStart") else f"第 {st['click']} 下"
            L.append(f"- {when} · {st['triggerName']}{chain}{(' 延迟 %dms' % st['delayMs']) if st['delayMs'] else ''} → {what}{box} → **{st['name']}** {st['durMs']}ms `{st['effect']}`")
        for no in s["notes"]:
            L.append(f"- ⚠ {no}")
        L.append("")
    with open(os.path.join(outdir, "motion_source.md"), "w", encoding="utf8") as fp:
        fp.write("\n".join(L))
    print(f"[motion] {len(slides)} 页，{len(effects)} 种效果 → {outdir}/motion_source.json / motion_source.md")
    return data


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
