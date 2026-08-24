import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import App from './App.jsx'
import { installChunkRecovery } from './utils/chunkRecovery.js'
import { registerServiceWorker } from './utils/registerServiceWorker.js'

installChunkRecovery()
if (import.meta.env.PROD) {
  registerServiceWorker()
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
