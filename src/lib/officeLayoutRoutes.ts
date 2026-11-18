const documents = /\.(docx|dotx)$/i;
const spreadsheets = /\.(xlsx|xlsm|xlsb|xls|ods)$/i;
const presentations = /\.(pptx|ppsx|potx)$/i;

export function supportsOfficeLayout(name: string, target: string) {
  const document = documents.test(name);
  const spreadsheet = spreadsheets.test(name);
  const presentation = presentations.test(name);
  if (!document && !spreadsheet && !presentation) return false;
  if (['pdf', 'png', 'jpg', 'webp'].includes(target)) return true;
  if (target === 'docx') return spreadsheet || presentation;
  if (target === 'pptx') return document || spreadsheet;
  return false;
}
