# Scientific Socialism Spaced Repetition App

A local-first spaced repetition web app for reviewing Scientific Socialism final exam material. The app uses a mixed study deck with essay prompts, core ideas, memory hooks, outlines, key concepts, and comparison cards.

## Features

- Due-card review mode with reveal-and-rate recall
- Cram mode for reviewing any card at any time
- Browse mode by question or topic
- Exam-prep scheduling with Again, Hard, Good, and Easy ratings
- Local browser progress storage
- Progress import and export as JSON
- Offline-ready PWA files

## Run Locally

Install Node.js, then run this command in the project folder:

```powershell
node server.cjs
```

Open:

```text
http://127.0.0.1:4173/
```

Keep the terminal open while studying. Your review progress is stored locally in your browser, not in GitHub or a server.

## GitHub Pages

This repo is ready for GitHub Pages because `index.html` is at the repository root.

To publish it:

1. Open the repository on GitHub.
2. Go to **Settings**.
3. Open **Pages**.
4. Set **Source** to **Deploy from a branch**.
5. Choose branch `main` and folder `/root`.
6. Save and wait for GitHub to publish the site.

## Files

- `index.html` - app shell
- `styles.css` - responsive styling
- `app.js` - review flow, progress storage, scheduling, import/export
- `cards.json` - generated 50-card study deck
- `manifest.json`, `sw.js`, `icon.svg` - PWA support
- `server.cjs` - simple local static server

## Privacy

All progress stays in the browser through local storage. There is no login, backend, analytics, or cloud sync.
