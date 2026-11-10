const openTarget = (hash) => {
  const target = hash && document.querySelector(hash);
  if (target instanceof HTMLDetailsElement) target.open = true;
};
document.querySelectorAll('a[href^="#"]').forEach((link) => link.addEventListener('click', () => openTarget(link.getAttribute('href'))));
openTarget(location.hash);
document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    const source = document.getElementById(button.dataset.copy);
    try {
      await navigator.clipboard.writeText(source.textContent.trim());
      button.textContent = 'Đã chép';
    } catch {
      getSelection().selectAllChildren(source);
      button.textContent = 'Nhấn ⌘C';
    }
    setTimeout(() => { button.textContent = 'Sao chép'; }, 2000);
  });
});
(() => {
  const ua = navigator.userAgent;
  const isMac = /Macintosh|Mac OS X/.test(ua) && !/iPhone|iPad/.test(ua);
  if (!isMac) return;
  const primary = document.getElementById('hero-primary');
  const secondary = document.getElementById('hero-secondary');
  primary.href = '#macos';
  primary.querySelector('use').setAttribute('href', '#i-apple');
  primary.querySelector('span').textContent = 'Tải cho macOS';
  secondary.href = '#windows';
  secondary.querySelector('use').setAttribute('href', '#i-windows');
  secondary.querySelector('span').textContent = 'Tải cho Windows';
})();
(() => {
  const format = new Intl.NumberFormat('vi-VN');
  const refresh = async () => {
    try {
      const response = await fetch('/api/stats', { cache: 'no-store' });
      if (!response.ok) return;
      const stats = await response.json();
      document.querySelectorAll('[data-stat]').forEach((node) => {
        const value = stats[node.dataset.stat];
        if (Number.isFinite(value)) node.textContent = format.format(value);
      });
    } catch {}
  };
  refresh();
  setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 15000);
})();
