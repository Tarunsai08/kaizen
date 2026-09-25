# Kaizen: personal wellbeing app

Track your life and get 1% better every day. Everything stays on your phone: no account, no server.

**Modules (v2):** Today (companion, day score, intention, energy, now/next) · Plan (day timeline, focus timer, tasks, goals, people) · Habits (build/break, urge timer, screen time, Shield) · Health (steps & sleep via Health Connect, sleep debt, energy curve, workouts, Mind tools: mood grid, breathe, reframe, life wheel) · Money · You (levels, streak freezes, Wrapped, year in pixels)

**v1 modules:** Habits (build and break, with an urge timer) · Movement (presets with levels, a weekly schedule, the "Up for it?" question before a session) · Sleep · Money (reads bank SMS, need/want tags, subscriptions, savings) · Tasks and projects · Goals (weekly, monthly, yearly and someday, with check-ins and reviews) · Boredom kit · Mood, morning check-in, night review and journal · Insights

---

## Install on your phone (free)

GitHub builds the APK for you.

1. **Create a GitHub account** at github.com if you don't have one.
2. **Create a new private repository** named `kaizen`. Keep it **private**, because it holds your app's signing key.
3. **Push this folder** from your Mac:
   ```bash
   cd "~/IITBombay/projects/wellbeing app/kaizen"
   git remote add origin https://github.com/<your-username>/kaizen.git
   git push -u origin main
   ```
4. On GitHub, open the **Actions** tab. The "Build Android APK" workflow runs and takes about 5 minutes.
   Each build produces **two APKs**:
   - `Kaizen-vN.apk` is the normal app. Install this one.
   - `Kaizen-Shield-vN.apk` is the same app plus Shorts/Reels blocking. It needs Accessibility, so Play Protect blocks it when you sideload it. To install it, turn off *Play Store → Play Protect → ⚙ → Scan apps* for a minute, install, then turn scanning back on. Both APKs share your data, and you can switch between them.
5. On your **Poco F5**, open `github.com/<you>/kaizen/releases` in Chrome (you need to be logged in) and tap **Kaizen-vN.apk**.
6. Open the downloaded file. If Android asks, allow **"Install unknown apps"** for Chrome. Then tap **Install**.

**Updating:** after any change, push again. A new release appears; download it and install it over the old one. Your data stays, because every build is signed with the same key.

### Widgets & shortcuts
Long-press the home screen → **Widgets** → Kaizen: *Today* (day score), *Mood* (one-tap mood logging) and *Quick actions* (bored, breathe, focus, urge). Long-press the app icon for shortcuts.

### First-run setup on the phone
- Allow **notifications** when asked.
- Open **Settings → Allow on-time reminders**.
- **Poco / HyperOS only:** long-press the app icon → App info → turn **Autostart** ON, and set Battery saver to **No restrictions**. If you skip this, MIUI/HyperOS may delay reminders.
- **Adding bank transactions:** in Messages, long-press a bank SMS → **Share** → **Kaizen**. The app does not ask for SMS permission, because Google Play Protect blocks sideloaded apps that request it.
- **Screen time:** Habits → Screen time → allow *Usage access*.
- **Shield** (Shield edition only): App info → ⋮ → *Allow restricted settings*, then Accessibility → *Kaizen Shield* → turn it on.
- **Steps & sleep:** Health → Move → *Connect* (Health Connect; works with Mi Fitness, Google Fit and others).
- **Back up** now and then: **You → Settings → Backup**. This saves a .json file you can restore later.

### Fallback: use it as a web app
Run `npm install && npm run build`, host the `dist/` folder anywhere (for example GitHub Pages or Netlify), open it in Chrome on the phone, and choose **⋮ → Install app**. Everything works except SMS import and scheduled notifications.

---

## Study roadmaps (v3)

The **Study** tab (Today · Plan · Study · Habits · Health; Money now lives on Today and under You) has three parts:

- **Roadmaps**: DSA (all 402 problems of Striver's A2Z sheet, in its order), System Design (ByteByteGo, Hello Interview, System Design Primer, MIT 6.5840, Kleppmann: 11 topics, 75 lessons) and ML & DL (math-first: 17 modules, 127 lessons, each with learn / deep-dive math / implement / practice resources). Nothing is locked. Every level is an animated path with progress rings, and finishing a lesson plays a completion animation.
- **Revise**: finished lessons become flashcards (spaced repetition 1 → 3 → 7 → 16 → 35 … days). At most one prompt a day, one notification a day, and a daily cap (Settings).
- **Learnings**: stack takeaways from podcasts, books and videos. *Do* items become experiments (7–30 days, daily check-in, before/after comparison, then keep → habit, tweak or drop). *Remember* items pop up at random times during the day.

### Excel format (import / export)

Export a subject (Study → + → Export), edit it in Excel or Google Sheets, then import it again. The roadmap is updated and your completed lessons stay completed. Any other subject can be added the same way.

| Column | Required | Meaning |
|---|---|---|
| ID | no | Filled in by export. Keep it when you re-import so your progress is kept. Leave it empty for new rows. |
| Subject | yes* | Subject name. A sheet can contain several subjects. *If the column is missing, the sheet name is used. |
| Topic | yes | Level 1 of the roadmap |
| Subtopic | no | Level 2. Leave it empty for a 2-level roadmap (Topic → Lesson). |
| Lesson | no | Level 3. Leave it empty to make the Subtopic itself the lesson. Deeper levels: `A › B`. |
| Difficulty, Summary, Recall question | no | Read from the first row of each lesson. The recall question is the flashcard. |
| Resource title, Resource URL | no | One resource per row. A lesson with 3 resources takes 3 rows. |
| Resource type | no | Learn, Deep dive, Implement, Practice or Apply |
| Medium | no | video, article, book, course, interactive, problem, paper, code, exercise |
| Resource note | no | e.g. "watch 12:00–30:00" |

Rows appear on the roadmap in the same order as in the sheet. On re-import: deleted rows are removed, new rows are added, edited text is replaced, and the preview shows exactly what will change before you apply it. `.csv` files work too.

Each build also checks every resource link (`content-src/check_links.py`) and attaches `link-report.md` to the workflow artifacts.

## Develop

```bash
npm install
npm run dev          # opens at http://localhost:5173 (use your browser's phone view)
npm run build && npx cap sync android   # then open /android in Android Studio if you want
```

**Stack:** React 18 + Vite, Dexie (IndexedDB) for local storage, Capacitor 6 for Android, and a custom `SmsReaderPlugin.java` for reading SMS and receiving shared links.

| Path | What |
|---|---|
| `src/db.js` | Database schema, seed data, backup/restore |
| `src/lib/logic.js` | Streaks, completion rates, day score, sleep consistency, goals, insights |
| `src/lib/sms.js` | Parser for Indian bank SMS (UPI, NEFT, cards) |
| `src/lib/notify.js` | All scheduled reminders (habits, tasks, goals, night review, morning) |
| `src/screens/*` | One file per module |
| `android/app/src/main/java/com/tarun/kaizen/` | Native SMS reader and share-intent handling |
