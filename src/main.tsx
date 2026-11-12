import './lib/tabFrameBootstrap'
import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './components/officeChrome.css'
import App from './App.tsx'
import { DismissDesktopSplash } from './components/DismissDesktopSplash'
import { countThisDeviceOnce } from './lib/usageStats'
import { reloadOnceForStaleChunk } from './lib/staleChunk'
import { startInterfaceLanguage } from './lib/i18n/language'
import { startChromeSettings } from './lib/appChrome'
import { getSettings } from './lib/appSettings'
import { tabFrameId } from './lib/documentTabs'

window.addEventListener('vite:preloadError', (event) => {
  if (reloadOnceForStaleChunk()) event.preventDefault()
})

const MirrorWindow = lazy(() => import('./editors/doc/ui/MirrorWindow'))
const mirrorChannel = new URLSearchParams(window.location.search).get('mirror')
startChromeSettings()
if (!mirrorChannel && !tabFrameId() && getSettings().usageStats) countThisDeviceOnce()

const renderApp = () =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <DismissDesktopSplash />
      {mirrorChannel ? <Suspense fallback={null}><MirrorWindow channel={mirrorChannel} /></Suspense> : <App />}
    </StrictMode>,
  )

void startInterfaceLanguage()
  .catch((error) => console.warn('Interface language could not start:', error))
  .finally(renderApp)
