import { getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getSettings } from './appSettings';

export const ANONYMOUS_AUTHOR = 'Người dùng';

function accountName(): string {
  if (!getApps().length) return '';
  try {
    return getAuth(getApp()).currentUser?.displayName?.trim() ?? '';
  } catch {
    return '';
  }
}

export function currentAuthorName(): string {
  const { userName, alwaysUseName } = getSettings();
  const preferred = userName.trim();
  if (preferred && alwaysUseName) return preferred;
  return accountName() || preferred || ANONYMOUS_AUTHOR;
}

export function currentAuthorInitials(): string {
  const { initials } = getSettings();
  if (initials.trim()) return initials.trim().toLocaleUpperCase('vi');
  return currentAuthorName().split(/\s+/).filter(Boolean).map((word) => word[0]).slice(-2).join('').toLocaleUpperCase('vi');
}
