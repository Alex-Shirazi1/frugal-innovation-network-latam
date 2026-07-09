import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './styles/global.css'
import App from './App.tsx'

// Moderation UI stays out of the public bundle — only loads on /admin.
const AdminPage = lazy(() =>
  import('./components/admin/AdminPage.tsx').then((m) => ({ default: m.AdminPage })),
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        {/* Unlinked moderation page — access is enforced server-side by the admin key. */}
        <Route
          path="/admin"
          element={
            <Suspense fallback={null}>
              <AdminPage />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
