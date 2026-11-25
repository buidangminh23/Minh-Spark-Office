import react from '@vitejs/plugin-react'
import './scripts/patch-sheet-line-gap.mjs'
import { createReadStream, readFileSync } from 'node:fs'
import { defaultClientConditions, defineConfig, type Plugin } from 'vite'

const appVersion = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version

function officeLayoutEngine(): Plugin {
  const prefix = '/layout-engine/2.3.1/';
  const assets = ['browser.worker.global.js', 'soffice.js', 'soffice.worker.js', 'soffice.wasm.gz', 'soffice.data.gz'];
  const source = (name: string) => new URL(`./node_modules/@bentopdf/libreoffice-wasm/assets/${name}`, import.meta.url);
  const workerName = 'browser.worker.global.js';
  const original = readFileSync(source(workerName), 'utf8');
  const mapStart = 'var U={pdf:"pdf",';
  if (original.split(mapStart).length !== 2) throw new Error('Unexpected LibreOffice 2.3.1 worker format map');
  const singleCore = 'Object.defineProperty(self.navigator,"hardwareConcurrency",{value:1,configurable:true});';
  const worker = singleCore + original.replace(mapStart, mapStart + 'fodt:"fodt",fods:"fods",fodp:"fodp",pot:"pot",');
  const engineName = 'soffice.js';
  const poolStart = 'var pthreadPoolSize=4;';
  const engineSource = readFileSync(source(engineName), 'utf8');
  if (engineSource.split(poolStart).length !== 2) throw new Error('Unexpected LibreOffice 2.3.1 thread pool size');
  const engine = engineSource.replace(poolStart, 'var pthreadPoolSize=16;');
  const middleware = (serveFromPackage: boolean): import('vite').Connect.NextHandleFunction => (req, res, next) => {
    const path = req.url?.split('?')[0] ?? '';
    if (path === '/office-layout.html' || path.startsWith(prefix)) {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    }
    const name = path.slice(prefix.length);
    if (!path.startsWith(prefix) || !assets.includes(name)) return next();
    if (name.endsWith('.js')) res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self' 'unsafe-eval'; worker-src 'self'; connect-src 'self' blob:");
    if (!serveFromPackage) return next();
    res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
    if (name === workerName) { res.end(worker); return; }
    if (name === engineName) { res.end(engine); return; }
    createReadStream(source(name)).on('error', next).pipe(res);
  };
  return {
    name: 'office-layout-engine',
    configureServer(server) { server.middlewares.use(middleware(true)); },
    configurePreviewServer(server) { server.middlewares.use(middleware(false)); },
    generateBundle() {
      for (const name of assets) this.emitFile({ type: 'asset', fileName: prefix.slice(1) + name, source: name === workerName ? worker : name === engineName ? engine : readFileSync(source(name)) });
    },
  };
}

const appBuild = `${appVersion}-${Date.now().toString(36)}`

function webBuildInfo(): Plugin {
  return {
    name: 'web-build-info',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: `${JSON.stringify({ build: appBuild, version: appVersion })}
` })
    },
  }
}

function marketApiInDev(): Plugin {
  return {
    name: 'market-api-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/market', async (req, res) => {
        try {
          const market = await server.ssrLoadModule('/api/_shared/market.ts')
          const url = new URL(req.url ?? '/', 'http://localhost')
          const snapshot = await market.collectMarket(fetch, market.normalizeSymbols(url.searchParams.get('stocks')))
          res.statusCode = snapshot.quotes.length ? 200 : 502
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(snapshot))
        } catch (error) {
          res.statusCode = 500
          res.end(JSON.stringify({ updatedAt: new Date().toISOString(), quotes: [], errors: [{ source: 'dev', message: String(error) }] }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), marketApiInDev(), officeLayoutEngine(), webBuildInfo()],
  build: { rollupOptions: { input: { index: 'index.html', layout: 'office-layout.html' } } },
  define: { __APP_VERSION__: JSON.stringify(appVersion), __APP_BUILD__: JSON.stringify(appBuild) },
  resolve: { conditions: ['onnxruntime-web-use-extern-wasm', ...defaultClientConditions] },
})
