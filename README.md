# Orion — A Multiverse of Stories

Orion is a premium, feature-rich desktop Electron streaming application designed for streaming, downloading, and organizing movies, TV series, anime, and local media. 

With a cinematic dark design system, modern layouts, and micro-animations, Orion offers a high-end platform for tracking your personal watch library.

---

## 🌟 Key Features

### 🎬 Discovery & Streaming
* **Cinematic Home Carousel**: Smooth fade and slide transitions displaying top trending titles, age ratings, genres, and anime tags.
* **Smart Details Pages**: Organized grids for TV seasons, episodes, sequels/prequels collections, and similar recommendations.
* **Ad-Free Media Webview**: Sandboxed webview integration playing streams with ad/tracker blockers, custom key-injections, and automatic picture-in-picture.

### 📥 Managed Downloads
* **Automated Downloader Setup**: Instant installer that downloads and configures `yt-dlp` and `ffmpeg` into a sandboxed environment (`%APPDATA%/Orion/tools`).
* **Title-Based Organization**: Downloads are automatically saved inside clean, title-specific folders (e.g. `Toy Story (1995)/` or `Breaking Bad (2008)/`) in your selected destination directory.
* **Full Queue Controls**: Run, pause, resume, cancel, or delete downloads with live fragment counts, speeds, and progress bars.
* **Subtitle Integration**: Search and download subtitle files via **SubDL** and **Wyzie** APIs directly inside the download manager.

### 🔒 Secure Architecture & Storage
* **Secure Key Storage**: Leverages Electron's OS-native keychain encryption (via `safeStorage` DPAPI on Windows) to encrypt sensitive credentials (TMDB API token, SubDL/Wyzie keys) inside `secure-store.json`.
* **Watch History & Progress**: Automatically tracks watch states, current durations, and local configurations.
* **Automatic Backups**: Creates scheduled daily/weekly/monthly setting backups and manages maximum retention sizes.

---

## 🎹 Keyboard Shortcuts

Orion contains system-wide key bindings for fast navigation:
* `Ctrl + F` : Open / close global Search modal.
* `Ctrl + K` : Focus search filter on the Downloads page.
* `Esc` : Close active search overlays or open modals.
* `Ctrl + Z` : Navigate back to the previous screen.
* `Ctrl + R` : Reload the application.
* `?` : Toggle the keyboard shortcuts cheat-sheet.

---

## 🛠️ Technology Stack

* **Shell**: Electron (v40.4.1)
* **Frontend Logic**: React (v18.2.0)
* **Build System**: Vite (v7)
* **Styles**: Modern Vanilla CSS structured with a tailormade HSL color system, glassmorphism overlays, and cubic-bezier animations.
* **Downloader Backend**: Spawns native `yt-dlp` and `ffmpeg` processes.

---

## 🚀 Installation & Local Development

### 1. Prerequisites
Ensure you have **Node.js** (v18+ recommended) installed.

### 2. Setup
Clone the repository and install dependencies:
```bash
git clone https://github.com/OK-ALI/orion.git
cd orion
npm install
```

### 3. Run Development Build
To start the Vite builder watcher and launch the Electron application:
```bash
npm start
```

### 4. Build Production Binaries
To package the app for Windows (NSIS Installer `.exe` and a `.zip` release bundle):
```bash
npm run dist:win
```

*Build artifacts will be located under the `dist/` directory.*
