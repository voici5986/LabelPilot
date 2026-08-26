import { MotionConfig } from "framer-motion";
import { StrictMode } from "react";

import "./index.css";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { I18nProvider } from "./utils/i18n";

// PWA: registerSW will be handled by VitePWA through virtual modules in ReloadPrompt
// No additional code needed here if using 'prompt' registerType with ReloadPrompt

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <I18nProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </I18nProvider>
    </MotionConfig>
  </StrictMode>,
);
