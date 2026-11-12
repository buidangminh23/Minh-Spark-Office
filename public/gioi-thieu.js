(() => {
  const STATS_URL = '/api/stats';
  const REFRESH_MS = 15000;
  const format = new Intl.NumberFormat('vi-VN');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shown = {};
  const live = document.getElementById('stats-live');
  const status = document.getElementById('stats-status');

  const animate = (key, target) => {
    const from = shown[key] ?? 0;
    shown[key] = target;
    const nodes = document.querySelectorAll(`[data-stat="${key}"]`);
    if (reduceMotion || from === target) {
      nodes.forEach((node) => { node.textContent = format.format(target); });
      return;
    }
    const start = performance.now();
    const duration = 700;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const value = Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3)));
      nodes.forEach((node) => { node.textContent = format.format(value); });
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const refresh = async () => {
    try {
      const response = await fetch(STATS_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(String(response.status));
      const stats = await response.json();
      for (const key of ['users', 'downloadsWindows', 'downloadsMac', 'downloadsLinux']) {
        if (Number.isFinite(stats[key])) animate(key, stats[key]);
      }
      live.dataset.state = 'on';
      status.textContent = `Cập nhật trực tiếp · ${new Date().toLocaleTimeString('vi-VN')}`;
    } catch {
      live.dataset.state = 'off';
      status.textContent = 'Chưa lấy được số liệu, đang thử lại';
    }
  };

  refresh();
  let timer = setInterval(refresh, REFRESH_MS);
  document.addEventListener('visibilitychange', () => {
    clearInterval(timer);
    if (document.visibilityState === 'visible') {
      refresh();
      timer = setInterval(refresh, REFRESH_MS);
    }
  });

  const tabs = [...document.querySelectorAll('.lp-tab')];
  const select = (tab) => {
    tabs.forEach((other) => {
      const active = other === tab;
      other.setAttribute('aria-selected', String(active));
      other.tabIndex = active ? 0 : -1;
      document.getElementById(other.getAttribute('aria-controls')).hidden = !active;
    });
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (event) => {
      const move = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!move) return;
      const next = tabs[(index + move + tabs.length) % tabs.length];
      next.focus();
      select(next);
    });
  });

  const platform = /Mac/.test(navigator.platform) && !/iPhone|iPad/.test(navigator.userAgent)
    ? 'macos'
    : /Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent) ? 'linux' : 'windows';
  for (const name of ['windows', 'macos', 'linux']) {
    const button = document.getElementById(`hero-${name}`);
    button.classList.toggle('lp-btn-primary', name === platform);
    button.classList.toggle('lp-btn-ghost', name !== platform);
  }
})();
