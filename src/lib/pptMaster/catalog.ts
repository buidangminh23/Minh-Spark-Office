export type PptMasterPalette = { background: string; surface: string; primary: string; accent: string; text: string; muted: string };

export type PptMasterTokens = {
  dark: boolean;
  radius: number;
  shadow: boolean;
  glow: boolean;
  outline: number;
  rule: 'none' | 'thin' | 'heavy' | 'double';
  motif: 'none' | 'grid' | 'dots' | 'confetti' | 'band' | 'disc' | 'brackets' | 'stamp' | 'halftone' | 'pixels' | 'layers';
  titleFont: string;
  bodyFont: string;
  labelFont: string;
  titleCase: 'none' | 'upper';
  titleWeight: 'bold' | '800';
  palette: PptMasterPalette;
};

export type PptMasterStyle = {
  id: string;
  label: string;
  group: 'corporate' | 'editorial' | 'expressive' | 'hand' | 'specialty';
  summary: string;
  character: string;
  rules: string[];
  tokens: PptMasterTokens;
};

export type PptMasterMode = { id: string; label: string; summary: string; skeleton: string[]; titleVoice: string; notesRegister: string };

export const PPT_MASTER_GROUPS: Record<PptMasterStyle['group'], string> = {
  corporate: 'Doanh nghiệp / sản phẩm',
  editorial: 'Báo chí / ấn phẩm',
  expressive: 'Biểu cảm / in ấn',
  hand: 'Vẽ tay / bút lông',
  specialty: 'Đặc biệt',
};

const SANS = 'Segoe UI';
const SERIF = 'Georgia';
const MONO = 'Consolas';
const HAND = 'Comic Sans MS';

const base = (overrides: Partial<PptMasterTokens> & { palette: PptMasterPalette }): PptMasterTokens => ({
  dark: false,
  radius: 0,
  shadow: false,
  glow: false,
  outline: 0,
  rule: 'none',
  motif: 'none',
  titleFont: SANS,
  bodyFont: SANS,
  labelFont: SANS,
  titleCase: 'none',
  titleWeight: 'bold',
  ...overrides,
});

export const PPT_MASTER_STYLES: PptMasterStyle[] = [
  {
    id: 'swiss-minimal', label: 'Swiss tối giản', group: 'corporate', summary: 'Lưới chặt, góc vuông, khoảng trắng lớn',
    character: 'Grid-locked, sharp, aggressive whitespace, near-zero ornament.',
    rules: ['One oversized geometric plane or hero numeral zones the page; content flush to one axis.', 'No ornamental gradients, badges or decorative blocks; structure carries the page.', 'Single sans family, strong size hierarchy, left-aligned.', 'Color as conceptual zone, strictly flat, no shadows.'],
    tokens: base({ rule: 'heavy', motif: 'band', palette: { background: '#FFFFFF', surface: '#F4F4F4', primary: '#111111', accent: '#E30613', text: '#111111', muted: '#6B6B6B' } }),
  },
  {
    id: 'soft-rounded', label: 'Bo tròn mềm', group: 'corporate', summary: 'Thẻ bo tròn, bóng nhẹ, thân thiện',
    character: 'Rounded cards, gentle elevation, approachable.',
    rules: ['Rounded cards as the primary container, pill tags, numbered circles.', 'A large soft disc bleeding off one edge as a color field.', 'Friendly humanist sans, medium weights.', 'Gentle soft shadows on floating cards; peer cards stay flat.'],
    tokens: base({ radius: 18, shadow: true, motif: 'disc', palette: { background: '#F7F8FC', surface: '#FFFFFF', primary: '#4F46E5', accent: '#F59E0B', text: '#1F2937', muted: '#6B7280' } }),
  },
  {
    id: 'glassmorphism', label: 'Kính mờ', group: 'corporate', summary: 'Tấm kính trong suốt, ánh sáng gradient',
    character: 'Translucent glass panels, gradient light, floating depth.',
    rules: ['Frosted translucent panels floating over a luminous gradient field.', 'Thin light borders on panels; depth from layering.', 'Clean modern sans with generous tracking on labels.', 'Restrained content; the material carries the premium feel.'],
    tokens: base({ dark: true, radius: 20, glow: true, motif: 'disc', palette: { background: '#1E1B4B', surface: '#FFFFFF', primary: '#A78BFA', accent: '#22D3EE', text: '#F8FAFC', muted: '#C7D2FE' } }),
  },
  {
    id: 'dark-tech', label: 'Công nghệ tối', group: 'corporate', summary: 'Nền tối, điểm sáng phát quang, hình học chính xác',
    character: 'Dark canvas, glow accents, geometric precision.',
    rules: ['Thin glowing rules, fine grid backgrounds, node and connector lines used sparingly.', 'Concentric rings or an oversized low-opacity numeral behind the content.', 'Clean sans body, monospace for labels and figures.', 'Depth via glow and layering, not drop shadows.'],
    tokens: base({ dark: true, radius: 4, glow: true, motif: 'grid', labelFont: MONO, palette: { background: '#0B1120', surface: '#111A2E', primary: '#38BDF8', accent: '#22D3A6', text: '#E2E8F0', muted: '#94A3B8' } }),
  },
  {
    id: 'blueprint', label: 'Bản vẽ kỹ thuật', group: 'corporate', summary: 'Nét kẻ sơ đồ trên nền giấy xanh',
    character: 'Schematic line work on dark paper, isometric, annotated.',
    rules: ['Schematic outlines, dimension lines and callout annotations.', 'Fine engineering grid across the sheet.', 'Technical sans with monospace annotations.', 'Line weight does the hierarchy; flat fills avoided.'],
    tokens: base({ dark: true, outline: 1.5, motif: 'grid', labelFont: MONO, palette: { background: '#0F3A6B', surface: '#134780', primary: '#E0F2FE', accent: '#FBBF24', text: '#E0F2FE', muted: '#93C5FD' } }),
  },
  {
    id: 'editorial', label: 'Tạp chí', group: 'editorial', summary: 'Phân cấp kiểu tạp chí, đường kẻ và cột',
    character: 'Magazine hierarchy, rules and columns, serif/sans interplay.',
    rules: ['Rules and columns organize the page; a kicker above the headline.', 'Serif display headlines with sans body.', 'Pull quotes and lead-in text carry emphasis.', 'Flat, paper-like, minimal color.'],
    tokens: base({ rule: 'double', titleFont: SERIF, palette: { background: '#FBF8F3', surface: '#FFFFFF', primary: '#1C1917', accent: '#B91C1C', text: '#292524', muted: '#78716C' } }),
  },
  {
    id: 'photo-editorial', label: 'Ảnh báo chí', group: 'editorial', summary: 'Mảng màu lớn như ảnh tràn viền, chữ chú thích',
    character: 'Full-bleed photography dominates, text points and captions.',
    rules: ['A dominant full-bleed visual field with text overlaid on a scrim.', 'Short captions and points rather than paragraphs.', 'Serif or refined sans headlines.', 'Color comes from the visual field; type stays neutral.'],
    tokens: base({ dark: true, motif: 'band', titleFont: SERIF, palette: { background: '#1C1917', surface: '#292524', primary: '#FAFAF9', accent: '#F59E0B', text: '#F5F5F4', muted: '#A8A29E' } }),
  },
  {
    id: 'data-journalism', label: 'Báo chí dữ liệu', group: 'editorial', summary: 'Nhiều biểu đồ nhỏ, cột bên, dòng nguồn',
    character: 'Multi-column micro-charts, sidebars, source lines, dense.',
    rules: ['Dense multi-column evidence with sidebars and micro-charts.', 'Every data element carries a source line.', 'Compact sans, tabular figures.', 'One highlight color marks the finding; everything else grey.'],
    tokens: base({ rule: 'thin', palette: { background: '#FFFFFF', surface: '#F3F4F6', primary: '#111827', accent: '#DC2626', text: '#111827', muted: '#6B7280' } }),
  },
  {
    id: 'brutalist', label: 'Brutalist', group: 'editorial', summary: 'Mật độ báo in, hộp kẻ thô, phẳng',
    character: 'Newsprint density, ruled boxes, raw structure, flat.',
    rules: ['Heavy ruled boxes and raw structural grid.', 'Uppercase heavy headlines, monospace details.', 'Flat blocks, no shadows, no gradients.', 'Dense but legible.'],
    tokens: base({ outline: 3, rule: 'heavy', titleCase: 'upper', titleWeight: '800', labelFont: MONO, palette: { background: '#F2F0E6', surface: '#FFFFFF', primary: '#000000', accent: '#FF4F00', text: '#000000', muted: '#4B4B4B' } }),
  },
  {
    id: 'memphis', label: 'Memphis', group: 'expressive', summary: 'Khối màu tương phản, hoa giấy hình học, viền đậm',
    character: 'Clashing color blocks, geometric confetti, bold outlines.',
    rules: ['Bold geometric primitives with thick dark outlines and scattered confetti.', 'A giant primitive bleeding off one edge as backdrop.', 'Heavy display headlines, neutral readable body.', 'Optional hard-offset sticker shadows; no soft shadows.'],
    tokens: base({ radius: 6, outline: 3, motif: 'confetti', titleWeight: '800', palette: { background: '#FFF8E7', surface: '#FFFFFF', primary: '#FF3EA5', accent: '#00B8D9', text: '#1A1A1A', muted: '#5C5C5C' } }),
  },
  {
    id: 'zine', label: 'Zine', group: 'expressive', summary: 'In riso lệch màu, chấm tram, bảng màu hạn chế',
    character: 'Riso misregistration, halftone, limited palette, print grit.',
    rules: ['Two or three ink colors, slight misregistration offsets.', 'Halftone dot fields and cut-out blocks.', 'Condensed or typewriter headlines.', 'Flat ink, no gradients, no shadows.'],
    tokens: base({ motif: 'halftone', titleCase: 'upper', titleWeight: '800', labelFont: MONO, palette: { background: '#F6F1E7', surface: '#FFFFFF', primary: '#FF48B0', accent: '#0078BF', text: '#1F1F1F', muted: '#545454' } }),
  },
  {
    id: 'vintage-poster', label: 'Poster cổ điển', group: 'expressive', summary: 'Khối phẳng giữa thế kỷ, ấm áp hoài cổ',
    character: 'Mid-century flat blocks, halftone, retro-geometric warmth.',
    rules: ['Flat mid-century color blocks and sunburst geometry.', 'Warm muted palette with cream paper.', 'Display serif or slab headlines.', 'Flat print look, no soft shadows.'],
    tokens: base({ radius: 2, motif: 'disc', titleFont: SERIF, titleCase: 'upper', palette: { background: '#F3E9D2', surface: '#FBF5E6', primary: '#C0392B', accent: '#E8A33D', text: '#2C2A26', muted: '#6E6658' } }),
  },
  {
    id: 'paper-cut', label: 'Giấy cắt', group: 'expressive', summary: 'Lớp giấy cắt chồng, bóng mềm giữa các lớp',
    character: 'Layered cut-paper sheets, soft inter-layer shadow, tactile.',
    rules: ['Stacked paper layers with soft shadows between them.', 'Organic cut edges and tactile depth.', 'Friendly rounded sans.', 'Same-hue tonal layers.'],
    tokens: base({ radius: 24, shadow: true, motif: 'layers', palette: { background: '#FDF4E3', surface: '#FFFFFF', primary: '#2A9D8F', accent: '#E76F51', text: '#264653', muted: '#5F7A80' } }),
  },
  {
    id: 'sketch-notes', label: 'Ghi chú vẽ tay', group: 'hand', summary: 'Giấy ấm, nét vẽ nguệch ngoạc, khối pastel',
    character: 'Warm paper, doodle line work, soft pastel blocks.',
    rules: ['Doodle outlines, arrows and hand-drawn boxes.', 'Soft pastel highlight blocks behind key words.', 'Hand-lettered titles, legible body.', 'Flat, paper texture, no shadows.'],
    tokens: base({ radius: 10, outline: 2, motif: 'dots', titleFont: HAND, palette: { background: '#FFFBF0', surface: '#FFFFFF', primary: '#3A3A3A', accent: '#FFB4A2', text: '#2B2B2B', muted: '#6D6D6D' } }),
  },
  {
    id: 'ink-notes', label: 'Mực đen', group: 'hand', summary: 'Nền nhạt, nét mực đen, điểm nhấn thưa',
    character: 'Pale field, black hand-ink, sparse semantic accent.',
    rules: ['Black ink line work on a pale field.', 'One sparse accent color for meaning only.', 'Hand-ink titles, clean body.', 'Flat, no shadows.'],
    tokens: base({ outline: 1.5, rule: 'thin', titleFont: HAND, palette: { background: '#FAFAF7', surface: '#FFFFFF', primary: '#111111', accent: '#2563EB', text: '#111111', muted: '#666666' } }),
  },
  {
    id: 'chalkboard', label: 'Bảng phấn', group: 'hand', summary: 'Bảng đen, nét phấn, điểm nhấn pastel',
    character: 'Dark slate, chalk strokes, powdery pastel accents.',
    rules: ['Chalk-stroke boxes, brackets, arrows and one big chalk ring around the key term.', 'Off-white chalk carries most marks; pastel accents used sparingly.', 'Hand-lettered chalk titles, legible body.', 'Flat, chalk-dust grain, no shadows.'],
    tokens: base({ dark: true, outline: 2, motif: 'brackets', titleFont: HAND, palette: { background: '#2F3E36', surface: '#36483F', primary: '#F5F5F0', accent: '#F9D976', text: '#F1F1EA', muted: '#B9C4BC' } }),
  },
  {
    id: 'ink-wash', label: 'Thuỷ mặc', group: 'hand', summary: 'Giấy dó trắng, nét bút lông, dấu triện',
    character: 'Rice-paper whitespace, brush marks, seal accent, still.',
    rules: ['Vast rice-paper whitespace with a few brush marks.', 'A small red seal stamp as the single accent.', 'Calligraphic or serif titles, quiet body.', 'Ink gradients in greys only; still and balanced.'],
    tokens: base({ motif: 'stamp', titleFont: SERIF, palette: { background: '#F7F4EC', surface: '#FFFFFF', primary: '#1F1F1F', accent: '#B22222', text: '#2A2A2A', muted: '#7A7468' } }),
  },
  {
    id: 'pixel-art', label: 'Pixel art', group: 'specialty', summary: 'Lưới pixel chặt, khối vuông, bảng màu hạn chế',
    character: 'Strict pixel grid, blocky forms, limited palette, flat.',
    rules: ['Blocky square forms snapped to a pixel grid.', 'Limited palette, hard edges, no anti-aliasing feel.', 'Monospace or pixel-style headlines.', 'Flat, stepped shadows only.'],
    tokens: base({ outline: 3, motif: 'pixels', titleFont: MONO, labelFont: MONO, titleCase: 'upper', palette: { background: '#1D2B53', surface: '#29366F', primary: '#FFEC27', accent: '#FF004D', text: '#FFF1E8', muted: '#C2C3C7' }, dark: true }),
  },
];

export const PPT_MASTER_MODES: PptMasterMode[] = [
  {
    id: 'pyramid', label: 'Kim tự tháp', summary: 'Kết luận trước, luận cứ có cấu trúc. Hợp báo cáo lãnh đạo, chiến lược',
    skeleton: ['SCQA opening: situation, complication, implicit question, then the answer.', 'Each body page centres on one decision-relevant question and states its conclusion.', 'Decompose drivers or options into meaningfully distinct branches; never fabricate a perfect MECE split.', 'Pair figures with a supported comparison only when the source has one; never invent benchmarks or prior periods.', 'Put a source line on every data page.'],
    titleVoice: 'Assertion titles: the title IS the conclusion, e.g. "Retention, not acquisition, now drives growth".',
    notesRegister: 'Open with the takeaway, then a compact set of supporting facts in flowing prose. Composed and authoritative.',
  },
  {
    id: 'narrative', label: 'Kể chuyện', summary: 'Bối cảnh → căng thẳng → giải pháp. Hợp gọi vốn, case study',
    skeleton: ['Arc across the deck: scenario, conflict, resolution, with a reframe or reveal where the material supports it.', 'Pose a question and pay it off when the evidence lands.', 'Anchor abstract points in a protagonist, a moment or a concrete stake.', 'Vary dense and breathing pages by tension, not mechanically.'],
    titleVoice: 'Titles read as beats that advance the arc, e.g. "Then the numbers stopped adding up".',
    notesRegister: 'Conversational narration, like talking with the audience; bridges that build anticipation.',
  },
  {
    id: 'instructional', label: 'Hướng dẫn', summary: 'Chia nhỏ khái niệm, từng bước. Hợp đào tạo, bài giảng',
    skeleton: ['Decompose the subject and sequence it simple to complex, prerequisite to dependent.', 'One coherent teaching step per page; sibling concepts get parallel structure.', 'Ground abstraction with a concrete example or analogy.', 'Signpost: what was covered, what comes next.'],
    titleVoice: 'Titles state what the page teaches, clear over clever, e.g. "Step 2: scoring each token".',
    notesRegister: 'Patient and explanatory; define before using, analogy then principle, anticipate questions.',
  },
  {
    id: 'showcase', label: 'Trình diễn', summary: 'Hình ảnh và con số dẫn dắt, ít chữ. Hợp ra mắt sản phẩm',
    skeleton: ['A hero number, phrase or visual leads each page; supporting copy is minimal.', 'Emotional rhythm: a run of bold pages punctuated by a quiet one.', 'Hold back, then reveal the product, result or tagline.', 'Generous negative space around the primary idea.'],
    titleVoice: 'Short evocative titles: a phrase, not a sentence.',
    notesRegister: 'Energetic and evocative; short punchy sentences that narrate the feeling.',
  },
  {
    id: 'briefing', label: 'Báo cáo tóm tắt', summary: 'Trung lập, đầy đủ, dễ dò. Hợp báo cáo tiến độ, tài liệu tra cứu',
    skeleton: ['No thesis: inform completely rather than argue.', 'Complete over selective; parallel, even treatment of sibling items.', 'Section the deck for navigation with a predictable order.', 'Prefer tables, status cards and reference grids.'],
    titleVoice: 'Topic titles, e.g. "Q3 deliverables by workstream".',
    notesRegister: 'Even, factual, plain read-out; no suspense or rhetorical questions.',
  },
];

export const findStyle = (id: string | undefined) => PPT_MASTER_STYLES.find((style) => style.id === id) ?? PPT_MASTER_STYLES[0];
export const findMode = (id: string | undefined) => PPT_MASTER_MODES.find((mode) => mode.id === id) ?? PPT_MASTER_MODES[0];

export const PPT_MASTER_ATTRIBUTION = 'Phong cách và chế độ trình bày dựa trên PPT Master của Hugo He (giấy phép MIT), github.com/hugohe3/ppt-master';
