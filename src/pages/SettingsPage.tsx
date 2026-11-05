import { useRef, useState } from 'react'
import { format } from 'date-fns'
import { useSettings, updateSettings } from '@/hooks/useSettings'
import {
  DEFAULT_EQUIPMENT_INCREMENTS,
  DEFAULT_PROGRESSION_PREFS,
  DEFAULT_REST_DEFAULTS,
  type DayOfWeek,
  type WeightUnit,
} from '@/db/types'
import { downloadJson, exportBackup, importBackup, validateBackup } from '@/lib/backup'
import { deleteAllData, resetProgramKeepHistory } from '@/db/seed'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { db } from '@/db/database'
import { useLiveQuery } from 'dexie-react-hooks'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function SettingsPage() {
  const settings = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray())

  if (!settings) {
    return <div className="px-4 pt-8 text-muted">Loading settings…</div>
  }

  async function setUnit(unit: WeightUnit) {
    // Don't convert stored values — display layer handles conversion
    await updateSettings({ weightUnit: unit })
    setMessage(`Display unit set to ${unit}. Stored weights unchanged.`)
  }

  async function handleExport() {
    const data = await exportBackup()
    downloadJson(`hypertrophy-lab-backup-${format(new Date(), 'yyyy-MM-dd')}.json`, data)
    setMessage('Backup downloaded.')
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text()
      const json = JSON.parse(text) as unknown
      const pre = validateBackup(json)
      if (!pre.ok) {
        setMessage(`Import failed: ${pre.errors.join(' ')}`)
        return
      }
      const result = await importBackup(json)
      setMessage(
        result.ok
          ? `Import successful.${result.warnings.length ? ' ' + result.warnings.join(' ') : ''}`
          : `Import failed: ${result.errors.join(' ')}`,
      )
    } catch {
      setMessage('Import failed: invalid JSON.')
    }
  }

  return (
    <div className="px-4 pt-4 pb-6 animate-fade-up">
      <header className="mb-4">
        <h1 className="font-display text-3xl font-extrabold">Settings</h1>
        <p className="mt-1 text-sm text-muted">Local-only · no account</p>
      </header>

      {message && (
        <div className="mb-3 rounded-2xl border border-border bg-card px-3 py-2 text-sm">
          {message}
        </div>
      )}

      <Card className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Appearance</p>
        <p className="mt-2 text-sm">Dark theme (default)</p>
        <p className="text-xs text-muted">Premium dark UI optimized for training.</p>
      </Card>

      <Card className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Weight unit</p>
        <div className="mt-3 flex gap-2">
          {(['lb', 'kg'] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => void setUnit(u)}
              className={[
                'flex-1 rounded-2xl border py-3 font-semibold',
                settings.weightUnit === u
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border text-muted',
              ].join(' ')}
            >
              {u}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Changing units only affects display. Stored values stay in lb so history isn’t corrupted.
        </p>
      </Card>

      <Card className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Program start</p>
        <input
          type="date"
          className="mt-3 w-full rounded-2xl border border-border bg-bg px-3 py-3"
          value={settings.programStartDate}
          onChange={(e) => void updateSettings({ programStartDate: e.target.value })}
        />
      </Card>

      <Card className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Preferred training days
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DAY_LABELS.map((label, i) => {
            const day = i as DayOfWeek
            const on = settings.preferredTrainingDays.includes(day)
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  const next = on
                    ? settings.preferredTrainingDays.filter((d) => d !== day)
                    : [...settings.preferredTrainingDays, day]
                  void updateSettings({ preferredTrainingDays: next.sort() as DayOfWeek[] })
                }}
                className={[
                  'rounded-xl px-3 py-2 text-sm font-semibold',
                  on ? 'bg-accent text-white' : 'bg-bg border border-border text-muted',
                ].join(' ')}
              >
                {label}
              </button>
            )
          })}
        </div>
      </Card>

      <Card className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Rest defaults (sec)</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(
            [
              ['compoundMin', 'Compound min'],
              ['compoundMax', 'Compound max'],
              ['isolationMin', 'Isolation min'],
              ['isolationMax', 'Isolation max'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-xs text-muted">
              {label}
              <input
                type="number"
                className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm font-semibold text-text"
                value={settings.restDefaults[key]}
                onChange={(e) =>
                  void updateSettings({
                    restDefaults: {
                      ...settings.restDefaults,
                      [key]: Number(e.target.value) || DEFAULT_REST_DEFAULTS[key],
                    },
                  })
                }
              />
            </label>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Toggle
            label="Sound"
            on={settings.restTimerSound}
            onChange={(v) => void updateSettings({ restTimerSound: v })}
          />
          <Toggle
            label="Vibrate"
            on={settings.restTimerVibration}
            onChange={(v) => void updateSettings({ restTimerVibration: v })}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          iOS PWAs have limited background notification support.
        </p>
      </Card>

      <Card className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Equipment increments ({settings.weightUnit})
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(Object.keys(DEFAULT_EQUIPMENT_INCREMENTS) as Array<keyof typeof DEFAULT_EQUIPMENT_INCREMENTS>).map(
            (key) => (
              <label key={key} className="text-xs capitalize text-muted">
                {key}
                <input
                  type="number"
                  step="0.5"
                  className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm font-semibold text-text"
                  value={settings.equipmentIncrements[key]}
                  onChange={(e) =>
                    void updateSettings({
                      equipmentIncrements: {
                        ...settings.equipmentIncrements,
                        [key]: Number(e.target.value) || DEFAULT_EQUIPMENT_INCREMENTS[key],
                      },
                    })
                  }
                />
              </label>
            ),
          )}
        </div>
      </Card>

      <Card className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Progression</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">
            Upper body %
            <input
              type="number"
              step="0.5"
              className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm font-semibold text-text"
              value={settings.progressionPrefs.upperBodyIncreasePercent}
              onChange={(e) =>
                void updateSettings({
                  progressionPrefs: {
                    ...settings.progressionPrefs,
                    upperBodyIncreasePercent:
                      Number(e.target.value) ||
                      DEFAULT_PROGRESSION_PREFS.upperBodyIncreasePercent,
                  },
                })
              }
            />
          </label>
          <label className="text-xs text-muted">
            Lower body %
            <input
              type="number"
              step="0.5"
              className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm font-semibold text-text"
              value={settings.progressionPrefs.lowerBodyIncreasePercent}
              onChange={(e) =>
                void updateSettings({
                  progressionPrefs: {
                    ...settings.progressionPrefs,
                    lowerBodyIncreasePercent:
                      Number(e.target.value) ||
                      DEFAULT_PROGRESSION_PREFS.lowerBodyIncreasePercent,
                  },
                })
              }
            />
          </label>
        </div>
        <div className="mt-3 space-y-2">
          <Toggle
            label="Require all sets at top of range"
            on={settings.progressionPrefs.requireAllSetsInRange}
            onChange={(v) =>
              void updateSettings({
                progressionPrefs: { ...settings.progressionPrefs, requireAllSetsInRange: v },
              })
            }
          />
          <Toggle
            label="Require target RIR"
            on={settings.progressionPrefs.requireTargetRir}
            onChange={(v) =>
              void updateSettings({
                progressionPrefs: { ...settings.progressionPrefs, requireTargetRir: v },
              })
            }
          />
        </div>
      </Card>

      <Card className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Substitutions</p>
        <p className="mt-1 text-xs text-muted">
          Map a programmed exercise to an alternative for new sessions.
        </p>
        <div className="mt-3 space-y-2">
          {Object.entries(settings.substitutions).map(([from, to]) => {
            const fromName = exercises?.find((e) => e.id === Number(from))?.name ?? from
            const toName = exercises?.find((e) => e.id === to)?.name ?? String(to)
            return (
              <div key={from} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {fromName} → {toName}
                </span>
                <button
                  type="button"
                  className="text-danger text-xs font-semibold"
                  onClick={() => {
                    const next = { ...settings.substitutions }
                    delete next[Number(from)]
                    void updateSettings({ substitutions: next })
                  }}
                >
                  Remove
                </button>
              </div>
            )
          })}
          <SubstitutionEditor
            exercises={exercises ?? []}
            onAdd={(from, to) =>
              void updateSettings({
                substitutions: { ...settings.substitutions, [from]: to },
              })
            }
          />
        </div>
      </Card>

      <Card className="mb-3 border-accent/30">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Data & backup</p>
        <p className="mt-2 text-sm text-muted">
          All data lives in this browser via IndexedDB. Clearing site data, removing the Home
          Screen app, or switching browsers can erase your history. Export backups regularly.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          <Button fullWidth onClick={() => void handleExport()}>
            Export JSON backup
          </Button>
          <Button variant="secondary" fullWidth onClick={() => fileRef.current?.click()}>
            Import JSON backup
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleImport(file)
              e.target.value = ''
            }}
          />
        </div>
      </Card>

      <div className="space-y-2">
        <Button variant="secondary" fullWidth onClick={() => setConfirmReset(true)}>
          Reset program (keep history)
        </Button>
        <Button variant="danger" fullWidth onClick={() => setConfirmDelete(true)}>
          Delete all data
        </Button>
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        Hypertrophy Lab v1 · Personal use · Not affiliated with any coach brand
      </p>

      <ConfirmDialog
        open={confirmReset}
        title="Reset program?"
        message="Starts a new 10-week block. Workout history is kept."
        confirmLabel="Reset"
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          void resetProgramKeepHistory().then(() => {
            setConfirmReset(false)
            setMessage('Program reset.')
          })
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete all data?"
        message="This permanently erases workouts, PRs, settings, and program data on this device, then re-seeds defaults. Export a backup first."
        confirmLabel="Delete everything"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          void deleteAllData().then(() => {
            setConfirmDelete(false)
            setMessage('All data deleted and defaults restored.')
          })
        }}
      />
    </div>
  )
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string
  on: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex flex-1 items-center justify-between gap-2 rounded-2xl border border-border bg-bg px-3 py-3 text-left text-sm"
    >
      <span>{label}</span>
      <span
        className={[
          'h-6 w-10 rounded-full p-0.5 transition',
          on ? 'bg-accent' : 'bg-border',
        ].join(' ')}
      >
        <span
          className={[
            'block h-5 w-5 rounded-full bg-white transition',
            on ? 'translate-x-4' : 'translate-x-0',
          ].join(' ')}
        />
      </span>
    </button>
  )
}

function SubstitutionEditor({
  exercises,
  onAdd,
}: {
  exercises: Array<{ id?: number; name: string }>
  onAdd: (from: number, to: number) => void
}) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  return (
    <div className="rounded-2xl border border-border bg-bg p-3">
      <select
        className="mb-2 w-full rounded-xl border border-border bg-card px-2 py-2 text-sm"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
      >
        <option value="">From exercise…</option>
        {exercises.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <select
        className="mb-2 w-full rounded-xl border border-border bg-card px-2 py-2 text-sm"
        value={to}
        onChange={(e) => setTo(e.target.value)}
      >
        <option value="">Substitute with…</option>
        {exercises.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <Button
        variant="secondary"
        className="!py-2 text-sm"
        fullWidth
        disabled={!from || !to || from === to}
        onClick={() => {
          onAdd(Number(from), Number(to))
          setFrom('')
          setTo('')
        }}
      >
        Add substitution
      </Button>
    </div>
  )
}
