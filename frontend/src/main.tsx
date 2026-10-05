import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import { applyPalette, readPalette } from './core/theme/palette';
import './global.css';
import './shared/theme.css';

// 저장해 둔 색상 팔레트를 그리기 전에 달아 둔다 (첫 화면이 다른 색으로 깜빡이지 않게)
applyPalette(readPalette());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);