import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createWKBridge } from '@/bridge/wk';
import './styles/tailwind.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App bridge={createWKBridge()} />
  </StrictMode>
);
