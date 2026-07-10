import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootElement = document.getElementById('root')!;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// react-snap pre-renders static HTML at build time; when that HTML is present
// we hydrate it (better SEO + faster first paint). Otherwise we render normally.
if (rootElement.hasChildNodes()) {
  hydrateRoot(rootElement, app);
} else {
  createRoot(rootElement).render(app);
}
