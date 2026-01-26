import React from 'react'
import ReactDOM from 'react-dom/client'
// 👇 수정: 뒤에 .tsx를 지워주세요! 그냥 './app/App' 이어야 합니다.
import App from '../app/App' 
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)