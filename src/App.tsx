import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage } from '@/pages/HomePage'
import { TrainPage } from '@/pages/TrainPage'
import { ProgramPage } from '@/pages/ProgramPage'
import { ProgressPage } from '@/pages/ProgressPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ActiveWorkoutPage } from '@/pages/ActiveWorkoutPage'
import { WorkoutSummaryPage } from '@/pages/WorkoutSummaryPage'
import { ActiveCardioPage } from '@/pages/ActiveCardioPage'
import { ExerciseLibraryPage } from '@/pages/ExerciseLibraryPage'
import { ExerciseDetailPage } from '@/pages/ExerciseDetailPage'
import { ensureSeeded } from '@/db/seed'

export default function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ensureSeeded()
      .then(() => setReady(true))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to initialize'))
  }, [])

  if (error) {
    return (
      <div className="flex min-h-full items-center justify-center bg-bg px-6 text-center">
        <div>
          <p className="font-display text-xl font-bold text-text">Startup error</p>
          <p className="mt-2 text-sm text-muted">{error}</p>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center bg-bg px-6">
        <p className="font-display text-2xl font-extrabold text-accent">Hypertrophy Lab</p>
        <p className="mt-2 animate-pulse-soft text-sm text-muted">Loading your lab…</p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="train" element={<TrainPage />} />
          <Route path="program" element={<ProgramPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="exercises" element={<ExerciseLibraryPage />} />
          <Route path="exercises/:exerciseId" element={<ExerciseDetailPage />} />
          <Route path="workout/:sessionId" element={<ActiveWorkoutPage />} />
          <Route path="workout/:sessionId/summary" element={<WorkoutSummaryPage />} />
          <Route path="cardio/:sessionId" element={<ActiveCardioPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
