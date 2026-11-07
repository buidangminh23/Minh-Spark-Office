import { useEffect } from 'react';

const SPLASH_EXIT_MS = 260;

export function DismissDesktopSplash() {
  useEffect(() => {
    const root = document.documentElement;
    const splash = document.querySelector('.desktop-splash');
    if (!root.classList.contains('ms-desktop')) { splash?.remove(); return; }
    if (root.classList.contains('ms-ready')) return;
    root.classList.add('ms-ready');
    window.setTimeout(() => splash?.remove(), SPLASH_EXIT_MS);
  }, []);
  return null;
}
