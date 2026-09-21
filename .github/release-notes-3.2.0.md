# Orion v3.2.0 — Smarter Playback, Richer Discovery & Safer Updates

> “Find more. Keep your place. Update with confidence.”

Orion v3.2.0 is a reliability and experience release for **Desktop and Mobile**. It makes playback choices clearer, trailers more dependable, discovery richer, updates safer, and first-time setup much cleaner.

---

## What’s New in Orion v3.2.0

### 🖥️ Orion Desktop

#### 🎞️ A Completely Reworked Trailer Experience
- **A cleaner in-app trailer player** with a dedicated list of available trailers when more than one is found.
- **Automatic trailer recovery** when an upload is removed, private, blocked from embedded playback, or temporarily unreachable.
- **Retry, Try Next, and Open Provider** actions make failed trailers easy to recover from without leaving the title page.
- **Improved fullscreen and small-window behavior** so trailer playback feels native to Orion instead of bolted on.
- Trailer playback stays inside its own protected Orion session, keeping the rest of Cinema undisturbed.

#### 🎬 Smarter Cinema Playback
- **VixSrc is now Orion’s verified default Cinema source** on Desktop.
- Sources that are retired, temporarily unavailable, or currently unreliable are kept out of automatic playback instead of interrupting a movie or episode.
- Other available sources remain accessible as **manual choices** when you want to try them yourself.
- **Playback continuity is more dependable** when moving between compatible sources, with Orion preserving your saved position whenever the destination can accept it.
- Source recovery and status messaging are clearer when a provider has trouble.

#### 🛡️ Safer Desktop Updates
- Orion now verifies that a downloaded update is the **exact release Orion expected** before installation.
- Replaced, incomplete, mismatched, or incorrectly signed installers are rejected instead of being launched.
- Update progress and retry states are clearer when a download or installation is interrupted.
- Release verification is performed before Orion hands an installer to Windows.

#### ✨ Cleaner First Launch
- Fresh installations now include Orion’s own Cinema metadata configuration, so users are **not asked for a TMDB API token**.
- Google sign-in uses Orion’s managed app configuration, so ordinary users are **not asked for Google developer credentials**.
- You can still choose to use Orion without signing in.

#### 🔧 Desktop Polish & Reliability
- Local playback better preserves the user’s play/pause intent through connectivity changes.
- Music Planet navigation and overlay layering have been tightened so controls stay reachable and predictable.
- Additional playback, offline, search, trailer, and update-path reliability fixes are included throughout the Desktop app.

---

### 📱 Orion Mobile

#### 🏠 A Home Screen You Can Shape
- Home now brings together more of Orion at a glance with **Trending Movies, Trending TV, New Releases, Coming Soon, K-Dramas, Top Rated**, and Continue Watching.
- New **Home Layout** controls let you show, hide, and reorder Home sections to match how you browse.
- Each shelf can take you straight into a matching **Explore More** view in Discover.
- The featured banner stays available while the rest of Home can be arranged around your preferences.

#### 🔎 A Much Richer Discover Experience
- Browse dedicated views for **Trending, Top Rated, New Releases, Upcoming**, and the wider catalog.
- Refine discovery by **region, genre, year, rating, media type, and sort order**.
- Regional paths and focused filters make it easier to jump into areas such as Korean, Japanese, and other international catalogs.
- Search handling has been improved so title and people discovery is more resilient to alternate spellings and naming variations.

#### 📺 Better Mobile Playback Controls
- A new **Resize** menu gives you **Original, Fit, Fill, and Stretch** picture modes.
- Fullscreen/orientation handling is more consistent when entering, leaving, or recovering a provider player.
- Source choices now communicate their playback and resume behavior more clearly.
- Orion avoids unhealthy sources for automatic playback while still allowing appropriate manual alternatives.
- Resume and Continue Watching behavior is more careful when moving between sources with different capabilities.
- Embedded playback protection has been strengthened against unwanted redirects, overlays, and disruptive provider behavior.

#### 🔔 Entertainment Alerts
- Optional notifications can now keep you informed about **new movies, new series, new episodes, anime releases, and upcoming titles**.
- Saved shows and upcoming releases can surface timely reminders instead of requiring repeated manual checks.
- Notification taps take you back to the relevant Orion destination rather than a generic landing screen.

#### ⬆️ More Reliable App Updates
- Mobile updates can now **download, verify, and continue into installation directly from Orion**.
- If Android requires install permission, Orion can resume the update flow after you grant it.
- The app verifies the downloaded package before installation and keeps clearer track of interrupted or completed update attempts.
- Update feedback is written in normal Orion language instead of exposing technical Android errors.

#### ⚙️ Settings & Everyday Polish
- Settings sections can now be **reordered**, making frequently used areas easier to reach.
- Notification, playback, Home, update, and accessibility settings have been reorganized and polished.
- Offline/reconnection behavior has been refined so Orion better distinguishes “no connection,” “recovering,” and genuine empty results.

---

## 🔄 Better Source Reliability Across Orion

Desktop and Mobile now share a clearer view of provider availability. Orion can keep a source out of automatic playback when it is having trouble, restore it when it is healthy again, and still present suitable manual choices without pretending every provider behaves the same way.

The result is less random source hopping, clearer expectations, and more reliable resume behavior.

---

## 🔐 Release & Update Integrity

v3.2.0 strengthens Orion’s update chain on both platforms. Release files are checked against Orion’s published release identity before installation, including the expected application, version, file integrity, and signer. If those checks do not match, Orion stops instead of installing the update.

---

## 📦 Release Downloads

| Platform | Artifact | Description |
| :--- | :--- | :--- |
| **Windows Desktop** | `Orion.Setup.3.2.0.exe` | Windows installer |
| **Windows Desktop** | `Orion-3.2.0-win.zip` | Portable Windows package |
| **Android Mobile** | `orion-mobile-v3.2.0.apk` | Signed Android release |

### Minimum System Requirements
- **Desktop:** Windows 10 (1809+) or Windows 11, 64-bit.
- **Mobile:** Android 7.0 (Nougat) or newer, API 24+.
- **Orion Connect:** Desktop and Mobile on the same local Wi-Fi / LAN network.

<!-- orion-mobile-rollout: 100 -->
