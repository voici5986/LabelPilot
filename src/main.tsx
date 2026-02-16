import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { I18nProvider } from './utils/i18n'
import { ErrorBoundary } from './components/ErrorBoundary'

// PWA: registerSW will be handled by VitePWA through virtual modules in ReloadPrompt
// No additional code needed here if using 'prompt' registerType with ReloadPrompt

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ErrorBoundary>
  </StrictMode>,
)
