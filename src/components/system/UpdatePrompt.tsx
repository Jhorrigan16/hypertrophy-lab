import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '../ui/Button'

export function UpdatePrompt() {
  const [show, setShow] = useState(false)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError() {
      /* ignore unsupported environments */
    },
  })

  useEffect(() => {
    if (needRefresh) setShow(true)
  }, [needRefresh])

  if (!show) return null

  return (
    <div className="fixed inset-x-0 top-0 z-[60] p-3 safe-top">
      <div className="mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-xl">
        <p className="flex-1 text-sm text-text">Update available</p>
        <Button
          variant="secondary"
          className="!py-2 !px-3 text-sm"
          onClick={() => {
            setShow(false)
            setNeedRefresh(false)
          }}
        >
          Later
        </Button>
        <Button className="!py-2 !px-3 text-sm" onClick={() => void updateServiceWorker(true)}>
          Refresh
        </Button>
      </div>
    </div>
  )
}
