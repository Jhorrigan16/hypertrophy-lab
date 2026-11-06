import { Button } from './Button'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 safe-bottom sm:items-center">
      <div className="w-full max-w-md animate-fade-up rounded-3xl bg-card border border-border p-5 shadow-2xl">
        <h2 className="font-display text-xl font-bold text-text">{title}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{message}</p>
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" fullWidth onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} fullWidth onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
