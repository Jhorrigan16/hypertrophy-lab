# Hypertrophy Lab

Personal hypertrophy workout tracker — an iPhone-first Progressive Web App. No login, backend, payments, or subscription. All data stays on your device in IndexedDB (Dexie).

**Not affiliated with or endorsed by any coach or brand.**

## Features

- 10-week, four-day upper/lower program (fully editable)
- Workout logging with warm-ups, RIR, rest timer, pause/resume, crash recovery
- Cardio / running layer (Easy Run, Intervals, Zone 2, Bike, Row) with live timer or quick log, distance/time/effort, IndexedDB persistence
- Double-progression suggestions from real history only
- Searchable exercise library with cues, alternatives, and custom exercises
- Progress charts (volume, strength e1RM estimates, muscle volume, consistency, PRs, cardio)
- Historical readiness chart (not medical advice; no pre-workout readiness popup)
- JSON export/import with validation
- Installable PWA (Safari Add to Home Screen)

> **Data warning:** Clearing browser/site data or removing the Home Screen app can erase your history. Export backups from Settings regularly.

## Stack

React · TypeScript · Vite · Tailwind CSS · Lucide · Recharts · Dexie.js · vite-plugin-pwa · date-fns · Vitest

## Local development

```bash
npm install
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`).

### Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |
| `npm test` | Run Vitest suite |
| `npm run test:watch` | Vitest watch mode |
| `npm run lint` | Oxlint |

## Tests

```bash
npm test
```

Covers double progression, increment rounding, RIR logic, deload set reduction, workout completion/persistence, import/export validation, unit conversion, program restart, and duplicate set prevention.

## Build for production

```bash
npm run build
```

Output is in `dist/`. Includes service worker, web manifest, and assets.

## Live site

**https://hypertrophy-lab-274.netlify.app**

Admin: [Netlify project](https://app.netlify.com/projects/hypertrophy-lab-274)

## Deploy on Netlify (HTTPS)

Site is linked on Netlify (`hypertrophy-lab-274`) with:

- **Build command:** `npm run build`
- **Publish directory:** `dist`
- SPA fallback via `public/_redirects` and `netlify.toml` (`/* → /index.html 200`)

```bash
npm run build
npx netlify deploy --prod --dir dist
```

GitHub continuous deploy is configured against `main` (build settings in Netlify). If automatic builds do not run, reconnect the Netlify GitHub App in project settings, or redeploy with the CLI above.

## Install on iPhone (Safari)

1. Open the deployed HTTPS URL in **Safari** (not Chrome/in-app browsers).
2. Tap the **Share** button.
3. Tap **Add to Home Screen**.
4. Confirm the name (**Hypertrophy** / Hypertrophy Lab) and tap **Add**.
5. Launch from the Home Screen for standalone mode (status bar themed to `#101114`).

### iOS PWA notes

- Rest timer alerts work best with the app open; iOS PWAs have limited background notification support.
- Data is stored locally on the device. Removing the app or clearing Safari data can delete history — use **Settings → Export JSON backup**.

## Program overview

Four training days across 10 weeks:

| Day | Focus |
|-----|--------|
| Upper A | Incline Smith, chest-supported row, machine press, pulldown, laterals, triceps, Bayesian curls |
| Lower A | Hack squat, leg press, leg curl, extension, calves, cable crunch |
| Upper B | High row, flat DB press, single-arm pulldown, shoulder press, reverse pec deck, preacher, OH triceps |
| Lower B | RDL, leg curl, Smith split squat, hip thrust, seated calves, hanging knee raise |

Suggested schedule: Mon Upper A, Tue Lower A, Wed rest, Thu Upper B, Fri Lower B, weekend rest. Workouts can be moved without losing program progress.

Warm-ups are logged separately and excluded from working volume.

## License

Private personal project unless otherwise noted.
