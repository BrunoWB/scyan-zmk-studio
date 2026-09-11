import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if (import.meta.env.DEV) {
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]')
  if (icon) icon.href = './favicon-dev.svg'
  const icon32 = document.querySelector<HTMLLinkElement>('link[sizes="32x32"]')
  if (icon32) icon32.href = './favicon-dev-32x32.png'
  const icon16 = document.querySelector<HTMLLinkElement>('link[sizes="16x16"]')
  if (icon16) icon16.href = './favicon-dev-16x16.png'
  const appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
  if (appleIcon) appleIcon.href = './apple-touch-icon-dev.png'
  const altIcon = document.querySelector<HTMLLinkElement>('link[rel="alternate icon"]')
  if (altIcon) altIcon.href = './favicon-dev.ico'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

