"""Cut vector decorations (gradient frames, title bars, glow curves…) out of the original .pptx as transparent PNGs, for template intake
Principle: delete everything on the page except the chosen elements, render once on a black and once on a white background with LibreOffice, then compute alpha from the difference (difference matting)
Usage: PPTX_SRC=work/src python3 tools/pptx_extract.py jobs.json outdir [dpi=200]
jobs.json: [{
  "name": "bar_top",            output file name
  "slide": 2,                   which slide of the original template
  "keep": ["组合 41"],           top-level element names (or indices) to keep
  "bbox": [x,y,w,h],            optional crop region (inches); defaults to the bounding box of the kept elements
  "noText": true,               clear the text (keep only the frame)
  "dropPics": true,             remove images inside (keep only the vector frame)
  "onlyPics": true,             keep only the images → output a white mask (used to cut a photo to the frame's inner shape)
  "keepBg": true,               keep the original page background, output jpg (used to make full-page backgrounds)
  "trim": true                  trim transparent edges
}]
Requires: soffice, pdftoppm, python3 + lxml / numpy / Pillow.
"""
import json, os, re, shutil, subprocess, sys, tempfile
from lxml import etree
import numpy as np
from PIL import Image

NS = {'p': 'http://schemas.openxmlformats.org/presentationml/2006/main', 'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
SRC = os.environ.get('PPTX_SRC', 'work/src')  # folder of the unzipped original .pptx
E = 914400

def top_shapes(tree):
    sp = tree.find('.//p:spTree', NS)
    return sp, [c for c in sp if etree.QName(c).localname in ('sp', 'pic', 'grpSp', 'graphicFrame', 'cxnSp')]

def name_of(el):
    nv = el.find('.//p:cNvPr', NS)
    return nv.get('name') if nv is not None else ''

def xfrm(el):
    for path in ('./p:spPr/a:xfrm', './p:grpSpPr/a:xfrm', './p:xfrm'):
        x = el.find(path, NS)
        if x is not None and x.find('a:off', NS) is not None:
            o, e = x.find('a:off', NS), x.find('a:ext', NS)
            return [int(o.get('x')) / E, int(o.get('y')) / E, int(e.get('cx')) / E, int(e.get('cy')) / E]
    return None

def build(jobs, bgcolor, out_pptx):
    tmp = tempfile.mkdtemp()
    shutil.copytree(SRC, tmp + '/x')
    root = tmp + '/x'
    slides_dir = root + '/ppt/slides'
    originals = {}
    count = len([f for f in os.listdir(slides_dir) if re.match(r'slide\d+\.xml$', f)])
    for i in range(1, count + 1):
        originals[i] = (open(f'{slides_dir}/slide{i}.xml', 'rb').read(), open(f'{slides_dir}/_rels/slide{i}.xml.rels', 'rb').read())
    for f in os.listdir(slides_dir):
        if f.endswith('.xml'): os.remove(f'{slides_dir}/{f}')
    for f in os.listdir(slides_dir + '/_rels'): os.remove(f'{slides_dir}/_rels/{f}')
    bboxes = []
    for k, job in enumerate(jobs, 1):
        xml, rels = originals[job['slide']]
        tree = etree.fromstring(xml)
        sp, shapes = top_shapes(tree)
        keep = job['keep']
        chosen = [s for i, s in enumerate(shapes) if (i in keep) or (name_of(s) in keep)]
        for s in shapes:
            if s not in chosen: sp.remove(s)
        # strip text if requested
        def is_pic(el):
            return etree.QName(el).localname == 'pic' or el.find('./p:spPr/a:blipFill', NS) is not None
        if job.get('dropPics'):
            for pc in [e for e in sp.iter() if etree.QName(e).localname in ('pic', 'sp') and is_pic(e)]: pc.getparent().remove(pc)
        if job.get('onlyPics'):
            for e in [e for e in sp.iter() if etree.QName(e).localname in ('sp', 'cxnSp', 'pic', 'graphicFrame') and not is_pic(e)]: e.getparent().remove(e)
        if job.get('noText'):
            for t in tree.findall('.//a:t', NS): t.text = ''
        cSld = tree.find('p:cSld', NS)
        old = cSld.find('p:bg', NS)
        if old is not None: cSld.remove(old)
        if not job.get('keepBg'):
            bg = etree.fromstring(f'<p:bg xmlns:p="{NS["p"]}" xmlns:a="{NS["a"]}"><p:bgPr><a:solidFill><a:srgbClr val="{bgcolor}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>')
            cSld.insert(0, bg)
        elif old is not None:  # the page may have no <p:bg> of its own (background comes from a full-page picture)
            cSld.insert(0, old)
        open(f'{slides_dir}/slide{k}.xml', 'wb').write(etree.tostring(tree, xml_declaration=True, encoding='UTF-8', standalone=True))
        open(f'{slides_dir}/_rels/slide{k}.xml.rels', 'wb').write(rels)
        if job.get('bbox'): bb = job['bbox']
        else:
            bs = [xfrm(s) for s in chosen if xfrm(s)]
            x0 = min(b[0] for b in bs); y0 = min(b[1] for b in bs)
            x1 = max(b[0] + b[2] for b in bs); y1 = max(b[1] + b[3] for b in bs)
            bb = [x0, y0, x1 - x0, y1 - y0]
        bboxes.append(bb)
    n = len(jobs)
    # presentation.xml / rels / content types
    pres = open(root + '/ppt/presentation.xml').read()
    pres = re.sub(r'<p:sldIdLst>.*?</p:sldIdLst>', '<p:sldIdLst>' + ''.join(f'<p:sldId id="{300 + k}" r:id="rIdX{k}"/>' for k in range(1, n + 1)) + '</p:sldIdLst>', pres)
    open(root + '/ppt/presentation.xml', 'w').write(pres)
    rels = open(root + '/ppt/_rels/presentation.xml.rels').read()
    rels = re.sub(r'<Relationship [^>]*relationships/slide"[^>]*/>', '', rels)
    rels = rels.replace('</Relationships>', ''.join(f'<Relationship Id="rIdX{k}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{k}.xml"/>' for k in range(1, n + 1)) + '</Relationships>')
    open(root + '/ppt/_rels/presentation.xml.rels', 'w').write(rels)
    ct = open(root + '/[Content_Types].xml').read()
    ct = re.sub(r'<Override PartName="/ppt/slides/slide\d+\.xml"[^>]*/>', '', ct)
    ct = ct.replace('</Types>', ''.join(f'<Override PartName="/ppt/slides/slide{k}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>' for k in range(1, n + 1)) + '</Types>')
    open(root + '/[Content_Types].xml', 'w').write(ct)
    if os.path.exists(out_pptx): os.remove(out_pptx)
    subprocess.run(['zip', '-q', '-r', '-X', os.path.abspath(out_pptx), '.'], cwd=root, check=True)
    shutil.rmtree(tmp)
    return bboxes

def render(pptx, dpi):
    d = os.path.dirname(pptx)
    subprocess.run(['soffice', '--headless', '--convert-to', 'pdf', '--outdir', d, pptx], check=True, capture_output=True)
    pdf = pptx[:-5] + '.pdf'
    pre = pptx[:-5] + '_p'
    subprocess.run(['pdftoppm', '-png', '-r', str(dpi), pdf, pre], check=True)
    return sorted(f'{d}/{f}' for f in os.listdir(d) if f.startswith(os.path.basename(pre)) and f.endswith('.png'))

def main():
    jobs = json.load(open(sys.argv[1])); out = sys.argv[2]; dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 200
    os.makedirs(out, exist_ok=True)
    work = tempfile.mkdtemp()
    bb = build(jobs, '000000', work + '/k.pptx'); build(jobs, 'FFFFFF', work + '/w.pptx')
    K = render(work + '/k.pptx', dpi); W = render(work + '/w.pptx', dpi)
    for job, b, kf, wf in zip(jobs, bb, K, W):
        k = np.asarray(Image.open(kf).convert('RGB')).astype(np.float32); w = np.asarray(Image.open(wf).convert('RGB')).astype(np.float32)
        if job.get('keepBg'):
            img = Image.fromarray(k.astype(np.uint8))
        else:
            a = 1 - (w - k).mean(axis=2) / 255.0
            a = np.clip(a, 0, 1)
            rgb = np.where(a[..., None] > 0.004, k / np.maximum(a[..., None], 0.004), 0)
            rgba = np.dstack([np.clip(rgb, 0, 255), a * 255]).astype(np.uint8)
            img = Image.fromarray(rgba, 'RGBA')
            if job.get('onlyPics'):
                m = (np.clip(a, 0, 1) * 255).astype(np.uint8)
                img = Image.fromarray(np.dstack([np.full_like(m, 255)] * 3 + [m]), 'RGBA')
        H, Wd = img.height, img.width
        sx = Wd / 13.333; sy = H / 7.5
        pad = job.get('pad', 0.02)
        box = (max(0, int((b[0] - pad) * sx)), max(0, int((b[1] - pad) * sy)), min(Wd, int((b[0] + b[2] + pad) * sx)), min(H, int((b[1] + b[3] + pad) * sy)))
        img = img.crop(box)
        if job.get('trim') and img.mode == 'RGBA':
            bbx = img.getchannel('A').point(lambda v: 255 if v > 6 else 0).getbbox()
            if bbx: img = img.crop(bbx)
        ext = 'jpg' if job.get('keepBg') else 'png'
        fn = f'{out}/{job["name"]}.{ext}'
        (img.convert('RGB').save(fn, quality=90) if ext == 'jpg' else img.save(fn, optimize=True))
        print(job['name'], img.size, [round(v, 2) for v in b])
    shutil.rmtree(work)

if __name__ == '__main__':
    main()
