import { createRoot } from 'react-dom/client';
import './styles.css';
import { boot } from './lib/session.js';
import App from './App.jsx';

const root = createRoot(document.getElementById('root'));
boot().then(() => root.render(<App />)).catch((e) => {
  root.render(<div style={{ padding: 24, fontFamily: 'sans-serif' }}><h2>Le planner n'a pas pu démarrer</h2><p>{String(e?.message || e)}</p></div>);
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
