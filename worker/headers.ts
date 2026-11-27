export type HeaderRule = { source: string; headers: { key: string; value: string }[] };

const compiled = new Map<string, RegExp>();

function pattern(source: string) {
  let regex = compiled.get(source);
  if (!regex) {
    regex = new RegExp(`^${source}$`);
    compiled.set(source, regex);
  }
  return regex;
}

export function headerRulesFor(rules: HeaderRule[], pathname: string) {
  return rules.filter((rule) => pattern(rule.source).test(pathname));
}
