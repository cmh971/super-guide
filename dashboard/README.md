# 🛡️ Highrock Staff Dashboard

A polished web control panel for the Highrock Discord bot.

**Flow:** Staff open the site → **Login with Discord** (OAuth2) → the **bot DMs them**
asking which of the **2 servers** they want to manage → they tap a button → the
dashboard unlocks and any command they run there is dispatched by the bot into
the chosen server. Every action is written to a live **audit log**.

The dashboard and the bot never talk to each other directly — they share the
**same MongoDB**. The dashboard drops jobs into a queue; the bot picks them up,
checks the user really has the staff role in that server, runs them, and writes
the result back.

```
Browser ──HTTP──> Dashboard (Node/Express) ──Mongo──> Bot (discord.js) ──> Discord
   ▲                     │  OAuth2 w/ Discord
   └─────────── login ───┘
```

---

## 📁 What's in here

| Path | Language | What it is |
|------|----------|------------|
| `server.js`, `src/` | Node.js | The web server: OAuth, sessions, REST API, job queue |
| `public/` | HTML/CSS/JS | The frontend (login, server-select, command console, audit feed) |
| `src/bot-integration.js` | Node.js | Bot-side bridge (loaded by the bot's `index.js`) |
| `helpers/go-health/` | **Go** | Standalone uptime monitor with an HTML status page |
| `helpers/csharp-loganalyzer/` | **C#** | Reads the audit log from Mongo and builds a stats report |
| `helpers/cpp-crypto/` | **C++** | Generates the session secret + SHA-256 hashing |

---

## ✅ Prerequisites

| Tool | Needed for | Check |
|------|------------|-------|
| Node.js 18+ | dashboard + bot | `node -v` |
| Go 1.21+ | health monitor | `go version` |
| .NET 8 SDK | log analyzer | `dotnet --version` |
| g++ (C++17) | crypto utility | `g++ --version` |

> These were installed for you via `winget` (GoLang.Go, Microsoft.DotNet.SDK.8, MSYS2).
> **Open a new terminal** after install so the PATH refreshes.
> For g++ you also need to install the compiler package inside MSYS2 — see the C++ section below.

---

## 🚀 Setup

### 1. Fill in `.env` (in the project root, NOT in /dashboard)

```ini
DASHBOARD_URL=https://your-domain.com      # your real domain
DASHBOARD_PORT=3000
DISCORD_CLIENT_SECRET=...                   # Discord Dev Portal → OAuth2 → Reset Secret
DASHBOARD_SESSION_SECRET=...                # generate with the C++ tool (below)
GUILD_ONE_ID=...   GUILD_ONE_NAME=My First Server
GUILD_TWO_ID=...   GUILD_TWO_NAME=My Second Server
```

`CLIENT_ID` and `MONGO_URI` are already shared from the bot.

### 2. Register the OAuth2 redirect in Discord

Discord Developer Portal → your app → **OAuth2** → **Redirects** → add:

```
https://your-domain.com/auth/callback
```

(It must exactly match `DASHBOARD_URL` + `/auth/callback`.)

### 3. Install + run

```bash
cd dashboard
npm install
npm start
```

The bot loads the bridge automatically on startup — just run the bot as usual
(`node index.js` from the project root). Both processes must be running and
pointed at the same `MONGO_URI`.

---

## 🌐 Go — Health Monitor

```bash
cd dashboard/helpers/go-health
go run .                       # or: go build -o healthmon.exe
```

Then open <http://localhost:8090> for a live status page, or `GET /status` for JSON.
Configure what it watches:

```bash
TARGETS="dashboard=http://localhost:3000/healthz,go=http://localhost:8090/healthz" go run .
```

## 🟣 C# — Log Analyzer

```bash
cd dashboard/helpers/csharp-loganalyzer
dotnet run                     # reads MONGO_URI from ../../../.env
```

Prints totals, per-action breakdown, most-active staff, command success rate and
busiest hours, and writes `report.html`.

## 🔵 C++ — Crypto Utility

First install a compiler inside MSYS2 (one time):

```bash
# open "MSYS2 UCRT64" from the Start menu, then:
pacman -S --noconfirm mingw-w64-ucrt-x86_64-gcc
```

Then build & use it:

```bash
cd dashboard/helpers/cpp-crypto
g++ -std=c++17 -O2 -o crypto crypto.cpp      # or: make

./crypto secret            # -> paste into DASHBOARD_SESSION_SECRET
./crypto token             # URL-safe token
./crypto sha256 "hello"    # SHA-256 digest
```

---

## 🔒 Security notes

- Only members with the **staff role** in the chosen server can actually run
  commands — the bot re-checks this on every job, so the web session alone isn't
  enough.
- The dashboard can only dispatch a **whitelist** of commands (`src/config.js`
  → `allowedCommands`). It can never ask the bot to do something arbitrary.
- Sessions are signed and stored in Mongo; cookies are `httpOnly` + `secure`
  (when on HTTPS).
- **Rotate** any secret that has been shared in plain text (bot token, Mongo
  password, OAuth client secret).
