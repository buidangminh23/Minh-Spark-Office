const hostedOrigin = 'https://office.minhspark.com';

export function isDesktopSignInRequest() {
  return new URLSearchParams(window.location.hash.slice(1)).get('desktopLogin') === '1';
}

export function desktopSignInTarget(location: Pick<Location, 'origin' | 'hash'>) {
  if (location.origin !== hostedOrigin) throw new Error('auth/desktop-invalid-request');
  const params = new URLSearchParams(location.hash.slice(1));
  const port = params.get('port') || '';
  const state = params.get('state') || '';
  if (params.getAll('desktopLogin').length !== 1 || params.get('desktopLogin') !== '1'
    || params.getAll('port').length !== 1 || params.getAll('state').length !== 1
    || !/^\d{1,5}$/.test(port) || Number(port) < 1024 || Number(port) > 65535
    || !/^[a-f0-9]{64}$/.test(state)) throw new Error('auth/desktop-invalid-request');
  return { action: `http://127.0.0.1:${Number(port)}/callback`, state };
}
