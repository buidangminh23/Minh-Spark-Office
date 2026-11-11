type DocxConvert = typeof import('./docxConvert');

const load = () => import('./docxConvert');

export const exportDocx = async (...args: Parameters<DocxConvert['exportDocx']>) => (await load()).exportDocx(...args);

export const importDocx = async (...args: Parameters<DocxConvert['importDocx']>) => (await load()).importDocx(...args);

export const jsonToMarkdown = async (...args: Parameters<DocxConvert['jsonToMarkdown']>) => (await load()).jsonToMarkdown(...args);
