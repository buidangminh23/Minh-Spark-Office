import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

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
  plugins: [react(), marketApiInDev()],
})
