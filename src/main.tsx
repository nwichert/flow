import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/ConfirmDialog'
import { ThemeProvider } from './components/ThemeProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ConfirmProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </ConfirmProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
