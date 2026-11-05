import { useParams, Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft } from 'lucide-react'
import { db } from '@/db/database'
import { Card } from '@/components/ui/Card'
import { useRef } from 'react'

export function ExerciseDetailPage() {
  const { exerciseId } = useParams()
  const id = Number(exerciseId)
  const exercise = useLiveQuery(() => db.exercises.get(id), [id])
  const fileRef = useRef<HTMLInputElement>(null)

  if (!exercise) {
    return <div className="px-4 pt-8 text-muted">Loading…</div>
  }

  async function onImage(file: File) {
    await db.exercises.update(id, { imageBlob: file, updatedAt: new Date().toISOString() })
  }

  const imageUrl = exercise.imageBlob ? URL.createObjectURL(exercise.imageBlob) : null

  return (
    <div className="px-4 pt-4 animate-fade-up pb-8">
      <Link to="/exercises" className="inline-flex items-center gap-1 text-sm text-muted">
        <ChevronLeft size={18} /> Library
      </Link>
      <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight">{exercise.name}</h1>
      <p className="mt-1 text-sm capitalize text-muted">
        {exercise.primaryMuscle} · {exercise.equipment} ·{' '}
        {exercise.isCompound ? 'Compound' : 'Isolation'}
        {exercise.isUnilateral ? ' · Unilateral' : ''}
      </p>

      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="mt-4 h-48 w-full rounded-3xl object-cover border border-border"
        />
      )}

      <div className="mt-4 space-y-3">
        <Section title="Setup" body={exercise.setup} />
        <Section title="Execution" body={exercise.execution} />
        <Section title="ROM" body={exercise.romNotes} />
        <Section title="Stability" body={exercise.stabilityNotes} />
        <ListSection title="Cues" items={exercise.cues} />
        <ListSection title="Common errors" items={exercise.commonErrors} />
        <ListSection title="Alternatives" items={exercise.alternatives} />
      </div>

      {exercise.videoUrl && (
        <Card className="mt-3">
          <p className="text-xs font-semibold uppercase text-muted">Video</p>
          <a
            href={exercise.videoUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block break-all text-sm text-accent"
          >
            {exercise.videoUrl}
          </a>
        </Card>
      )}

      <div className="mt-4 space-y-2">
        <button
          type="button"
          className="w-full rounded-2xl border border-border bg-card py-3 text-sm font-semibold"
          onClick={() => fileRef.current?.click()}
        >
          {imageUrl ? 'Replace your image' : 'Add your image'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onImage(f)
          }}
        />
        <p className="text-[11px] text-muted">
          Only upload images you own or have permission to use. No copyrighted demos without
          permission.
        </p>
      </div>
    </div>
  )
}

function Section({ title, body }: { title: string; body: string }) {
  if (!body) return null
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <p className="mt-1 text-sm leading-relaxed">{body}</p>
    </Card>
  )
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Card>
  )
}
