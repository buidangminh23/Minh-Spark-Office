import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { getBackupActions, OPEN_SETTINGS_EVENT } from './settingsShared';

const SettingsDialog = lazy(() => import('./SettingsDialog').then((module) => ({ default: module.SettingsDialog })));

export function SettingsHost() {
  const [category, setCategory] = useState<string | null>(null);
  useEffect(() => {
    const open = (event: Event) => setCategory(String((event as CustomEvent<string>).detail || 'general'));
    window.addEventListener(OPEN_SETTINGS_EVENT, open);
    return () => window.removeEventListener(OPEN_SETTINGS_EVENT, open);
  }, []);
  const close = useCallback(() => setCategory(null), []);
  const exportBackup = useCallback(() => getBackupActions()?.exportBackup(), []);
  const importBackup = useCallback((file: File) => getBackupActions()?.importBackup(file), []);
  if (!category) return null;
  return <Suspense fallback={null}><SettingsDialog initialCategory={category} onClose={close} onExportBackup={exportBackup} onImportBackup={importBackup} /></Suspense>;
}
