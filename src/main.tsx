import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const MirrorWindow = lazy(() => import('./editors/doc/ui/MirrorWindow'))
const mirrorChannel = new URLSearchParams(window.location.search).get('mirror')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {mirrorChannel ? <Suspense fallback={null}><MirrorWindow channel={mirrorChannel} /></Suspense> : <App />}
  </StrictMode>,
)
