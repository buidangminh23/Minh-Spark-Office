export type HeaderFooterContext = { page: number; pages: number; sheet: string; file: string; now: Date };

const two = (value: number) => String(value).padStart(2, '0');

export function expandHeaderFooter(template: string, ctx: HeaderFooterContext): string {
  return template
    .replace(/&\[Page\]/gi, String(ctx.page))
    .replace(/&\[Pages\]/gi, String(ctx.pages))
    .replace(/&\[Sheet\]/gi, ctx.sheet)
    .replace(/&\[File\]/gi, ctx.file)
    .replace(/&\[Date\]/gi, `${two(ctx.now.getDate())}/${two(ctx.now.getMonth() + 1)}/${ctx.now.getFullYear()}`)
    .replace(/&\[Time\]/gi, `${two(ctx.now.getHours())}:${two(ctx.now.getMinutes())}`);
}
