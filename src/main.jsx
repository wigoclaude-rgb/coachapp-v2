import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles.css'

/*
  Registra o service worker no carregamento. Ele é o que recebe o push com o app
  fechado — sem isso, nenhum lembrete chega. Não pede permissão aqui: isso
  acontece quando o aluno liga um lembrete (ver src/lib/push.js).
*/
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch(err => console.warn('Service worker não registrado:', err))
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
