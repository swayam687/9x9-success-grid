# Success Grid — 9×9

Vanilla HTML/CSS/JS goal tracker. No build step. Open `index.html` in any modern browser.

## How to run
- Double-click `index.html`, or
- In VS Code: right-click `index.html` → **Open with Live Server** (recommended for best experience)

## Files
- `index.html` — app shell + onboarding markup
- `styles.css` — mobile-first styles, dark + light themes
- `app.js` — state, storage, rendering, events

## How to use (first time)
1. Onboarding: watch the pitch → enter your name → enter your goal
2. Pick **Build with AI** (copies a prompt you paste into ChatGPT/Claude) OR **Start from blank**
3. Land on **Today** — see 3 next things to do, log time, glance at your grid
4. Tap **Grid** → tap a pillar → tap a goal → check off subtasks

## Storage
All data in `localStorage` under `success-grid-v5`. Auto-migrates from `success-grid-v4` if present.

## Themes
Topbar 🌙 / ☀️ toggles theme. Defaults to your OS preference.

## Planned (not in this drop)
- DSA tracker (currently a placeholder modal)
- Fitness modules (workout log, weight tracker)
- Login / backend sync