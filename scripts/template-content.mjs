import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { sampleDocHtml, meetingMinutesDocHtml, contractDocHtml, sampleWorkbook, projectEstimateWorkbook, payrollWorkbook, cashbookWorkbook } from '../src/lib/templates.ts';
import { businessPitchPresentation, productLaunchPresentation } from '../src/lib/slideTemplates.ts';
import { parseTemplateManifest } from '../src/lib/templateGallery.ts';

const generators = {
  report: () => sampleDocHtml('{{today}}'),
  minutes: () => meetingMinutesDocHtml('{{today}}'),
  contract: () => contractDocHtml('{{today}}'),
  budget: () => sampleWorkbook('Báo cáo ngân sách'),
  project: projectEstimateWorkbook,
  payroll: payrollWorkbook,
  cashbook: cashbookWorkbook,
  pitch: businessPitchPresentation,
  'product-launch': productLaunchPresentation,
};

function serializeGenerated(kind, value) {
  if (kind === 'doc') return Buffer.from(value);
  if (kind === 'sheet') {
    const sheets = Object.fromEntries(value.sheetOrder.map((oldId, index) => {
      const id = `sheet-${index + 1}`;
      return [id, { ...value.sheets[oldId], id }];
    }));
    value = { ...value, id: 'template', sheetOrder: Object.keys(sheets), sheets };
  }
  return Buffer.from(JSON.stringify(value));
}

export function buildTemplateContent(root = process.cwd()) {
  const directory = resolve(root, 'public/templates');
  const readSource = (name) => {
    const source = resolve(directory, name);
    if (!source.startsWith(directory + sep)) throw new Error(`Invalid template path: ${name}`);
    return readFileSync(source);
  };
  const files = new Map();
  const add = (bytes, format) => {
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    files.set(`/content/templates/${sha256}.${format}`, bytes);
    return { sha256, format };
  };
  const templates = JSON.parse(readSource('catalog.json').toString()).map(({ generator, file, image, ...entry }) => {
    if (generator) {
      const value = generators[generator]();
      const format = { doc: 'html', sheet: 'workbook.json', slide: 'slides.json' }[entry.kind];
      entry.asset = add(serializeGenerated(entry.kind, value), format);
    } else if (file) {
      entry.asset = add(readSource(file), file.split('.').pop().toLowerCase());
    }
    if (image) entry.image = add(readSource(image), image.split('.').pop().toLowerCase());
    return entry;
  });
  const manifest = parseTemplateManifest({ schema: 1, templates });
  files.set('/content/templates.json', Buffer.from(JSON.stringify(manifest)));
  return { manifest, files };
}

export function templateContent() {
  const virtualId = 'virtual:office-template-catalog';
  let root;
  let content;
  const current = () => content ??= buildTemplateContent(root);
  return {
    name: 'office-template-content',
    configResolved(config) { root = config.root; },
    resolveId(id) { if (id === virtualId) return '\0' + virtualId; },
    load(id) {
      if (id === '\0' + virtualId) return `export default ${JSON.stringify(current().manifest)}`;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url?.split('?')[0] || '';
        if (path !== '/content/templates.json' && !path.startsWith('/content/templates/')) return next();
        const bytes = current().files.get(path);
        if (!bytes) return next();
        res.setHeader('Content-Type', path.endsWith('.json') ? 'application/json' : 'application/octet-stream');
        res.end(bytes);
      });
    },
    handleHotUpdate(ctx) {
      if (ctx.file.startsWith(resolve(root, 'public/templates') + sep)) {
        content = undefined;
        const mod = ctx.server.moduleGraph.getModuleById('\0' + virtualId);
        if (mod) ctx.server.moduleGraph.invalidateModule(mod);
      }
    },
    generateBundle() {
      for (const [path, source] of current().files) {
        this.emitFile({ type: 'asset', fileName: path.slice(1), source });
      }
    },
  };
}
