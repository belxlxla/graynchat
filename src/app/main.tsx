import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '../app/App.tsx';
import './index.css';

// DOM 요소를 찾습니다.
const rootElement = document.getElementById('root');

if (!rootElement) {
  // 만약 root를 못 찾으면 body에 에러를 띄웁니다 (디버깅용)
  document.body.innerHTML = '<div style="color:white; padding:20px;">Failed to find the root element. Please check index.html</div>';
} else {
  // 안전하게 렌더링 시도
  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  } catch (error) {
    console.error("App Render Failed:", error);
    rootElement.innerHTML = '<div style="color:white; padding:20px;">App crashed. Check console for details.</div>';
  }
}