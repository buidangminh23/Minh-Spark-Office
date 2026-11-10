import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DismissDesktopSplash } from './components/DismissDesktopSplash'
import { countThisDeviceOnce } from './lib/usageStats'
import { reloadOnceForStaleChunk } from './lib/staleChunk'

window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnceForStaleChunk()) event.preventDefault()
})

const MirrorWindow = lazy(() => import('./editors/doc/ui/MirrorWindow'))
const mirrorChannel = new URLSearchParams(window.location.search).get('mirror')
if (!mirrorChannel) countThisDeviceOnce()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DismissDesktopSplash />
    {mirrorChannel ? <Suspense fallback={null}><MirrorWindow channel={mirrorChannel} /></Suspense> : <App />}
  </StrictMode>,
)
