# Orion Mobile Specification & Architecture Roadmap

Orion Mobile is a full-featured cross-platform extension of Orion Desktop, designed to act as an integrated pillar of a unified Orion media ecosystem. Rather than running as a disconnected project, Orion Mobile shares core business logic with the desktop codebase, utilizes a shared cloud database, and establishes local network interfaces for media serving and smart remote control.

---

## 🏗️ 1. Architecture & Tech Stack

### Monorepo Structure
To ensure clean code reuse and prevent logic duplication across the desktop and mobile projects, the codebase transitions into a monorepo workspace (e.g. using Yarn Workspaces or Turborepo):
*   **`packages/shared`**: Contains UI design tokens, TypeScript types, TMDB API clients, streaming parser interfaces, and Supabase integration handlers.
*   **`apps/desktop`**: The existing Electron + React desktop codebase.
*   **`apps/mobile`**: The React Native + Expo + TypeScript mobile codebase.

### Cloud Integration (Supabase)
Supabase (free tier) is adopted as the primary synchronization backend:
*   **Authentication**: Google OAuth Sign-in matches the identity on both desktop and mobile apps.
*   **PostgreSQL Database**: Real-time synchronization of watchlists, Continue Watching sessions, user settings, custom playlists, and profile metadata.
*   **Realtime Channels**: WebSockets-driven channel subscription to broadcast instantaneous state changes (e.g., coordinate playheads during handoffs).

---

## 🎨 2. UI & Design System (Vast Specifications)

Orion Mobile is designed to maintain absolute parity with the premium dark visual environment of Orion Desktop. Rather than simplified layouts, it ports identical color palettes, fonts, and glowing starlight themes, re-engineering the desktop structures for a hand-held, gesture-driven mobile form factor.

```
Mobile Screen Hierarchy
├── Global Navigation (Bottom Tab Bar & Sticky Header)
├── Home Dashboard (Hero Banner, Continue Watching, Media Carousels)
├── Detail View (Parallax Poster, Tabbed Info, Episodes, Cast, Recommendations)
├── Media Player HUD (Gesture Controls, Source Sheets, Watchdog Popups)
└── Orion Connect Controller (Gesture Trackpad, Device Radar, Haptic Feedback)
```

---

### 🧱 I. Shared UI Design Tokens & Foundations
*   **Colors**: Built upon `var(--bg-base)` (`#06060c`) as the absolute background depth. Accent hues inherit Orion’s palette:
    *   *Primary Purple*: `var(--music-violet)` (`#7c4dff`)
    *   *Primary Cyan*: `var(--music-cyan)` (`#00a8ff`)
    *   *Warning/Danger Red*: `#f14668`
*   **Starlight Gradients**: The screen backdrops leverage `react-native-linear-gradient` to stack a deep blue-to-black diagonal base, overlaid with a dynamic, low-opacity radial glowing starlight orb that follows screen updates.
*   **Frosted Glass (Glassmorphism)**: Content panels, remote controls, and bottom navigation sheets use a customized `BlurView` (via `expo-blur`) configured with `intensity={75}` and `tint="dark"`. A subtle white border wrapper (`borderWidth: 1`, `borderColor: "rgba(255, 255, 255, 0.08)"`) creates depth.
*   **Typography Hierarchy**:
    *   *Headers & Titles*: **Outfit Bold** (letter spacing: `-0.02em` for cinematic weight).
    *   *Stats & Badges*: **Space Grotesk Medium** (monospaced look for years, runtimes, ratings, and codecs).
    *   *Paragraphs & Metadata*: **Inter Light/Regular** for high legibility at small sizes.

---

### 📱 II. Navigation Shell & Global Layouts
*   **Bottom Navigation Bar**: Replaces the desktop’s left sidebar for thumb-reach accessibility on handheld displays:
    *   *Tabs*: **Home** (Cinema), **Discover** (Search & Filters), **Downloads** (Offline Media), and **Orion Connect** (Server Sync/Remote).
    *   *Active Ring Glow*: The active tab icon shows a glowing circular ring below it rather than a simple color highlight, matching the WebGL orbits.
*   **Sticky Top Header**: A thin, glassmorphic header that stays pinned at the top:
    *   Left: A stylized neon **Orion** wordmark logo.
    *   Right: A dynamic connection status bubble. It glows **Cyan** when synced to a local Orion Desktop node, **Purple** when synced only to Supabase cloud, and **Gray** when offline.

---

### 🏠 III. Home Dashboard & Discover Views
*   **Hero Billboard**: The top 40% of the Home page features a prominent featured movie or show:
    *   Fades smoothly into background black at the bottom using a multi-step vertical gradient.
    *   Displays TMDB ratings, runtime badges, and a large, glowing glassmorphic **"Resume"** or **"Play"** button overlay.
*   **Horizontal Media Carousels**: Row listings (Trending, Recommended, Playlists) with standard widescreen poster cards.
    *   *Continue Watching Row*: Displays a landscape backdrop card with a bright purple/cyan progress indicator line on the card's bottom edge.
*   **Interactive Search & Filters Page**:
    *   *Search Bar*: A prominent input field that focuses instantly.
    *   *Genre Badges Carousel*: A horizontal, scrollable list of circular pill badges (e.g. Action, Sci-Fi, Thriller). Tapping a badge toggles the active filter overlay.

---

### 🎬 IV. Cinematic Media Details View
The movie and TV show info page uses a parallax scrolling layout:
*   **Parallax Header**: Dragging the page down scales the main movie backdrop image dynamically. As you scroll up, the backdrop fades and blurs into the top sticky header.
*   **Poster & Rating HUD**: A floating glassmorphic information card displaying genre tags, HD/4K tags, parental ratings, and average scores.
*   **Segmented Tab Bar**:
    *   *Info*: Description plot text, release status, audio languages, and sub-mode options.
    *   *Episodes (TV only)*: A dropdown menu to swap seasons, rendering a list of landscape cards for each episode containing thumbnail, title, runtime, and progress state.
    *   *Cast (Constellation Port)*: A horizontal row of circular headshot cards of the cast members, mimicking the desktop constellation layout.
    *   *Recommended*: A grid of similar titles.

---

### 📺 V. Mobile Native Media Player HUD
Designed for low-friction controls while streaming or casting:
*   **Gesture Areas**:
    *   Double-tap right side of screen: Fast-forward 10 seconds.
    *   Double-tap left side of screen: Rewind 10 seconds.
    *   Vertical slide on right side: Brightness adjustment.
    *   Vertical slide on left side: Volume adjustment.
*   **Control Panel Overlays**:
    *   *Casting Button*: Located in the top-right corner. Opens the native iOS/Android device route picker (AirPlay 2, Chromecast, Bluetooth Audio).
    *   *Sources Modal Sheet*: Slides up from the bottom, presenting a clean list of available scraping sources (Vidking, Videasy, VidSrc, etc.) along with latency indicators.
    *   *Watchdog Buffer Warning*: An automatic, beautiful frosted-glass overlay that floats on top if buffering exceeds 15 seconds. It presents buttons to **"Switch Source"** or **"Auto Failover"**.

---

### 🎛️ VI. Orion Connect Controller UI
A dedicated fullscreen controller replicating the interface of physical Smart TV remotes:
*   **D-Pad Swipe Pad**: A massive, circular, frosted-glass touchpad that dominates the top half of the screen. Left/Right/Up/Down swipes trigger smooth navigation commands, accompanied by light haptic buzzes. Tapping the center executes the select action.
*   **Remote Button Hub**: Tactical, widely-spaced buttons located at the bottom half:
    *   *Left*: Back (returns to previous menu).
    *   *Center*: Home (returns desktop app to dashboard).
    *   *Right*: Settings/Options menu.
    *   *Row below*: Volume Up, Mute, Volume Down.
*   **Text/Keyboard Sheet**: When focusing a text field on the desktop, a keyboard icon glows at the top of the phone remote. Tapping it opens your mobile keyboard overlay, allowing you to type fast search queries remotely.
*   **Haptic Engine Integration**: Every swipe gesture, edge collision, and key trigger sends distinct haptic vibration patterns (via `expo-haptics`) to make the virtual remote feel tactile.

---

## 🔗 3. Orion Connect Ecosystem Mode

The core integration engine is the **Orion Connect** panel on the mobile application. This mode presents four major pillars:

```
Orion Connect
    ├── Remote (Smart TV Controller)
    ├── Stream from Desktop (Local LAN Server)
    ├── Continue on Mobile (Seamless Handoff)
    └── Connected Devices (mDNS Discovery List)
```

### 🎛️ I. Remote (Smart TV Controller)
Transforms the mobile app into a virtual trackpad and keyboard controller for Orion Desktop when projecting on a TV or large screen.
*   **Gesture Touchpad Area**: A large swipe-sensitive area at the top of the interface. Swiping Up/Down/Left/Right translates to arrow keys on desktop. Tapping the screen registers as an `Enter/OK` click.
*   **Physical Buttons Mapped**:
    *   *Back*: Triggers the desktop `Escape` routing history action.
    *   *Home*: Triggers desktop navigation to the home page dashboard.
    *   *Volume & Mute*: Direct slider control adjustments over the desktop audio output.
*   **Overlay Keyboard Sync**: When a text field (such as search inputs) gains focus on Orion Desktop, the mobile app opens the native system keyboard. Text entered is piped directly to the active input over local WebSockets in real time.

### 💿 II. Stream from Desktop
Accesses and streams downloaded media files from your PC library directly to your mobile phone over your home Wi-Fi network.
*   **Static HTTP File Server**: Orion Desktop launches a local HTTP server that exposes the local metadata databases and media folders.
*   **Range-Seek Streaming**: The mobile player requests video streams using byte-range headers (`Range: bytes=X-Y`), allowing instant scrubbing and seeking of multi-gigabyte video files hosted on the computer.

### 🔄 III. Continue on Mobile (Handoff)
Enables seamless visual handoff when moving from one screen to another.
*   **Continuous Progress Pushes**: When playing media, Orion Desktop pushes the active session details (TMDB ID, episode/season, current timestamp, active provider) to the Supabase database.
*   **One-Tap Takeover**: Tapping "Continue on Mobile" on the mobile dashboard issues a remote `PAUSE` signal to the desktop instance via WebSockets, then immediately opens the mobile media player, initializing playback at the exact coordinate.

### 🔌 IV. Connected Devices (mDNS Radar)
Allows mobile phones to dynamically discover running Orion Desktop computers on the local subnet.
*   **ZeroConf / Bonjour discovery**: Desktop advertises a dedicated service type (e.g. `_orion-connect._tcp.local`) over port `4000`.
*   **Device Pairing Radar**: Mobile scans the network, listing active desktop nodes along with their hostname, IP address, and connection ping.

---

## 📡 4. TV Integration: Casting & Smart LEDs

To run or stream Orion on a **Samsung LED TV** or other screens, the application supports three pathways:

### 1. AirPlay & Chromecast Casting (From Mobile)
The built-in mobile video player features standard AirPlay and Chromecast buttons. Tapping these routes the raw, resolved video link (e.g., extracted HLS `.m3u8` streams) directly to TVs supporting these protocols.

### 2. Tizen OS Port (Samsung Native Web App)
Because Samsung Smart TVs run on Tizen OS, Orion's React bundle (`dist/`) can be compiled as a Samsung Smart TV Web App.
*   **CORS Workaround**: Smart TVs block standard video scrapers due to security restrictions.
*   **Scraping Relay**: The Tizen Web App communicates with the running Orion Desktop instance on the local network. The desktop parses the stream candidates, resolves the link, and relays the clean video stream back to the Samsung LED TV.

### 3. Dongle support (tvOS & Android TV)
Using React Native allows compiling the client project into native **Android TV** and **tvOS** apps, supporting physical TV remote navigation using d-pad hooks.

---

## 🗓️ 5. Initial Scope Restrictions
*   **Music Planet**: Excluded from the v1.0.0 initial mobile release. It will remain locked on mobile as a preview/coming soon link. Its development will be expanded to the mobile platform in future ecosystem releases once the desktop WebGL engine is complete.
