import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { DismissDesktopSplash } from './components/DismissDesktopSplash'

const MirrorWindow = lazy(() => import('./editors/doc/ui/MirrorWindow'))
const mirrorChannel = new URLSearchParams(window.location.search).get('mirror')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DismissDesktopSplash />
    {mirrorChannel ? <Suspense fallback={null}><MirrorWindow channel={mirrorChannel} /></Suspense> : <App />}
  </StrictMode>,
)
