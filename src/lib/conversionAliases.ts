export const conversionAliases: Readonly<Record<string, string>> = {
  htm: 'html', xht: 'xhtml', markdown: 'md', tab: 'tsv', jpeg: 'jpg', jpe: 'jpg', tif: 'tiff', sylk: 'slk',
};

export const withConversionExtension = (name: string, extension: string) => name.replace(/\.[^.]*$/, '.' + extension);
