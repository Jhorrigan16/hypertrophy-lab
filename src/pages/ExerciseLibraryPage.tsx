import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Search } from 'lucide-react'
import { db } from '@/db/database'
import type { MuscleGroup, Equipment } from '@/db/types'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

const MUSCLES: Array<MuscleGroup | 'all'> = [
  'all',
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
]

export function ExerciseLibraryPage() {
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray())
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all')
  const [showCreate, setShowCreate] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (exercises ?? []).filter((e) => {
      if (muscle !== 'all' && e.primaryMuscle !== muscle && !e.muscleGroups.includes(muscle)) {
        return false
      }
      if (!q) return true
      return (
        e.name.toLowerCase().includes(q) ||
        e.equipment.includes(q) ||
        e.primaryMuscle.includes(q)
      )
    })
  }, [exercises, query, muscle])

  return (
    <div className="px-4 pt-4 animate-fade-up">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">Exercises</h1>
          <p className="mt-1 text-sm text-muted">{exercises?.length ?? 0} in library</p>
        </div>
        <Button className="!px-3 !py-2.5" onClick={() => setShowCreate(true)}>
          <Plus size={18} />
        </Button>
      </header>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises"
          className="w-full rounded-2xl border border-border bg-card py-3.5 pl-10 pr-4 outline-none focus:border-accent"
        />
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {MUSCLES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMuscle(m)}
            className={[
              'rounded-full px-3 py-1.5 text-sm font-semibold capitalize whitespace-nowrap',
              muscle === m ? 'bg-accent text-white' : 'bg-card border border-border text-muted',
            ].join(' ')}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((ex) => (
          <Link key={ex.id} to={`/exercises/${ex.id}`}>
            <Card className="!py-3 mb-2 active:scale-[0.99] transition">
              <p className="font-semibold">{ex.name}</p>
              <p className="text-xs text-muted capitalize">
                {ex.primaryMuscle} · {ex.equipment}
                {ex.isCustom ? ' · Custom' : ''}
                {ex.isUnilateral ? ' · Unilateral' : ''}
              </p>
            </Card>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted">No exercises match your search.</p>
        )}
      </div>

      {showCreate && (
        <CreateExerciseModal
          onClose={() => setShowCreate(false)}
          onCreated={() => setShowCreate(false)}
        />
      )}
    </div>
  )
}

function CreateExerciseModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [primaryMuscle, setPrimaryMuscle] = useState<MuscleGroup>('chest')
  const [equipment, setEquipment] = useState<Equipment>('machine')
  const [isCompound, setIsCompound] = useState(true)
  const [isUnilateral, setIsUnilateral] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')

  async function save() {
    if (!name.trim()) return
    const ts = new Date().toISOString()
    await db.exercises.add({
      name: name.trim(),
      muscleGroups: [primaryMuscle],
      primaryMuscle,
      equipment,
      movementPattern: isCompound ? 'other' : 'isolation',
      isCompound,
      isUnilateral,
      cues: [],
      commonErrors: [],
      alternatives: [],
      setup: '',
      execution: '',
      romNotes: '',
      stabilityNotes: '',
      videoUrl: videoUrl || undefined,
      isCustom: true,
      defaultRestSeconds: isCompound ? 150 : 75,
      createdAt: ts,
      updatedAt: ts,
    })
    onCreated()
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end bg-black/60 p-4 safe-bottom">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-5">
        <h2 className="font-display text-xl font-bold">Custom exercise</h2>
        <input
          className="mt-3 w-full rounded-2xl border border-border bg-bg px-3 py-3"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <select
            className="rounded-2xl border border-border bg-bg px-3 py-3"
            value={primaryMuscle}
            onChange={(e) => setPrimaryMuscle(e.target.value as MuscleGroup)}
          >
            {MUSCLES.filter((m) => m !== 'all').map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            className="rounded-2xl border border-border bg-bg px-3 py-3"
            value={equipment}
            onChange={(e) => setEquipment(e.target.value as Equipment)}
          >
            {['barbell', 'dumbbell', 'cable', 'machine', 'smith', 'bodyweight', 'other'].map(
              (eq) => (
                <option key={eq} value={eq}>
                  {eq}
                </option>
              ),
            )}
          </select>
        </div>
        <input
          className="mt-2 w-full rounded-2xl border border-border bg-bg px-3 py-3 text-sm"
          placeholder="Optional video URL (your own / licensed)"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
        <p className="mt-1 text-[11px] text-muted">
          Don’t add copyrighted demo videos without permission.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className={`flex-1 rounded-2xl border py-2 text-sm font-semibold ${isCompound ? 'border-accent text-accent' : 'border-border text-muted'}`}
            onClick={() => setIsCompound(true)}
          >
            Compound
          </button>
          <button
            type="button"
            className={`flex-1 rounded-2xl border py-2 text-sm font-semibold ${!isCompound ? 'border-accent text-accent' : 'border-border text-muted'}`}
            onClick={() => setIsCompound(false)}
          >
            Isolation
          </button>
          <button
            type="button"
            className={`flex-1 rounded-2xl border py-2 text-sm font-semibold ${isUnilateral ? 'border-accent text-accent' : 'border-border text-muted'}`}
            onClick={() => setIsUnilateral((v) => !v)}
          >
            Unilateral
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button fullWidth onClick={() => void save()}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
