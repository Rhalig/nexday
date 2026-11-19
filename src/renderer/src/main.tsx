import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/shell.css'
import './styles/motion.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initPersistence } from './lib/persist'
import { useAuth } from './store/auth'
import { supabase } from './lib/supabase'

// A packaged app without its backend settings must not offer the local mock login.
if (import.meta.env.PROD && !supabase) {
  createRoot(document.getElementById('root')!).render(
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', color: '#1A1A1A' }}>
      <div style={{ maxWidth: 420, textAlign: 'center', lineHeight: 1.5 }}>
        <h2 style={{ fontWeight: 500 }}>Nexday can’t start</h2>
        <p style={{ color: '#6B6B6B' }}>This build is missing its server settings. Install the latest version from the Nexday website.</p>
      </div>
    </div>
  )
} else void Promise.all([initPersistence(), useAuth.getState().init()]).finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
})
