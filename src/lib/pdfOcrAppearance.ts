import type { EditablePdfLine } from './pdfOcrTypes';
import { loadEditablePdfFont } from './pdfOcrDocument';

const faces = new Map<string, Promise<string>>();

function loadFace(family: EditablePdfLine['fontFamily'], bold: boolean): Promise<string> {
  const name = `OfficeOcr-${family}-${bold ? 'bold' : 'regular'}`;
  let face = faces.get(name);
  if (!face) {
    face = loadEditablePdfFont(family, bold).then(async (bytes) => {
      const font = await new FontFace(name, new Uint8Array(bytes).buffer).load();
      document.fonts.add(font);
      return name;
    });
    faces.set(name, face);
  }
  return face;
}

export async function matchOcrAppearance(source: HTMLCanvasElement, lines: EditablePdfLine[], pageWidth: number, pageHeight: number): Promise<void> {
  const candidates = await Promise.all((['sans', 'serif'] as const).flatMap((family) => [false, true].map(async (bold) => ({ family, bold, name: await loadFace(family, bold) }))));
  const original = document.createElement('canvas');
  const rendered = document.createElement('canvas');
  const widthScale = source.width / pageWidth, heightScale = source.height / pageHeight;
  const choices: { line: EditablePdfLine; scores: { family: 'sans' | 'serif'; bold: boolean; score: number }[] }[] = [];
  try {
    for (const line of lines) {
      original.width = rendered.width = Math.min(480, Math.max(32, Math.ceil(line.width * widthScale)));
      original.height = rendered.height = Math.min(80, Math.max(16, Math.ceil(line.height * heightScale)));
      const context = original.getContext('2d')!, paint = rendered.getContext('2d')!;
      context.drawImage(source, line.x * widthScale, line.y * heightScale, line.width * widthScale, line.height * heightScale, 0, 0, original.width, original.height);
      const scan = context.getImageData(0, 0, original.width, original.height).data;
      const brightness = Array.from({ length: original.width * original.height }, (_, index) => (scan[index * 4] + scan[index * 4 + 1] + scan[index * 4 + 2]) / 3);
      const paper = [...brightness].sort((a, b) => a - b)[Math.floor(brightness.length * 0.9)];
      const ink = line.color.reduce((sum, value) => sum + value, 0) * 85;
      const threshold = (paper + ink) / 2;
      const density = brightness.reduce((sum, value) => sum + (value < threshold ? 1 : 0), 0) / brightness.length;
      const scores: { family: 'sans' | 'serif'; bold: boolean; score: number }[] = [];
      for (const candidate of candidates) {
        paint.setTransform(1, 0, 0, 1, 0, 0);
        paint.fillStyle = '#fff'; paint.fillRect(0, 0, rendered.width, rendered.height);
        paint.font = `100px "${candidate.name}"`;
        const measured = paint.measureText(line.text);
        const inkWidth = measured.actualBoundingBoxLeft + measured.actualBoundingBoxRight;
        const inkHeight = measured.actualBoundingBoxAscent + measured.actualBoundingBoxDescent;
        if (!inkWidth || !inkHeight) continue;
        paint.scale(rendered.width / inkWidth, rendered.height / inkHeight);
        paint.fillStyle = '#000';
        paint.fillText(line.text, measured.actualBoundingBoxLeft, measured.actualBoundingBoxAscent);
        const pixels = paint.getImageData(0, 0, rendered.width, rendered.height).data;
        let score = 0, renderedDensity = 0;
        for (let index = 0; index < brightness.length; index++) {
          const coverage = (255 - pixels[index * 4]) / 255;
          score += Math.abs((brightness[index] < threshold ? 1 : 0) - coverage);
          renderedDensity += coverage;
        }
        score = score / brightness.length + Math.abs(renderedDensity / brightness.length - density) * 3;
        scores.push({ family: candidate.family, bold: candidate.bold, score });
      }
      if (scores.length) choices.push({ line, scores: scores.sort((a, b) => a.score - b.score) });
    }
    const familyScore = (family: 'sans' | 'serif') => choices.reduce((sum, entry) => sum + Math.min(...entry.scores.filter((candidate) => candidate.family === family).map((candidate) => candidate.score)) * Math.min(60, entry.line.text.length), 0);
    const dominant = familyScore('sans') <= familyScore('serif') ? 'sans' : 'serif';
    for (const { line, scores } of choices) {
      const consistent = scores.find((candidate) => candidate.family === dominant)!;
      const selected = line.text.length >= 8 && scores[0].score < consistent.score * 0.6 ? scores[0] : consistent;
      line.fontFamily = selected.family;
      line.bold = selected.bold;
    }
  } finally { original.width = original.height = rendered.width = rendered.height = 0; }
}
