import { createContext } from 'react';

export type SettingsActions = { onExportBackup: () => void; onImportBackup: (file: File) => void; onClose: () => void };
export const SettingsActionsContext = createContext<SettingsActions | null>(null);

export const AUTO_UPDATE_KEY = 'office-auto-check';
export const UPDATE_EVENTS = { check: 'office-update-check', auto: 'office-update-auto' } as const;
export const HELP_URL = '/gioi-thieu.html';

export const OPEN_SETTINGS_EVENT = 'office-open-settings';
type BackupActions = { exportBackup: () => void; importBackup: (file: File) => void };
let backupActions: BackupActions | null = null;

export function registerBackupActions(actions: BackupActions) {
  backupActions = actions;
}

export const getBackupActions = () => backupActions;

export function openSettings(category = 'general') {
  window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT, { detail: category }));
}
