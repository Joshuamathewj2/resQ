/**
 * @file src/main.tsx
 * @description Application entry point for ResQ.
 *
 * Mounts the React application into the DOM, wraps it in the global
 * ErrorBoundary, and enables React StrictMode for development warnings.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    '[ResQ] Fatal: <div id="root"> not found in index.html. Cannot mount application.'
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
