export const IMAGE_FILTER_PRESETS = [
  { id: 'normal', name: 'Gốc', filter: 'none' },
  { id: 'bw', name: 'Trắng đen', filter: 'grayscale(100%)' },
  { id: 'sepia', name: 'Cổ điển', filter: 'sepia(80%)' },
  { id: 'vivid', name: 'Rực rỡ', filter: 'saturate(160%) contrast(110%)' },
  { id: 'warm', name: 'Ấm áp', filter: 'sepia(30%) saturate(130%)' },
  { id: 'cool', name: 'Lạnh', filter: 'hue-rotate(180deg) saturate(110%)' },
  { id: 'invert', name: 'Đảo màu', filter: 'invert(100%)' },
  { id: 'noir', name: 'Điện ảnh', filter: 'grayscale(100%) contrast(150%) brightness(90%)' },
  { id: 'blur', name: 'Làm mờ', filter: 'blur(3px)' },
];

export type ImageFilterSettings = {
  preset: string;
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  hue: number;
  preservedFilter: string;
};

const adjustments = [
  { function: 'brightness', key: 'brightness', unit: '%' },
  { function: 'contrast', key: 'contrast', unit: '%' },
  { function: 'saturate', key: 'saturation', unit: '%' },
  { function: 'blur', key: 'blur', unit: 'px' },
  { function: 'hue-rotate', key: 'hue', unit: 'deg' },
] as const;

function defaults(): ImageFilterSettings {
  return { preset: 'normal', brightness: 100, contrast: 100, saturation: 100, blur: 0, hue: 0, preservedFilter: '' };
}

function parseAdjustments(filter: string, settings: ImageFilterSettings): boolean {
  let remaining = filter;
  for (const adjustment of adjustments) {
    const expression = new RegExp(`^${adjustment.function}\\(([-+]?(?:\\d+(?:\\.\\d*)?|\\.\\d+))${adjustment.unit}\\)(?:\\s+|$)`);
    const match = expression.exec(remaining);
    if (!match) continue;
    const value = Number(match[1]);
    if (!Number.isFinite(value)) return false;
    settings[adjustment.key] = value;
    remaining = remaining.slice(match[0].length);
  }
  return remaining === '';
}

export function parseImageFilter(filter: string | undefined): ImageFilterSettings {
  const value = filter?.trim() ?? '';
  if (!value || value === 'none') return defaults();
  const presets = IMAGE_FILTER_PRESETS.filter((preset) => preset.id !== 'normal').sort((a, b) => b.filter.length - a.filter.length);
  for (const preset of presets) {
    if (value !== preset.filter && !value.startsWith(`${preset.filter} `)) continue;
    const settings = { ...defaults(), preset: preset.id };
    if (parseAdjustments(value.slice(preset.filter.length).trim(), settings)) return settings;
  }
  const settings = defaults();
  if (parseAdjustments(value, settings)) return settings;
  return { ...defaults(), preset: 'custom', preservedFilter: value };
}

export function buildImageFilter(settings: ImageFilterSettings): string {
  const preset = IMAGE_FILTER_PRESETS.find((item) => item.id === settings.preset)?.filter;
  const base = settings.preservedFilter || (preset === 'none' ? '' : preset);
  return [
    base,
    settings.brightness !== 100 ? `brightness(${settings.brightness}%)` : '',
    settings.contrast !== 100 ? `contrast(${settings.contrast}%)` : '',
    settings.saturation !== 100 ? `saturate(${settings.saturation}%)` : '',
    settings.blur > 0 ? `blur(${settings.blur}px)` : '',
    settings.hue !== 0 ? `hue-rotate(${settings.hue}deg)` : '',
  ].filter(Boolean).join(' ') || 'none';
}
