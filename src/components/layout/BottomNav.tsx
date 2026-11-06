import { NavLink } from 'react-router-dom'
import { Home, Dumbbell, LineChart, Settings } from 'lucide-react'

const tabs = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/train', label: 'Train', icon: Dumbbell },
  { to: '/progress', label: 'Progress', icon: LineChart },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-bg/95 backdrop-blur-xl safe-bottom">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-1.5 pb-1">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'flex min-h-12 min-w-[72px] flex-col items-center justify-center gap-0.5 rounded-2xl px-3 py-2 text-[11px] font-medium transition',
                isActive ? 'text-accent' : 'text-muted',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
