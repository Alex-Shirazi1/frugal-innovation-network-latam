import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.tsx'
import { AnalyticsProvider } from './lib/analytics.tsx'

// Moderation UI stays out of the public bundle — only loads on /admin.
const AdminPage = lazy(() =>
  import('./components/admin/AdminPage.tsx').then((m) => ({ default: m.AdminPage })),
)

/**
 * The site is a single scrolling page plus one unlinked moderation route, and
 * nothing ever navigates between the two — /admin is opened directly and its
 * only way back is a plain link that reloads. A router library bought nothing
 * here, so this is a static path check instead.
 *
 * It also fixes the previous behaviour: `<Route path="/">` matched only the
 * exact root, so any other path (Hosting rewrites everything to index.html)
 * rendered a blank page. Anything that is not /admin now renders the site.
 */
function isAdminRoute(): boolean {
  return window.location.pathname.replace(/\/+$/, '') === '/admin'
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AnalyticsProvider>
      {isAdminRoute() ? (
        <Suspense fallback={null}>
          <AdminPage />
        </Suspense>
      ) : (
        <App />
      )}
    </AnalyticsProvider>
  </StrictMode>,
)
