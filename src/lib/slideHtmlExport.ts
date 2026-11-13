import type { PresentationData, SlideElement } from './slideTypes';
import { getShapeDef } from './slideShapes';

const DEFAULT_TITLE = 'Bài Thuyết Trình 23 Slides';

export function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function serializeJsonForHtml(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

const PLAYER_SCRIPT = `
(function () {
  var deck = JSON.parse(document.getElementById('deck-data').textContent);
  var slides = deck.slides.filter(function (slide) { return !slide.hidden; });
  var stage = document.getElementById('stage');
  var pageIndicator = document.getElementById('pageIndicator');
  var currentIdx = 0;
  if (deck.aspectRatio === '4:3') stage.className = 'slide-stage is-4x3';
  else if (deck.aspectRatio && deck.aspectRatio !== '16:9') stage.style.setProperty('aspect-ratio', String(({ '16:10': 864, A4: 764, '1:1': 540 })[deck.aspectRatio] / 540 || 16 / 9));

  function backgroundCss(background) {
    if (!background || !background.value) return '#FFFFFF';
    if (background.type === 'image') {
      var value = String(background.value);
      if (/^url\\(/i.test(value)) return value + ' center / cover no-repeat';
      return 'url("' + value.replace(/["\\\\]/g, '') + '") center / cover no-repeat';
    }
    return background.value;
  }

  function applyBox(node, el) {
    node.style.left = el.x + '%';
    node.style.top = el.y + '%';
    node.style.width = el.width + '%';
    node.style.height = el.height + '%';
    if (el.rotation) node.style.transform = 'rotate(' + el.rotation + 'deg)';
    if (el.opacity !== undefined && el.opacity !== null) node.style.opacity = String(el.opacity);
    if (el.zIndex !== undefined && el.zIndex !== null) node.style.zIndex = String(el.zIndex);
  }

  function applyText(node, el) {
    node.style.color = el.color || '#1E293B';
    node.style.fontSize = 'calc(' + (el.fontSize || 18) + ' * var(--unit))';
    node.style.fontWeight = el.fontWeight || 'normal';
    node.style.fontStyle = el.fontStyle || 'normal';
    node.style.textDecoration = el.textDecoration || 'none';
    node.style.textAlign = el.textAlign || 'left';
    if (el.fontFamily) node.style.fontFamily = el.fontFamily;
    node.style.justifyContent = el.textAlign === 'center' ? 'center' : el.textAlign === 'right' ? 'flex-end' : 'flex-start';
    node.style.alignItems = el.verticalAlign === 'top' ? 'flex-start' : el.verticalAlign === 'bottom' ? 'flex-end' : 'center';
  }

  function renderTable(node, el) {
    var table = document.createElement('table');
    (el.tableData || []).forEach(function (row, rowIdx) {
      var tr = document.createElement('tr');
      row.forEach(function (cell) {
        var td = document.createElement(rowIdx === 0 && el.tableHeaderRow !== false ? 'th' : 'td');
        td.textContent = cell;
        if (rowIdx === 0 && el.tableHeaderRow !== false) {
          td.style.background = el.tableHeaderColor || '#0F172A';
          td.style.color = el.tableHeaderTextColor || '#FFFFFF';
        }
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    node.appendChild(table);
  }

  function renderElement(el) {
    var node = document.createElement('div');
    node.className = 'element';
    applyBox(node, el);
    if (el.type === 'image' && el.src) {
      var img = document.createElement('img');
      img.src = el.src;
      img.alt = el.alt || '';
      img.style.objectFit = el.objectFit || 'contain';
      node.appendChild(img);
      return node;
    }
    if (el.type === 'table') {
      renderTable(node, el);
      return node;
    }
    if (el.type === 'shape') {
      var gradient = el.fillType === 'gradient' && el.gradient;
      node.style.background = el.fillType === 'none' ? 'transparent' : (gradient || el.fill || 'transparent');
      if (el.stroke && el.strokeWidth) node.style.border = el.strokeWidth + 'px ' + (el.borderStyle || 'solid') + ' ' + el.stroke;
      if (el.shapeLine) {
        var lineColor = el.stroke && el.stroke !== 'transparent' ? el.stroke : (el.fill || '#0284C7');
        node.style.border = 'none';
        node.style.background = 'linear-gradient(' + lineColor + ', ' + lineColor + ') center / 100% ' + (el.strokeWidth || 2) + 'px no-repeat';
      } else if (el.shapeMask) {
        node.style.webkitMaskImage = el.shapeMask;
        node.style.maskImage = el.shapeMask;
        node.style.webkitMaskSize = '100% 100%';
        node.style.maskSize = '100% 100%';
        node.style.webkitMaskRepeat = 'no-repeat';
        node.style.maskRepeat = 'no-repeat';
      }
    }
    applyText(node, el);
    node.textContent = el.text || '';
    return node;
  }

  function renderSlide(idx) {
    stage.innerHTML = '';
    if (slides.length === 0) {
      stage.style.background = '#FFFFFF';
      pageIndicator.textContent = '0 / 0';
      return;
    }
    var slide = slides[idx];
    stage.style.background = backgroundCss(slide.background);
    (slide.elements || []).forEach(function (el) { stage.appendChild(renderElement(el)); });
    pageIndicator.textContent = (idx + 1) + ' / ' + slides.length;
  }

  function go(delta) {
    var next = currentIdx + delta;
    if (next < 0 || next >= slides.length) return;
    currentIdx = next;
    renderSlide(currentIdx);
  }

  renderSlide(0);
  document.getElementById('prevBtn').onclick = function () { go(-1); };
  document.getElementById('nextBtn').onclick = function () { go(1); };
  window.onkeydown = function (e) {
    if (['ArrowRight', ' ', 'PageDown', 'Enter'].indexOf(e.key) >= 0) go(1);
    else if (['ArrowLeft', 'PageUp', 'Backspace'].indexOf(e.key) >= 0) go(-1);
  };
})();
`;

function withShapeMask(el: SlideElement): SlideElement & { shapeMask?: string; shapeLine?: boolean } {
  if (el.type !== 'shape') return el;
  const custom = el.shapeType === 'custom' && el.customPath;
  const def = getShapeDef(el.shapeType);
  if (!custom && def.line) return { ...el, shapeLine: true };
  if (!custom && def.id === 'rectangle') return el;
  const d = custom ? el.customPath : def.d;
  const rule = custom || def.evenOdd ? 'evenodd' : 'nonzero';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="${d}" fill-rule="${rule}"/></svg>`;
  return { ...el, shapeMask: `url("data:image/svg+xml,${encodeURIComponent(svg)}")` };
}

export function buildStandaloneHtml(presentation: PresentationData): string {
  const title = escapeHtmlText(presentation.title || DEFAULT_TITLE);
  const deck = {
    aspectRatio: presentation.aspectRatio,
    slides: presentation.slides.map((slide) => ({ ...slide, elements: slide.elements.map(withShapeMask) })),
  };
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0F172A; color: #FFF; font-family: Segoe UI, sans-serif; overflow: hidden; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
    .slide-stage { --unit: calc(min(90vw, 156vh) / 960); width: min(90vw, 156vh); aspect-ratio: 16 / 9; background: #FFF; border-radius: 8px; position: relative; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5); }
    .slide-stage.is-4x3 { --unit: calc(min(90vw, 117vh) / 720); width: min(90vw, 117vh); aspect-ratio: 4 / 3; }
    .element { position: absolute; display: flex; align-items: center; white-space: pre-wrap; overflow: hidden; }
    .element img { width: 100%; height: 100%; }
    .element table { width: 100%; height: 100%; border-collapse: collapse; color: #1E293B; font-size: calc(14 * var(--unit)); }
    .element th, .element td { border: 1px solid #CBD5E1; padding: 4px 8px; text-align: left; }
    .controls { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(15,23,42,0.9); padding: 8px 16px; border-radius: 999px; display: flex; gap: 12px; align-items: center; z-index: 100; font-size: 13px; }
    .btn { background: #334155; border: none; color: #FFF; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: 600; }
    .btn:hover { background: #475569; }
  </style>
</head>
<body>
  <div class="slide-stage" id="stage"></div>
  <div class="controls">
    <button class="btn" id="prevBtn">&lsaquo; Trước</button>
    <span id="pageIndicator" style="font-weight: 700; color: #38BDF8;"></span>
    <button class="btn" id="nextBtn">Sau &rsaquo;</button>
  </div>
  <script type="application/json" id="deck-data">${serializeJsonForHtml(deck)}</script>
  <script>${PLAYER_SCRIPT}</script>
</body>
</html>`;
}
