export interface RestTimerState {
  isRunning: boolean
  isPaused: boolean
  durationSeconds: number
  remainingSeconds: number
  startedAtMs: number | null
  pausedAtMs: number | null
  accumulatedPausedMs: number
}

export function createRestTimer(durationSeconds: number): RestTimerState {
  return {
    isRunning: false,
    isPaused: false,
    durationSeconds,
    remainingSeconds: durationSeconds,
    startedAtMs: null,
    pausedAtMs: null,
    accumulatedPausedMs: 0,
  }
}

export function startRestTimer(state: RestTimerState, now = Date.now()): RestTimerState {
  return {
    ...state,
    isRunning: true,
    isPaused: false,
    startedAtMs: now,
    pausedAtMs: null,
    accumulatedPausedMs: 0,
    remainingSeconds: state.durationSeconds,
  }
}

export function pauseRestTimer(state: RestTimerState, now = Date.now()): RestTimerState {
  if (!state.isRunning || state.isPaused) return state
  return {
    ...state,
    isPaused: true,
    pausedAtMs: now,
    remainingSeconds: computeRemaining(state, now),
  }
}

export function resumeRestTimer(state: RestTimerState, now = Date.now()): RestTimerState {
  if (!state.isRunning || !state.isPaused || state.pausedAtMs == null) return state
  const pausedDuration = now - state.pausedAtMs
  return {
    ...state,
    isPaused: false,
    pausedAtMs: null,
    accumulatedPausedMs: state.accumulatedPausedMs + pausedDuration,
  }
}

export function resetRestTimer(state: RestTimerState): RestTimerState {
  return createRestTimer(state.durationSeconds)
}

/**
 * Accurate remaining time even when the tab was backgrounded —
 * uses wall-clock elapsed rather than interval ticks alone.
 */
export function computeRemaining(state: RestTimerState, now = Date.now()): number {
  if (!state.isRunning || state.startedAtMs == null) return state.remainingSeconds
  if (state.isPaused) return state.remainingSeconds

  const elapsedMs = now - state.startedAtMs - state.accumulatedPausedMs
  const remaining = state.durationSeconds - elapsedMs / 1000
  return Math.max(0, Math.ceil(remaining))
}

export function tickRestTimer(state: RestTimerState, now = Date.now()): RestTimerState {
  if (!state.isRunning || state.isPaused) return state
  const remaining = computeRemaining(state, now)
  if (remaining <= 0) {
    return {
      ...state,
      isRunning: false,
      isPaused: false,
      remainingSeconds: 0,
    }
  }
  return { ...state, remainingSeconds: remaining }
}

export function defaultRestForExercise(isCompound: boolean, defaults: {
  compoundMin: number
  compoundMax: number
  isolationMin: number
  isolationMax: number
}): number {
  if (isCompound) {
    return Math.round((defaults.compoundMin + defaults.compoundMax) / 2)
  }
  return Math.round((defaults.isolationMin + defaults.isolationMax) / 2)
}

export function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export async function notifyRestComplete(opts: {
  sound: boolean
  vibration: boolean
}): Promise<{ played: boolean; vibrated: boolean; note?: string }> {
  let played = false
  let vibrated = false
  let note: string | undefined

  if (opts.vibration && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200])
      vibrated = true
    } catch {
      // ignore
    }
  }

  if (opts.sound && typeof window !== 'undefined') {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (Ctx) {
        const ctx = new Ctx()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.frequency.value = 880
        gain.gain.value = 0.05
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.2)
        played = true
      }
    } catch {
      // ignore
    }
  }

  // Honest about iOS PWA limits
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent
    if (/iPhone|iPad|iPod/.test(ua)) {
      note =
        'iOS PWAs have limited background notification support. Keep the app open for reliable rest alerts.'
    }
  }

  return { played, vibrated, note }
}
