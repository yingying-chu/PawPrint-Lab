// Embroidery-style lettering: single-stroke fonts (fonts/stitch-fonts.json) drawn
// as running or chain stitches in SVG. Exposes window.Lettering.
(() => {
  // Resolve next to this script, so it works from any page.
  const FONTS_URL = new URL("fonts/stitch-fonts.json", document.currentScript?.src || location.href);
  let fontsRequest = null;
  const loadFonts = () =>
    (fontsRequest ||= fetch(FONTS_URL)
      .then((response) => response.json())
      .then((data) => data.fonts));

  // Glyph strokes in output units (y down), laid out left to right.
  function layoutLine(font, text, size) {
    const scale = size / font.unitsPerEm;
    const strokes = [];
    let x = 0;
    for (const ch of text) {
      const glyph = font.glyphs[ch] || font.glyphs["?"];
      for (const stroke of glyph.s) strokes.push(stroke.map(([gx, gy]) => [x + gx * scale, -gy * scale]));
      x += glyph.a * scale;
    }
    return { strokes, width: x };
  }

  // Closed outlines for the optional motif, as polylines centred on (cx, cy).
  function motifStrokes(kind, cx, cy, r) {
    const circle = (x, y, rad, n = 20) =>
      Array.from({ length: n + 1 }, (_, i) => [x + rad * Math.cos((i / n) * Math.PI * 2), y + rad * Math.sin((i / n) * Math.PI * 2)]);
    if (kind === "paw") {
      return [
        circle(cx, cy + r * 0.35, r * 0.55, 24),
        circle(cx - r * 0.72, cy - r * 0.35, r * 0.24),
        circle(cx - r * 0.26, cy - r * 0.72, r * 0.24),
        circle(cx + r * 0.26, cy - r * 0.72, r * 0.24),
        circle(cx + r * 0.72, cy - r * 0.35, r * 0.24),
      ];
    }
    if (kind === "heart") {
      return [
        Array.from({ length: 41 }, (_, i) => {
          const t = (i / 40) * Math.PI * 2;
          const x = 16 * Math.sin(t) ** 3;
          const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
          return [cx + (x / 17) * r, cy - (y / 17) * r];
        }),
      ];
    }
    return [];
  }

  // Points every `step` along a polyline, so stitches sit on the stroke itself.
  function resample(points, step) {
    const out = [points[0]];
    let carry = 0;
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      const length = Math.hypot(x1 - x0, y1 - y0);
      let along = step - carry;
      while (along <= length) {
        const t = along / length;
        out.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
        along += step;
      }
      carry = length - (along - step);
    }
    const last = points[points.length - 1];
    const tail = out[out.length - 1];
    if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > step * 0.35) out.push(last);
    return out;
  }

  function mix(hex, toward, amount) {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    const t = toward === "white" ? 255 : 0;
    return `rgb(${c.map((v) => Math.round(v + (t - v) * amount)).join(",")})`;
  }

  const f = (n) => Math.round(n * 10) / 10;

  /** One stitch: a soft shadow, the thread, and a sheen along its upper edge. */
  function runningStitches(points, w, thread, index) {
    const sheen = mix(thread, "white", 0.45);
    let out = "";
    for (let i = 0; i + 1 < points.length; i += 2) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[i + 1];
      const d = `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`;
      out +=
        `<g class="st" style="--i:${index.value++}">` +
        `<path d="M${f(x0 + w * 0.25)} ${f(y0 + w * 0.35)}L${f(x1 + w * 0.25)} ${f(y1 + w * 0.35)}" stroke="rgba(40,30,20,.22)" stroke-width="${f(w)}"/>` +
        `<path d="${d}" stroke="${thread}" stroke-width="${f(w)}"/>` +
        `<path d="M${f(x0 - w * 0.12)} ${f(y0 - w * 0.18)}L${f(x1 - w * 0.12)} ${f(y1 - w * 0.18)}" stroke="${sheen}" stroke-width="${f(w * 0.32)}" opacity=".75"/>` +
        `</g>`;
    }
    return out;
  }

  /** Chain stitch: linked teardrop loops, each starting where the last one ends. */
  function chainStitches(points, w, thread, index) {
    const sheen = mix(thread, "white", 0.45);
    let out = "";
    for (let i = 0; i + 1 < points.length; i++) {
      const [x0, y0] = points[i];
      const [x1, y1] = points[i + 1];
      const dx = x1 - x0;
      const dy = y1 - y0;
      const length = Math.hypot(dx, dy) || 1;
      const nx = (-dy / length) * length * 0.36;
      const ny = (dx / length) * length * 0.36;
      // Loop out from the start point, round the far end, and back.
      const tip = [x1 + dx * 0.12, y1 + dy * 0.12];
      const d =
        `M${f(x0)} ${f(y0)}C${f(x0 + dx * 0.25 + nx)} ${f(y0 + dy * 0.25 + ny)} ${f(tip[0] + nx * 0.9)} ${f(tip[1] + ny * 0.9)} ${f(tip[0])} ${f(tip[1])}` +
        `C${f(tip[0] - nx * 0.9)} ${f(tip[1] - ny * 0.9)} ${f(x0 + dx * 0.25 - nx)} ${f(y0 + dy * 0.25 - ny)} ${f(x0)} ${f(y0)}`;
      out +=
        `<g class="st" style="--i:${index.value++}">` +
        `<path d="${d}" transform="translate(${f(w * 0.25)} ${f(w * 0.35)})" stroke="rgba(40,30,20,.2)" stroke-width="${f(w)}"/>` +
        `<path d="${d}" stroke="${thread}" stroke-width="${f(w)}"/>` +
        `<path d="${d}" transform="translate(${f(-w * 0.12)} ${f(-w * 0.15)})" stroke="${sheen}" stroke-width="${f(w * 0.3)}" opacity=".6"/>` +
        `</g>`;
    }
    return out;
  }

  /**
   * Renders lettering as an SVG string.
   * options: { text, subline, font, stitch: "running" | "chain", thread, motif: "none" | "paw" | "heart" }
   */
  async function render(options) {
    const fonts = await loadFonts();
    const font = fonts[options.font] || fonts.rounded;
    const size = 120;
    const lines = [
      { text: options.text || " ", size },
      ...(options.subline ? [{ text: options.subline, size: size * 0.42 }] : []),
    ].map((line) => ({ ...line, ...layoutLine(font, line.text, line.size) }));

    const motifSize = options.motif && options.motif !== "none" ? size * 0.42 : 0;
    const gap = size * 0.28;
    const rowWidth = (line, i) => line.width + (i === 0 && motifSize ? gap + motifSize * 2 : 0);
    const width = Math.max(...lines.map(rowWidth));

    const strokes = [];
    let baseline = size * (font.capHeight / font.unitsPerEm) * 1.25;
    lines.forEach((line, i) => {
      const left = (width - rowWidth(line, i)) / 2;
      for (const stroke of line.strokes) strokes.push({ pts: stroke.map(([x, y]) => [x + left, y + baseline]), size: line.size });
      if (i === 0 && motifSize) {
        const cx = left + line.width + gap + motifSize;
        const cy = baseline - line.size * (font.capHeight / font.unitsPerEm) * 0.5;
        for (const pts of motifStrokes(options.motif, cx, cy, motifSize)) strokes.push({ pts, size: line.size });
      }
      baseline += line.size * 0.55 + (lines[i + 1]?.size ?? 0) * 0.95;
    });

    const chain = options.stitch === "chain";
    const index = { value: 0 };
    let body = "";
    for (const { pts, size: s } of strokes) {
      const w = s * (chain ? 0.022 : 0.04);
      const step = s * (chain ? 0.062 : 0.07);
      const points = resample(pts, step);
      body += chain ? chainStitches(points, w, options.thread, index) : runningStitches(points, w, options.thread, index);
    }

    const all = strokes.flatMap((s) => s.pts);
    const pad = size * 0.25;
    const minX = Math.min(...all.map((p) => p[0])) - pad;
    const minY = Math.min(...all.map((p) => p[1])) - pad;
    const vbW = Math.max(...all.map((p) => p[0])) + pad - minX;
    const vbH = Math.max(...all.map((p) => p[1])) + pad - minY;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" class="lettering-svg" viewBox="${f(minX)} ${f(minY)} ${f(vbW)} ${f(vbH)}" ` +
      `width="${Math.round(vbW)}" height="${Math.round(vbH)}" fill="none" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${(options.text || "").replace(/[<>&"]/g, "")} in embroidery lettering">` +
      body +
      "</svg>";
    return { svg, width: vbW, height: vbH, stitches: index.value };
  }

  /** Rasterises a rendered SVG to a transparent PNG blob. */
  async function toPng(svg, width, height, scale = 3) {
    // Drop the animation class so every stitch is visible in the export.
    const still = svg.replace('class="lettering-svg"', "");
    const url = URL.createObjectURL(new Blob([still], { type: "image/svg+xml" }));
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  window.Lettering = { render, toPng, loadFonts };
})();
