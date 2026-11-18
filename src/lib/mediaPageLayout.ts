import type { MediaPage, MediaTextLine } from './mediaConversion';

export function wordPageSize(page: Pick<MediaPage, 'width' | 'height'>) {
  const scale = Math.min(1, 1584 / Math.max(page.width, page.height));
  const width = page.width * scale;
  const height = page.height * scale;
  return {
    width, height,
    size: {
      width: Math.round(Math.min(width, height) * 20),
      height: Math.round(Math.max(width, height) * 20),
      orientation: width > height ? 'landscape' as const : 'portrait' as const,
    },
  };
}

type Widget = {
  subtype?: string; fieldType?: string; fieldValue?: string | string[]; rect?: number[];
  checkBox?: boolean; radioButton?: boolean; exportValue?: string; buttonValue?: string;
  options?: { displayValue: string; exportValue: string }[]; password?: boolean; hidden?: boolean;
  fieldName?: string; alternativeText?: string; multiLine?: boolean; multiSelect?: boolean; readOnly?: boolean;
};

export type PdfFormField = {
  kind: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio';
  name: string; label: string; checked: boolean; readOnly: boolean; multiple: boolean;
  choices: { displayValue: string; exportValue: string }[]; values: string[]; line: MediaTextLine;
};

export function pdfFormFields(annotations: Widget[], toViewport: (x: number, y: number) => number[]): PdfFormField[] {
  const fields: PdfFormField[] = [];
  for (const field of annotations) {
    if (field.subtype !== 'Widget' || field.password || field.hidden || field.rect?.length !== 4) continue;
    const value = field.fieldValue;
    const values = (Array.isArray(value) ? value : [value]).filter((entry): entry is string => typeof entry === 'string');
    let kind: PdfFormField['kind'];
    if (field.fieldType === 'Tx') kind = field.multiLine ? 'textarea' : 'text';
    else if (field.fieldType === 'Ch') kind = 'select';
    else if (field.checkBox || field.radioButton) kind = field.checkBox ? 'checkbox' : 'radio';
    else continue;
    const selected = field.checkBox ? field.exportValue : field.buttonValue;
    const checked = !!selected && selected !== 'Off' && value === selected;
    const choices = field.options ?? [];
    const text = kind === 'checkbox' || kind === 'radio' ? (checked ? '☑' : '☐') :
      values.map((entry) => choices.find((option) => option.exportValue === entry)?.displayValue ?? entry).join(', ');
    const [left, top] = toViewport(field.rect[0], field.rect[1]);
    const [right, bottom] = toViewport(field.rect[2], field.rect[3]);
    const width = Math.abs(right - left);
    const height = Math.abs(bottom - top);
    if (width && height) fields.push({
      kind, values, choices, checked, name: field.fieldName ?? '', label: field.alternativeText || field.fieldName || 'Ô biểu mẫu',
      readOnly: !!field.readOnly, multiple: !!field.multiSelect,
      line: { text, x: Math.min(left, right), y: Math.min(top, bottom), width, height },
    });
  }
  return fields;
}

export function includeWidgetValues(lines: MediaTextLine[], fields: MediaTextLine[]): MediaTextLine[] {
  if (!fields.length) return lines;
  const filled = fields.filter((field) => field.text.trim());
  return [...lines.filter((line) => !filled.some((field) => {
    const x = line.x + line.width / 2;
    const y = line.y + line.height / 2;
    return x >= field.x && x <= field.x + field.width && y >= field.y && y <= field.y + field.height && field.text.includes(line.text.trim());
  })), ...filled];
}
