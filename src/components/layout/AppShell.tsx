import { Outlet, useLocation } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { OfflineBanner } from '../system/OfflineBanner'
import { UpdatePrompt } from '../system/UpdatePrompt'

export function AppShell() {
  const location = useLocation()
  const isSummary = /\/workout\/[^/]+\/summary$/.test(location.pathname)
  const hideNav =
    (location.pathname.startsWith('/workout/') && !isSummary) ||
    location.pathname.startsWith('/cardio/')

  return (
    <div className="relative mx-auto min-h-full max-w-lg bg-bg">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(255,116,51,0.18), transparent 70%)',
        }}
      />
      <OfflineBanner />
      <UpdatePrompt />
      <main className={hideNav ? 'safe-top' : 'safe-top pb-nav'}>
        <Outlet />
      </main>
      {!hideNav && <BottomNav />}
    </div>
  )
}
