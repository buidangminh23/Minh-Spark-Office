import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'rolldown/parseAst';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIETNAMESE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸ]/;
const DATA_FILES = /reviewThesaurus|vnProvinces|vietnamUtils|lib[\\/]templates\.ts|slideTemplates|docTemplates|[\\/]i18n[\\/]/;
const MAX_LENGTH = 1200;

const decode = (text) =>
  text.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
const normalize = (text) => decode(text).replace(/\s+/g, ' ').trim();

const files = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts') && !DATA_FILES.test(full)) files.push(full);
  }
};
walk(path.join(root, 'src'));

const dictionary = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/i18n/en.json'), 'utf8'));
const missing = new Map();
const add = (raw, file) => {
  const text = normalize(raw);
  if (!text || text.length > MAX_LENGTH || !VIETNAMESE.test(text) || text in dictionary) return;
  if (!missing.has(text)) missing.set(text, path.relative(root, file).replace(/\\/g, '/'));
};

for (const file of files) {
  const ast = parseAst(fs.readFileSync(file, 'utf8'), { lang: file.endsWith('x') ? 'tsx' : 'ts' }, file);
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node.type === 'Literal' && typeof node.value === 'string') add(node.value, file);
    else if (node.type === 'JSXText') add(node.value, file);
    else if (node.type === 'TemplateLiteral') {
      add(node.quasis.map((quasi, index) => (quasi.value.cooked ?? '') + (index < node.expressions.length ? `{${index}}` : '')).join(''), file);
    }
    for (const key of Object.keys(node)) if (key !== 'parent') visit(node[key]);
  };
  visit(ast);
}

for (const [text, file] of missing) console.log(`${file}\t${text}`);
console.error(`${missing.size} Vietnamese strings have no entry in src/lib/i18n/en.json (data strings that must stay Vietnamese also show here).`);
