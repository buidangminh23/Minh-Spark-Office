export type AppLanguage = 'vi' | 'en';

const STORAGE_KEY = 'minh-office-language';

export function getLanguage(): AppLanguage {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'vi';
  } catch {
    return 'vi';
  }
}

export function setLanguage(language: AppLanguage) {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    return;
  }
  window.location.reload();
}

export async function startInterfaceLanguage() {
  const language = getLanguage();
  document.documentElement.lang = language;
  if (language !== 'en') return;
  const [{ default: dictionary }, { createTranslator }, { startDomTranslation }] = await Promise.all([
    import('./en.json'),
    import('./uiTranslator'),
    import('./domTranslation'),
  ]);
  startDomTranslation(createTranslator(dictionary as Record<string, string>));
}
