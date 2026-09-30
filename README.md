# ARCHER AI — JARVIS-Style Personal Assistant

One brain, every device. The **ARCHER website** is the brain (voice UI + memory +
tasks + agent actions); the **Windows app (`ARCHER.exe`)** and **Android app
(`ARCHER.apk`)** are full clients of the same brain — they link back
automatically, appear on the website as *Linked Systems*, and execute commands
sent from the website chat.

**Features**

- 🎙️ Voice assistant — talk to ARCHER (Bangla & English), it answers out loud
  (per-script voice selection, clarity scoring, adjustable rate / pitch / volume)
- 🧠 Memory — long-term memory items ARCHER recalls in conversation
- ✅ Tasks — add / complete / clear tasks by voice or chat
- 📰 Headlines — news headlines panel
- 🔗 Linked Systems — every installed app (Windows / Android) shows up on the
  website with online/offline status; send remote commands to any device
- 💬 Chat commands — `open youtube`, `/device`, `/device open notepad`,
  `/device say dinner time` … run **on your device**
- 📱 PWA — installable as a system-like app (home screen, fullscreen, offline shell)
- 📦 AUTO BUILD — GitHub Actions builds `.exe` + `.apk` on every push

---

## Project structure

```
archer-ai/
├── client/                 # ARCHER website (Next.js 16 + Prisma + SQLite)
│   ├── src/                #   JARVIS HUD UI, voice engine, agent actions
│   ├── src/app/api/        #   chat, tasks, memory, headlines, devices, commands,
│   │                       #   apps/download (direct app downloads)
│   ├── prisma/             #   schema.prisma
│   ├── db/                 #   SQLite data snapshot
│   └── public/             #   PWA manifest/icons/sw, agent-client.js (device agent)
├── db/                     # SQLite runtime database (live data)
├── server/                 # Node.js device-link core
│   └── src/
│       ├── protocol.js     #   DeviceClient: register / heartbeat / poll / ack
│       └── executors/      #   windows.js — launch apps, open URLs, toast, sys info
├── electron/               # Windows desktop app → ARCHER-Setup.exe / ARCHER-Portable.exe
├── android/                # Capacitor Android project → ARCHER.apk
├── www/                    # web shell assets for the Android WebView (cap sync)
├── scripts/
│   ├── apkbuild/           # manual APK pipeline (aapt2 → javac → d8 → apksigner)
│   └── winbuild/           # manual Windows portable zip pipeline
├── capacitor.config.json   # Android app config (server URL baked at build time)
├── package.json            # workspace root (client + server + electron)
└── .github/workflows/
    └── build-release.yml   # AUTO BUILD: .exe + .apk on every push → GitHub Releases
```

---

## Requirements

| Tool | Version | Needed for |
|------|---------|-----------|
| **Node.js** | ≥ 20 | website + workspace installs |
| **npm** | ≥ 10 | installing dependencies |
| **Git** | any | cloning the repo |
| Java JDK | 21 | *optional* — building the APK locally with Gradle |
| Android SDK | API 34 | *optional* — building the APK locally with Gradle |
| Bun | latest | *optional* — the `npm start` production script uses bun (node works too) |

> No database server needed — ARCHER uses SQLite files that ship with the project.

---

## Full install process (website)

```bash
# 1. clone
git clone https://github.com/<your-username>/archer-ai.git
cd archer-ai

# 2. install everything (workspace root installs client + server + electron)
npm install

# 3. generate the Prisma client (required on first run / after schema changes)
npm run db:generate

# 4. (optional) sync the schema into the SQLite database
npm run db:push

# 5. run it
npm run dev
```

Open **http://localhost:3000** — ARCHER boots with a JARVIS-style HUD.

First-run checklist:

1. **Allow microphone + sound** when the browser asks (voice needs it).
2. Click the mic button and say *“hello archer”* — or type in the chat box.
3. Open **SETTING** to configure voice, rate, pitch and the volume slider
   (0–100 %, default 50 %) — settings persist in SQLite.
4. Best on Chrome / Edge (speech recognition is Chromium-only). On iPhone use
   **Add to Home Screen** for the PWA; voice input depends on iOS support.

### Run in production

```bash
npm run build          # next build → standalone server + static assets
npm run start          # bun .next/standalone/server.js (port 3000)
# no bun? node works the same:
# (cd client && node .next/standalone/server.js)
```

### Database

- Schema: `client/prisma/schema.prisma` — models: `Task`, `MemoryItem`,
  `ChatMessage`, `Setting`, `Headline`, `Device`, `DeviceCommand`.
- Data files ship with the project: `db/custom.db` (runtime) and
  `client/db/custom.db` (snapshot). `client/.env` points Prisma at
  `file:../db/custom.db`.
- After pulling schema changes: `npm run db:generate && npm run db:push`.

### Install as a system app (PWA)

Open the website → the browser address bar shows **Install** (or use the
install button in the app). ARCHER then opens fullscreen from the home
screen / app list like a native app, with its own icon and offline shell.

---

## Get the ARCHER apps (Windows `.exe` / Android `.apk`)

**SETTING → Get the ARCHER Apps** has **Windows** and **Android** buttons that
download the real apps **directly from the website**
(`/api/apps/download?target=windows|android`) — clicking them never opens
github.com. The download fallback chain:

1. **Locally built artifact** — `client/public/downloads/ARCHER-Windows.zip` +
   `ARCHER.apk` are streamed straight from the website (these are build
   outputs and are not committed; build them locally or via CI).
2. **GitHub Releases proxy** — type your repo (`owner/repo`) in the SETTING
   field and save; CI-built release assets are proxied through the same
   buttons as a direct file download.
3. **Nothing built yet** — a friendly in-app “not built yet” message, never a
   GitHub page.

### Option A — download ready-made (recommended)

- **Windows**: extract `ARCHER-Windows.zip` → run `ARCHER.exe`
  (CI also produces `ARCHER-Setup-*.exe`, a classic installer).
- **Android**: install `ARCHER.apk` — allow *“install unknown apps”*
  (direct APK, not from Play Store). ARCHER opens fullscreen like a system app.

### Option B — auto build with GitHub Actions (zero local tooling)

Every push to `main` triggers `.github/workflows/build-release.yml`:

- `windows-latest` runner → `electron-builder` → `ARCHER-Setup-*.exe` +
  `ARCHER-Portable-*.exe`
- `ubuntu-latest` runner → Capacitor + Gradle → `ARCHER.apk`
- Pushing a tag (`git tag v1.0.0 && git push origin v1.0.0`) or running the
  workflow manually (**Actions → Build ARCHER AI → Run workflow**) also
  **publishes everything to GitHub Releases**.

Point the apps at your website: set the repo **variable** `ARCHER_SERVER_URL`
(GitHub → Settings → Secrets and variables → Actions → **Variables**) before
the build; it is baked into both apps.

### Option C — build locally

```bash
# Windows installer (needs Windows + Node 20)
cd electron && npm install && npx electron-builder --win

# Android APK (needs JDK 21 + Android SDK API 34)
npm install --ignore-workspace
npx cap sync android
cd android && ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

---

## How devices link to the website

1. Install the app on your PC/phone (download from **SETTING → Get the ARCHER Apps**).
2. The app opens the ARCHER website inside its own window / WebView.
3. A tiny agent (`client/public/agent-client.js`) detects the platform bridge
   and registers the device with the brain — it appears on the website instantly.
4. On the website open **SETTING → Linked Systems**: see every device
   (online/offline), send one-tap commands (YouTube / Notify / Ping), or tap
   **Set Target**.
5. With a target set, chat commands run on that device:
   - type `open youtube` → YouTube opens **on your PC/phone**
   - `/device` → list linked systems
   - `/device open notepad` → launch an app on the target device
   - `/device say dinner time` → push a notification to it

Desktop users can re-point the app any time: edit
`%APPDATA%/ARCHER AI/config.json` or run `ARCHER.exe --server https://your-url`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Prisma Client did not initialize yet` | run `npm run db:generate` |
| Port 3000 busy | `npm run dev -- -p 3100` (or kill the old process) |
| Mic does not listen | allow mic in browser + OS settings; Chrome/Edge only |
| TTS silent on first tap | browsers need one user gesture before audio — tap once |
| Bangla voice sounds odd | install a Bangla TTS voice (Android: Google TTS → Bangla), then pick it in SETTING → Voice |
| `.exe` shows SmartScreen warning | unsigned build — click *More info → Run anyway* |
| APK won't install | enable *install unknown apps* for your browser/file manager |
| Devices show offline | the app window must stay running (Windows app lives in the tray) |

## Security note

The device API trusts any client that knows the site URL — fine for a personal
assistant on a private URL. If you deploy publicly, put the site behind your
own auth (e.g. Cloudflare Access) or add a shared device key to `/api/devices`
and `/api/commands` before exposing it.

---

## বাংলা দ্রুত শুরু (Quick start in Bangla)

```bash
git clone https://github.com/<your-username>/archer-ai.git
cd archer-ai
npm install          # সব dependency ইনস্টল হবে
npm run db:generate  # Prisma client তৈরি হবে
npm run dev          # → http://localhost:3000
```

- **ওয়েবসাইট** = ARCHER এর মস্তিষ্ক (ভয়েস, মেমোরি, টাস্ক)।
- **SETTING → Get the ARCHER Apps** থেকে Windows `.zip` / Android `.apk`
  **সরাসরি ডাউনলোড** হয় — GitHub পেজে যায় না।
- GitHub এ push করলেই Actions নিজে থেকেই `.exe` + `.apk` বানিয়ে
  Release এ তুলে দেয় (tag দিলে: `git tag v1.0.0 && git push origin v1.0.0`)।
- অ্যাপ ইনস্টল করলে সেটা **SETTING → Linked Systems** এ অনলাইন দেখাবে আর
  ওয়েবসাইটের চ্যাট কমান্ড (যেমন `open youtube`) সেই ডিভাইসে চলবে।
