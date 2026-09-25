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
