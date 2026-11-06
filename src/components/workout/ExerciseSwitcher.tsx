import { useMemo, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/database'
import type { Exercise } from '@/db/types'

interface Props {
  currentExerciseId: number
  preferredAlternatives?: string[]
  disabled?: boolean
  onSwitch: (exerciseId: number) => void
}

export function ExerciseSwitcher({
  currentExerciseId,
  preferredAlternatives = [],
  disabled,
  onSwitch,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray())

  const current = exercises?.find((e) => e.id === currentExerciseId)

  const ranked = useMemo(() => {
    if (!exercises) return []
    const q = query.trim().toLowerCase()
    const altNames = new Set(preferredAlternatives.map((n) => n.toLowerCase()))

    const filtered = exercises.filter((e) => {
      if (!q) return true
      return (
        e.name.toLowerCase().includes(q) ||
        e.primaryMuscle.includes(q) ||
        e.equipment.includes(q)
      )
    })

    const score = (e: Exercise) => {
      if (e.id === currentExerciseId) return 0
      if (altNames.has(e.name.toLowerCase())) return 1
      if (current && e.primaryMuscle === current.primaryMuscle) return 2
      return 3
    }

    return [...filtered].sort((a, b) => {
      const sa = score(a)
      const sb = score(b)
      if (sa !== sb) return sa - sb
      return a.name.localeCompare(b.name)
    })
  }, [exercises, query, preferredAlternatives, currentExerciseId, current])

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        className="mt-1 flex w-full items-center justify-between gap-2 rounded-2xl border border-border bg-bg px-3 py-2.5 text-left active:scale-[0.99] disabled:opacity-50"
      >
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            Switch exercise
          </p>
          <p className="truncate text-sm font-semibold text-text">
            {current?.name ?? 'Choose exercise'}
          </p>
        </div>
        <ChevronDown size={18} className="shrink-0 text-muted" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 safe-bottom"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-t-3xl border border-border bg-card animate-fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border px-4 pb-3 pt-4">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
              <p className="font-display text-lg font-bold">Switch exercise</p>
              <p className="text-xs text-muted">
                This workout only — completed sets stay as logged
              </p>
              <div className="relative mt-3">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search library"
                  className="w-full rounded-2xl border border-border bg-bg py-3 pl-9 pr-3 text-sm outline-none focus:border-accent"
                />
              </div>
            </div>
            <div className="overflow-y-auto px-2 py-2">
              {ranked.map((ex) => {
                const selected = ex.id === currentExerciseId
                const isAlt = preferredAlternatives.some(
                  (n) => n.toLowerCase() === ex.name.toLowerCase(),
                )
                return (
                  <button
                    key={ex.id}
                    type="button"
                    className={[
                      'mb-1 flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left',
                      selected ? 'bg-accent/15' : 'active:bg-card-elevated',
                    ].join(' ')}
                    onClick={() => {
                      if (ex.id != null && ex.id !== currentExerciseId) {
                        onSwitch(ex.id)
                      }
                      setOpen(false)
                      setQuery('')
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={[
                          'font-semibold leading-tight',
                          selected ? 'text-accent' : 'text-text',
                        ].join(' ')}
                      >
                        {ex.name}
                      </p>
                      <p className="mt-0.5 text-xs capitalize text-muted">
                        {ex.primaryMuscle} · {ex.equipment}
                        {isAlt ? ' · Alternative' : ''}
                        {ex.isCustom ? ' · Custom' : ''}
                      </p>
                    </div>
                    {selected && (
                      <span className="text-xs font-semibold text-accent">Current</span>
                    )}
                  </button>
                )
              })}
              {ranked.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted">No matches</p>
              )}
            </div>
            <div className="border-t border-border p-3">
              <button
                type="button"
                className="w-full rounded-2xl border border-border py-3 text-sm font-semibold text-muted"
                onClick={() => {
                  setOpen(false)
                  setQuery('')
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
