import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!offline) return null

  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-card-elevated px-3 py-2 text-xs font-medium text-muted safe-top">
      <WifiOff size={14} className="text-accent" />
      Offline — your data stays on this device
    </div>
  )
}
