import { getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

export const ANONYMOUS_AUTHOR = 'Người dùng';

export function currentAuthorName(): string {
  if (!getApps().length) return ANONYMOUS_AUTHOR;
  try {
    return getAuth(getApp()).currentUser?.displayName?.trim() || ANONYMOUS_AUTHOR;
  } catch {
    return ANONYMOUS_AUTHOR;
  }
}
