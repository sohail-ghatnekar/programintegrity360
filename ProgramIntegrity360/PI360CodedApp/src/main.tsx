import { createRoot } from 'react-dom/client'
import '@uipath/apollo-wind/tailwind.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <App />
)
