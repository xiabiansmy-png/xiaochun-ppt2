/**
 * Text-measurement estimate (no real fonts needed): estimates how many lines a string wraps to in a text box, whether it overflows, and whether the last line is left with only one or two characters
 * Rules of thumb: CJK char width ≈ font size (12pt ≈ 0.17 in); uppercase Latin ≈ 0.72, lowercase ≈ 0.57 of the font size (deliberately conservative); line height ≈ font size × 1.2 × line-spacing multiple
 */
const PT = 1 / 72;

function charWidth(ch, size, bold) {
  const c = ch.charCodeAt(0);
  let em;
  if (c >= 0x2e80 || (c >= 0xff00 && c <= 0xffef) || (c >= 0x3000 && c <= 0x303f)) em = 1;   // CJK / full-width
  else if (/[MW]/.test(ch)) em = 0.86;
  else if (/[A-Z%]/.test(ch)) em = 0.72;
  else if (/[0-9]/.test(ch)) em = 0.6;
  else if (/[mw]/.test(ch)) em = 0.82;
  else if (/[ilj.,:;'|!·]/.test(ch)) em = 0.32;
  else if (ch === " ") em = 0.32;
  else em = 0.57;
  // Conservative estimate: Latin glyphs in the fallback fonts (LibreOffice / no DengXian installed) are usually wider than in DengXian
  return em * size * PT * (bold ? 1.06 : 1);
}

/** Split into tokens: each CJK char is one token, Latin words are kept whole (with trailing spaces) */
function tokens(s) {
  return s.match(/[⺀-￿]|[^\s⺀-￿]+\s*|\s+/g) || [];
}

/**
 * @returns {{ lines:number, needH:number, orphan:string|null, longest:number }}
 */
function measure(text, { w, fontSize = 12, bold = false, charSpacing = 0, lineSpacingMultiple = 1, paraSpaceAfter = 0, indent = 0 }) {
  const width = Math.max(0.1, w - indent);
  const spacing = (charSpacing || 0) * PT;
  let lines = 0, orphan = null, longest = 0;
  const paras = String(text).split("\n");
  for (const para of paras) {
    if (!para.trim()) { lines += 1; continue; }
    let cur = 0, curText = "", paraLines = 1;
    for (const tok of tokens(para)) {
      const tw = [...tok].reduce((a, ch) => a + charWidth(ch, fontSize, bold) + spacing, 0);
      const twNoSpace = [...tok.trimEnd()].reduce((a, ch) => a + charWidth(ch, fontSize, bold) + spacing, 0);
      if (cur + twNoSpace <= width + 1e-6) { cur += tw; curText += tok; continue; }
      if (twNoSpace > width) {                   // an over-long word gets split across lines character by character
        for (const ch of tok) {
          const cw = charWidth(ch, fontSize, bold) + spacing;
          if (cur + cw > width) { paraLines++; longest = Math.max(longest, cur); cur = 0; curText = ""; }
          cur += cw; curText += ch;
        }
        continue;
      }
      paraLines++; longest = Math.max(longest, cur); cur = tw; curText = tok;
    }
    longest = Math.max(longest, cur);
    // Single-character line drop: a paragraph wraps to several lines and the last line has only 1–2 CJK chars (or is just a trailing punctuation mark)
    const last = curText.trim();
    if (paraLines > 1 && last && ([...last].length <= 2 || /^[⺀-￿][，。、；：！？”’）》]?$/.test(last))) orphan = last;
    lines += paraLines;
  }
  const lineH = fontSize * PT * 1.2 * lineSpacingMultiple;
  const needH = lines * lineH + Math.max(0, paras.length - 1) * (paraSpaceAfter || 0) * PT;
  return { lines, needH, orphan, longest };
}

module.exports = { measure, charWidth };
