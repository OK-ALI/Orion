# WAVEN UI/UX Reference & Design Contract

- **Product:** WAVEN — *Where Music Lives.*
- **Document role:** Canonical UI/UX reference and consistency contract for WAVEN v1 design work
- **Prepared:** 2026-09-15
- **Primary implementation phase:** Phase 5 — WAVEN design system and navigation
- **Applies forward to:** later Search, Library, Detail, Player, Lyrics, Queue, Offline, Cloud, and release phases where UI/UX is involved
- **Current Phase 5 authorization checkpoint:** `343a5aef9cc5ae589b344ffac251f40c3c84c681`
- **Authoritative WAVEN v1 completion at document creation:** **38%**
- **Important:** this document records accepted design direction and reference translations. It does not by itself authorize later phases or change completion percentage.

---

## 1. Purpose

This document exists to prevent visual and interaction drift while WAVEN evolves.

External references are **idea sources, not screen templates**. WAVEN may borrow a hierarchy, transition, interaction, density pattern, material idea, or motion concept, but every accepted idea must be translated through one coherent WAVEN design language.

The governing rule is:

> **Ideas may come from many places. The final language comes from one place: WAVEN.**

The original user-shared screenshots/videos remain preserved in the design discussion. This repository document records the accepted design conclusions so implementation does not depend on remembering a chat or copying external artwork.

---

## 2. Product identity boundary

### 2.1 WAVEN owns its visual identity

WAVEN is visually independent.

- **Orion** is an ecosystem and quality reference only.
- Orion does **not** supply WAVEN colors, fonts, layouts, navigation, components, or UI tokens.
- **Music Planet** is WAVEN's strongest product-experience ancestor for music hierarchy and behavioral ideas.
- Music Planet is **not** a Desktop UI template for WAVEN.
- Desktop-specific sidebar, hover, cursor, Electron, DOM/CSS, floating/resizable-player, literal orbital, and purple/cosmic presentation patterns are not copied.

### 2.2 Core visual palette

The persistent WAVEN identity is:

- **Black:** environment and depth
- **Silver / cool white:** structure, hierarchy, readable content
- **WAVEN blue:** life, identity, active state, interaction
- **Artwork-derived colors:** temporary atmosphere only

Artwork color may tint the environment, especially around the player and detail heroes, but it must never replace WAVEN blue as the interaction color.

Avoid introducing unrelated purple, magenta, yellow, green, or rainbow accents merely because a reference uses them.

### 2.3 Wordmark and title treatment

- Primary brand treatment is a centered **WAVEN** wordmark.
- The **V** carries WAVEN blue.
- Major titles use proper title case, e.g. **Where Music Lives**.
- A single meaningful word in a major title may use WAVEN blue, e.g. **Where _Music_ Lives**.
- Blue emphasis must remain selective so it retains meaning.
- Section labels and dense content should remain mostly white/silver.

---

## 3. WAVEN material language

WAVEN may use a restrained proprietary dark-glass language.

### WAVEN Glass

- Deep near-black translucent surface
- Subtle silver edge / border
- Controlled blur
- Low-intensity depth and shadow
- WAVEN-blue highlights only for active/focused states
- Artwork-derived color may softly bleed behind the glass
- Glass is selective, not applied to every card and row

Best candidates:

- Search field
- Filter chips
- Bottom navigation dock
- Mini / Quick Player
- Bottom sheets
- Context menus
- Lyrics / Queue overlays
- Startup / Sign-In surfaces

WAVEN must not imitate iOS chrome, Dynamic Island, system status UI, or Apple-specific layout. The useful qualities are depth, translucency, spacing, restraint, and atmosphere, translated into an Android-first product.

---

## 4. Primary shell

### 4.1 Primary destinations

The primary mobile shell is:

**Home · Search · Library**

- **Now Playing is not a fourth tab.**
- Full Player is reached from the persistent player.
- Settings/Profile remain outside the primary navigation.
- Provider/source management is secondary and must not consume a primary tab.

### 4.2 Destination personalities

Each destination belongs to the same design system but has a different content personality.

#### Home
- Curated
- Visual
- Music-first
- Spacious but not empty
- Minimal explanatory copy
- Real artwork/content should dominate
- Avoid walls of identical cards

### 4.3 Home state contract

Home has two materially different product states and they must not be confused.

#### First-run / zero-data Home
This is the state Phase 5 may validate without fabricating music data.

- Centered **WA[V]EN** brand lockup with the smaller **Where Music Lives** tagline beneath it.
- **Music** remains the WAVEN-blue word in the tagline.
- A restrained **Start Listening** surface may guide a new user toward Search.
- Empty history/library areas stay quiet and truthful.
- No fake songs, fake listening history, fake recommendations, fake mixes, or fabricated provider content.
- This state is intentionally sparse. It is not the permanent populated Home.

#### Populated Home
Once real activity/provider data exists, the first-run composition must transform into a content-first music Home.

- The brand lockup remains, but it must not consume the main content role.
- The first-run **Start Listening** surface should retire or transform into a useful live surface such as **Continue Listening**, a current session, or another real personalized surface supported by the owning phase.
- Home should gain one strong artwork-led dominant music surface instead of preserving the small onboarding CTA as its hero.
- **Recently Played** becomes a real artwork-led row/carousel when history exists.
- Discovery/recommendation sections may appear only when real provider capability/data supports them.
- **Your Music** becomes real shortcuts/collections such as liked music, playlists, albums, artists, and later downloads where their owning phases permit them.
- The persistent Mini Player will eventually occupy the layer above primary navigation when a real playback session exists.
- Populated Home should become denser through real music, not through explanatory copy or decorative filler.

The content-first direction from **Reference 02 — Content Hierarchy + Library Density** governs populated Home. Phase 5 defines the shell and truthful zero-data experience; later phases supply real discovery, history, library, playback, and personalization state.

#### Search
- Exploratory
- Fast
- Premium dark-glass query surface
- Discovery before query
- Focused result mode after query
- Keyboard-open state should simplify rather than compete with background discovery

#### Library
- Efficient
- Dense
- Filterable
- Fast to scan
- Less theatrical than Home or Full Player
- Collection shortcuts and actual music should dominate

#### Full Player
- Immersive
- Artwork-led
- Motion-rich within performance limits
- One of WAVEN's strongest identity surfaces

---

## 5. Reference registry

## Reference 01 — Continuous Music Morph

### Accepted idea
A Full Player can transform continuously into a Similar/Discovery experience and back without hard page replacement.

### WAVEN translation
- Full Player artwork remains physically continuous through the transition.
- Title and transport controls retreat rather than abruptly vanish.
- Related tracks emerge along a **WAVEN sound-flow / waveform path**, not literal planets or orbital space.
- Focused track becomes larger while surrounding recommendations reduce in size/depth.
- Selecting a new track reverses the transformation into the Full Player around the selected artwork.
- The same concept may later inform Mini Player → Full Player transitions.

### Design principle derived
> Important musical objects should transform between surfaces when practical rather than disappear and reappear.

### Do not copy
- Literal planetary/orbital grammar
- Exact arrangement
- Exact colors
- Exact artwork treatment

### Phase relevance
- P5: motion/shared-object foundation
- P6: real discovery/similar content
- P10: final immersive player and polished morph

---

## Reference 02 — Content Hierarchy + Library Density

### Accepted Home ideas
- Large amount of explanatory copy is unnecessary.
- One dominant personalized/music surface near the top.
- Actual music should follow quickly.
- Stacked/depth treatments may communicate collections or mixes.

### Accepted Library ideas
- Compact category/filter controls.
- Dense music rows.
- Quick collection access.
- Efficient information hierarchy.

### WAVEN translation
Possible Home hierarchy:

1. WAVEN wordmark / restrained header
2. **Where _Music_ Lives**
3. Continue Listening / Made For You / active-session surface
4. Recently Played
5. Discovery / For You
6. Your Music shortcuts
7. Persistent Mini Player
8. Floating bottom navigation

Possible Library hierarchy:

1. **Your _Library_**
2. `All · Songs · Albums · Artists · Playlists`
3. Liked / Downloaded / Playlist / Artist shortcuts where real data exists
4. Dense rows or appropriate grid/list content

### Do not copy
- White skin
- Exact card shapes
- Fake artwork
- Exact navigation

---

## Reference 03 — Adaptive Mini Player + Quick Playback Motion

### Accepted ideas
- Persistent artwork
- Compact song metadata
- Immediate Play/Pause
- Waveform/progress language
- Track-change cross-transition
- Up Next preview
- Optional current-output awareness
- Player can expand rather than be replaced

### WAVEN player hierarchy

#### Collapsed Mini Player
- Artwork
- Title / Artist
- Play/Pause
- Thin WAVEN waveform/progress treatment
- Lives above bottom navigation

#### Optional Quick Player
A middle layer may be used if physical testing proves it useful:

- Artwork + metadata
- Seek waveform
- Primary transport controls
- Up Next preview
- Can expand into Full Player

#### Full Player
Final immersive surface, primarily P10-owned.

### Gestures
- Tap Mini Player → Full Player
- Play/Pause remains directly accessible
- Swipe-up may reveal Quick Player only if testing proves it intuitive
- Avoid hidden hover-derived behavior

### Do not copy
- Rainbow waveform
- Purple control color
- Desktop-widget proportions
- Hover interactions

---

## Reference 04 — Premium Glass Search + Layered Atmosphere

### Accepted Search ideas
- Search field near the top
- Lightweight mood/genre/discovery chips
- Artwork-led trending/discovery content
- Minimal explanatory text
- Discovery mode transitions into focused result mode

### Accepted atmosphere idea
Artwork colors may extend beyond artwork and tint the surrounding environment.

### WAVEN translation
- Dark glass search surface
- Selected filter state in WAVEN blue
- Inactive filters in silver/black glass
- Artwork-derived environmental glow behind relevant content
- WAVEN blue remains the interaction color

### Do not copy
- Yellow active states
- iOS chrome
- Clear/white glass everywhere
- Exact floating-tab design

---

## Reference 05 — WAVEN Entry Experience

### Accepted ideas
- Music/artwork communicates product identity before heavy copy.
- Short onboarding progression can preserve the same visual frame while content transforms.
- One strong musical visual is preferable to many explanatory elements.
- Sign-In hierarchy should be extremely simple.

### WAVEN startup flow

#### Native splash
- Fast
- Deep black
- Centered WA[V]EN
- No long movie or mandatory cinematic delay

#### In-app handoff
- Wordmark remains visually continuous
- Blue V receives a subtle signal/wave motion
- Artwork/music elements emerge
- Optional **Where _Music_ Lives** title
- First-run motion may breathe slightly more than repeat launches

#### First-run onboarding
- Maximum restraint
- Prefer 1–3 short visual moments
- Transform content rather than replacing entire screens
- Avoid multi-page marketing copy

#### Sign-In
- WAVEN-native
- Google identity only through the already-established architecture
- No duplicate username/password system
- Dark-glass sign-in surface may be used
- Transition into Home should feel continuous

### Phase boundary
- P5 owns presentation and UX.
- Existing identity plumbing is reused.
- WAVEN Orion Cloud music synchronization remains P9.

---

## Reference 06 — Living Synced Lyrics

### Accepted ideas
- Current lyric is dominant.
- Neighboring lyrics recede into lower contrast/depth.
- Smooth auto-follow.
- Animated handoff between current and next line.
- Lyrics should feel synchronized, not like a static text document.
- Player ↔ Lyrics transition should preserve continuity.

### WAVEN translation
- Active line mostly white for readability.
- WAVEN-blue accent/signal may animate through the transition.
- Outgoing line may dissolve or flow subtly into blue/silver particles in Quality mode.
- Manual scrolling temporarily stops auto-follow.
- Show **Return to current lyric** after manual scrolling.
- Tapping a lyric may seek when timestamped lyrics/provider capability safely supports it.

### Performance tiers
- **Quality:** subtle particle/wave handoff
- **Balanced:** blur/fade/vertical handoff
- **Efficiency:** opacity + scroll
- **Reduced Motion:** immediate emphasis or gentle fade

---

## Reference 07 — Album / Playlist Detail Hierarchy

### Accepted ideas
- Artwork-led hero
- Title/artist/metadata hierarchy
- Prominent Play action
- Dense track list
- Header can collapse while scrolling

### WAVEN translation
Shared detail skeleton:

1. Artwork / visual hero
2. Artwork-derived atmosphere fading into black
3. Title + metadata
4. Play / Shuffle / Favorite / More
5. Track/content list
6. Active-playing row uses WAVEN blue and a subtle living indicator

### Collapsing behavior
Large hero may reduce into a compact sticky header during long track lists.

### Do not copy
- Purple/teal skin
- Exact gradients
- Exact player
- Noisy favorite icons on every row unless interaction testing supports it

---

## Reference 08 — Artist Identity + Discography Hierarchy

### Accepted ideas
- Artist portrait becomes part of the hero atmosphere.
- Artist page represents a broader musical world than one album.
- Popular tracks should appear early.
- Releases, appearances, and related artists can follow.
- Follow/Play hierarchy is clear.

### WAVEN translation
Possible Artist structure:

1. Portrait integrated into atmosphere
2. Artist name
3. Verified mark only where real provider data supports it
4. Real listener/follower stats only when exposed
5. Play / Shuffle / Follow
6. Popular
7. Latest Release
8. Albums & Singles
9. Appears On
10. Related Artists

### Do not copy
- Fake provider stats
- Star ratings
- Exact blue skin
- White-background visual system

---

## Reference 09 — Floating Adaptive Navigation

### Accepted idea
The active destination expands into a labeled pill while inactive destinations remain quieter.

### WAVEN translation
- Floating dark-glass navigation dock
- Three destinations only: Home / Search / Library
- WAVEN-blue active pill/state
- Silver inactive states
- Smooth active-pill morph
- Optional haptic on destination change
- Mini Player lives directly above it
- Both surfaces feel related but remain structurally separate
- Gesture and 3-button safe areas respected

### Reduced Motion
State switches without traveling/morph animation.

### Do not copy
- Green/yellow active colors
- Exact icons
- Exact glass proportions

---

## Reference 10 — Living Playback Control

### Accepted idea
Play and Pause should morph instead of popping between unrelated icons.

### WAVEN translation
- White/silver structural icon
- Smooth Play ↔ Pause morph
- Short WAVEN-blue arc/signal during interaction
- Small press compression
- Haptic where appropriate
- Do not continuously spin the ring during ordinary playback

### Distinguish buffering
Buffering must have its own visual language and must not be confused with normal playback.

### Reduced Motion
Simple crossfade + haptic.

---

## Reference 11 — Favorite Signal

### Accepted idea
Favorite should feel satisfying without becoming theatrical.

### WAVEN translation
- Unfavorited: silver outline heart
- Tap: slight compression + haptic
- Smooth fill into WAVEN blue
- Very small blue/silver ripple or 3–5-point signal burst
- Favorited: stable WAVEN-blue heart
- Remove favorite: softer reverse transition

### Avoid
- Rainbow confetti
- Large particle explosions
- Social-media-style celebration

### Performance
Effect can be simplified to an icon morph on lower-performance modes.

---

## 6. Internally designed WAVEN systems

The following areas intentionally do not depend on additional external references. They must be designed from the established WAVEN language for consistency.

## 6.1 Fallback artwork system

Status: **direction defined; exact visual system to be designed internally.**

Requirements:

- Never fabricate unrelated fake album covers.
- Real artwork always wins when available.
- One WAVEN-native family across:
  - Home
  - Search
  - Library
  - track rows
  - Mini Player
  - Full Player
  - notification metadata artwork
  - lock screen
  - playlist/album fallbacks
- Candidate grammar:
  - deep black base
  - silver spectral geometry
  - WAVEN-blue signal
  - deterministic variation
  - waveform fields
  - circular frequency contours
  - flowing sound fields
  - restrained V-derived geometry
- Different items may vary composition, but they must unmistakably belong to one family.

## 6.2 Track Actions / Bottom Sheets

Designed internally from WAVEN Glass.

Expected actions may include, where supported:

- Add to Queue
- Play Next
- Add to Playlist
- Go to Artist
- Go to Album
- Favorite / Remove Favorite
- Share
- Source
- Download later where Phase 11 permits
- Remove from relevant collection where appropriate

Rules:

- Sheet rises over the current context.
- Background remains spatially recognizable through restrained dim/blur.
- Clear action hierarchy.
- Consistent iconography.
- No page replacement for a simple action menu.
- Destructive actions are visually distinct but not visually loud.

## 6.3 Empty / Loading / Error / Offline states

### Empty
- Minimal copy
- One small WAVEN-native visual
- One useful next action when applicable
- Never dominate the page with a giant explanation card

### Loading
- Dark skeletons
- Restrained waveform/signal pulse where appropriate
- Avoid bright generic spinners as the primary visual language

### Error
- Concise explanation
- One useful recovery action
- WAVEN blue reserved for recovery/action state

### Offline
- A known product mode, not a catastrophe screen
- Calm signal/offline treatment
- Clearly show what remains available locally
- Phase 8 owns the real offline behavior

## 6.4 Settings / Profile

Designed internally from the established WAVEN system.

Rules:

- Quiet administrative personality
- No giant dominant gear treatment
- Same dark-glass, typography, spacing, iconography, and active-state language
- Settings should feel like WAVEN at rest
- Notification, playback, appearance, accessibility, cloud/account, downloads, and other future settings should be grouped semantically when their phases make them real

## 6.5 Responsive behavior

No external design reference is required.

Responsiveness is an implementation and physical-validation discipline.

Requirements:

- Compact Android phones
- Standard phones
- Large phones
- Unusual/tall aspect ratios
- Display scaling
- Large text
- Gesture navigation
- 3-button navigation
- Cutouts and safe areas
- Sensible foldable/tablet adaptation
- Portrait is primary; landscape must remain usable and unbroken where supported

The Galaxy S24 Ultra is a **physical validation device, not a layout template**.

---

## 7. Motion system

The permanent priority is:

> **Interaction motion > Spatial motion > Atmospheric motion**

### Interaction motion
- Press response
- Play/Pause morph
- Favorite signal
- Selection
- Toggle
- Haptic feedback
- Scrubbing response

### Spatial motion
- Mini Player → Full Player
- Player ↔ Lyrics
- Player ↔ Similar/Discovery
- Sheets
- Detail hero collapse
- Navigation active-pill motion
- Queue reordering

### Atmospheric motion
- Artwork-derived gradients
- Slow environmental movement
- Subtle background life
- Richer audio-reactive ideas only after bounded performance/battery validation

### Performance rule
If performance is constrained:

1. Reduce/remove atmosphere first.
2. Simplify secondary spatial effects second.
3. Preserve responsive interaction feedback and playback control.

### Reduced Motion
Reduced Motion is a first-class mode, not an afterthought.

Replace decorative morphs/parallax/particles with:

- fades
- direct state changes
- simpler transforms
- static backgrounds

---

## 8. WAVEN seek / progress language

The seek control should become a recognizable WAVEN signature.

### Base direction
- Waveform/wave geometry rather than a generic straight line where appropriate
- Played portion: WAVEN blue
- Remaining portion: silver/dim gray
- Smooth progress
- Scrubbing may expand/react around the finger
- Time position appears without clutter

### P5-safe behavior
The waveform can be a designed visual shape driven by playback position. It does not need audio analysis.

### Later richer behavior
Real audio-reactive waveform behavior is deferred until a later immersive-player phase and must pass performance, thermal, battery, and device validation.

### Full Player halo
Reference 01 supports a possible circular / halo-like seek treatment around artwork, reinterpreted as a digital sonic signal rather than a vinyl record.

---

## 9. Player hierarchy and continuity

Desired continuity:

**Track / content surface → Mini Player → Quick/Full Player → Lyrics / Queue / Similar Discovery → Full Player → Mini Player**

Important artwork should preserve identity across these transitions whenever practical.

### One playback owner
All P5 UI must integrate with the validated P4 Media3 owner.

Never create:

- second audio engine
- duplicate queue owner
- fake UI-only playback owner
- raw-stream persistence

---

## 10. Detail-family consistency

Album, Artist, and Playlist should be one **WAVEN Music Detail family**.

They share:

- atmosphere
- hero behavior
- title hierarchy
- action placement
- list grammar
- active-state treatment
- scrolling/collapse logic

They differ through content personality.

### Album
Release artwork + ordered track sequence.

### Artist
Portrait + Popular + releases + appearances + related artists.

### Playlist
Playlist cover + owner/collaborators + editable/reorderable collection where supported.

The goal is familiarity without making every detail page identical.

---

## 11. Current P5.1 physical-review findings

The first Expo Go shell review successfully exposed problems that must guide revision.

### Keep
- Centered WA[V]EN direction
- Deep near-black base
- White/silver hierarchy
- Three-primary-destination architecture
- Selective use of WAVEN blue

### Change
1. Home is too text-heavy.
2. **Where music lives.** must become proper **Where Music Lives**, with selective WAVEN-blue title emphasis.
3. The large gear and top-right curved blue treatment are too dominant.
4. The large Listening Space card feels explanatory/document-like rather than music-first.
5. Current fallback artwork still reads as a placeholder.
6. Recently Played empty-state card is too visually dominant.
7. Development Tools visibly break the product illusion and should not live on product Home.
8. Search and Library are structurally valid but too empty/static.
9. Bottom navigation feels generic and should evolve toward Reference 09.
10. The bright/white route-transition flash observed physically is a UX defect and must be removed.
11. The shell needs more depth and musical life without simply adding more blue.
12. Motion should preserve the dark environment continuously through navigation.

### Rule derived from the first physical review
Green code does not equal accepted UI.

The iteration loop remains:

> **implement → run → physically inspect → discuss → refine → lock the slice → continue**

### Revision 2 physical review — 2026-09-15

Revision 2 improved the design direction but did **not** earn acceptance or a commit. The physical Expo Go review established these additional facts:

#### Keep
- Floating dark-glass bottom navigation and expanded active destination.
- WAVEN blue title emphasis on **Music**, **Sound**, and **Library**.
- Revised deterministic fallback-art signal family.
- Cleaner Search and Library structure.

#### Repair before locking P5.1
1. Home content is clustered too high on tall phones while a large unused area remains below. First-run composition must deliberately use the available height instead of simply adding fake content.
2. The centered WAVEN wordmark and each page title need a clearer vertical pause between brand identity and page identity.
3. The white route flash still occurs even with stack animation disabled. A one-frame light substrate remains visible during route replacement, so the fix must protect the persistent root/navigation background instead of only changing transition timing.
4. Primary navigation should remain mounted outside individual Home/Search/Library page shells where practical so the bottom system behaves like one persistent object.
5. Home's large explanatory hero still feels too onboarding-like. Reduce prose and let artwork, actions, and music categories do more of the communication.
6. Recently Played should not lead with negative wording such as **Nothing here yet**. Empty history should remain quiet until real data exists.
7. Search's untouched state should feel intentional, not like developer scaffolding. The active category may be locally interactive while production provider search remains P6-owned.
8. Library's empty state should use the remaining canvas intentionally and offer one useful path back to discovery instead of sitting at the top of a large blank area.
9. The large gray gear visible in Expo Go captures is Expo Go development UI, not WAVEN product UI. It must not influence WAVEN layout decisions.

#### Revision 3 target
Revision 3 is a **composition + navigation-continuity pass**. It should preserve the good Revision 2 navigation/fallback direction, establish a persistent black root substrate, keep primary navigation outside individual page shells, improve vertical rhythm on tall phones, simplify Home copy, and make Search/Library empty states feel deliberately composed without inventing production music data.

### Revision 3A physical review — 2026-09-15

Revision 3A cleared TypeScript and the complete 64-test suite, then received another physical Expo Go review on the Galaxy S24 Ultra.

#### Physically confirmed
- The previous one-frame white/washed route flash is **gone** after establishing the persistent black root substrate.
- The persistent root-owned bottom navigation survives route changes and is the correct structural foundation.
- Search and Library empty-state composition is more intentional than Revision 2.
- The deterministic WAVEN fallback-art direction remains worth preserving.

#### Repair before locking P5.1
1. Upper-screen hierarchy still needs stronger breathing room.
2. On Home, **Where Music Lives** should no longer compete with WAVEN as a second display headline. Home should use a single brand lockup: centered **WA[V]EN** with a smaller **Where Music Lives** tagline beneath it, keeping **Music** in WAVEN blue.
3. Search and Library keep their functional page titles, but the wordmark-to-page-title pause should remain deliberate.
4. The current active bottom-navigation treatment exposes a raw rectangular-looking highlight in physical Expo Go captures. It must be replaced by one rounded, persistent selection surface.
5. The persistent selection surface should travel between Home, Search, and Library instead of destroying and recreating separate active backgrounds.
6. Active labels and icon color should transition with the selection surface. Reduced Motion should switch states without decorative travel.
7. Because the black navigation substrate is now physically proven, a restrained native dark fade between primary screens may be reintroduced and physically retested. The white-flash defect must remain closed.

#### Revision 4 target
Revision 4 is a **brand-lockup + navigation-motion pass**. It should establish the Home brand lockup, increase upper hierarchy breathing room, replace the rectangular active-tab treatment with one rounded animated WAVEN-blue selection pill, animate active labels/icons, and reintroduce a restrained screen fade while retaining the proven black root substrate.


### Revision 4 physical review — 2026-09-15

Revision 4 cleared TypeScript and the complete 64-test suite, then received physical Expo Go review on the Galaxy S24 Ultra.

#### Physically accepted direction
- The centered **WA[V]EN** + smaller **Where Music Lives** lockup is the accepted Home brand hierarchy.
- **Music** remains WAVEN blue inside the tagline.
- The rounded persistent bottom-navigation selection surface now travels between Home, Search, and Library and feels materially better than the previous raw rectangular active state.
- Active icon/label motion is directionally accepted.
- The restored dark primary-screen transition feels smooth.
- The previously fixed white/washed route flash **did not return**.
- The persistent black root substrate remains a locked requirement underneath future navigation motion.
- Search and Library remain valid empty-state foundations for the current phase.

#### Home population rule confirmed during physical review
The Revision 4 Home shown in Expo Go is a **first-run / zero-data shell**, not the final populated Home.

The current **Start Listening** surface must not become the permanent dominant Home card. Once WAVEN has meaningful real activity, it should retire or transform into a stronger live music surface. Real listening history, discovery, library state, artwork, and playback should progressively fill the Home canvas according to their owning phases and Reference 02.

Specifically:
1. A populated Home should feature a stronger artwork-led music surface near the top.
2. Recently Played becomes real artwork/history content when available.
3. Discovery/recommendation content must use real provider data, never placeholders presented as real music.
4. Your Music becomes real collection shortcuts as P7 and later phases provide state.
5. A real Mini Player will eventually sit above the persistent bottom navigation during playback.
6. The Home brand lockup remains visually important but should not crowd out real music once the page is populated.
7. The current sparse first-run layout must be allowed to evolve as real data arrives rather than being frozen as the permanent Home geometry.

#### Current P5.1 interpretation
Revision 4 validates the **design language, first-run shell, navigation substrate, and motion direction**. It does not claim that the current empty Home is the final content architecture for a populated WAVEN account.


---

## 12. Accessibility and interaction discipline

Every visual choice must survive actual interaction.

Requirements include:

- Android safe areas
- Predictable Back behavior
- TalkBack semantics
- Large-text resilience
- Readable contrast
- Comfortable touch targets
- Reduced Motion
- Haptics only where meaningful
- Keyboard-aware Search layout
- No important action hidden behind hover-only logic
- No animation that delays essential interaction
- No atmosphere effect allowed to make playback controls sluggish

---

## 13. Reference acceptance protocol

New references may still be considered if something exceptional appears naturally.

Do **not** resume broad reference hunting merely to fill boxes.

Before accepting any future reference, answer:

1. **What exact element do we like?**
2. **Where does it belong in WAVEN?**
3. **What must change to make it WAVEN-native?**
4. **Does WAVEN already have a rule for this?**
5. **Will it remain consistent across related surfaces?**
6. **Does it introduce a conflicting visual language?**

Never accept an entire external screen merely because it is attractive.

---

## 14. Consistency checklist for implementation

Before introducing or approving a new UI component, verify:

- Does it use WAVEN black/silver/blue semantics?
- Is blue reserved for identity/active/interactive meaning?
- Does artwork atmosphere remain subordinate to WAVEN interaction color?
- Does it use the same radius/spacing/typography system?
- Does it fit WAVEN Glass or intentionally avoid it?
- Is motion consistent with interaction > spatial > atmosphere?
- Does it support Reduced Motion?
- Does it adapt across screen sizes?
- Does it preserve accessibility?
- Does it reuse the same icon/action grammar?
- Does it avoid unnecessary explanatory copy?
- Does it show real music rather than decorative filler where data exists?
- Does it preserve musical-object continuity where practical?
- Does it respect the one-player owner?
- Does it belong to the correct phase rather than pulling future functionality forward?

If the answer to several of these is no, the component should be redesigned before it spreads.

---

## 15. Phase ownership reminders

This contract may describe future experiences without authorizing their implementation.

### Phase 5
Owns:
- design system
- navigation
- shell
- reusable surfaces
- startup/sign-in presentation
- responsive layout foundation
- accessibility
- reduced motion
- Mini Player shell
- motion foundation
- fallback-art system
- UI states

### Phase 6
Owns:
- production Search
- discovery
- detail-data/provider integration

### Phase 7
Owns:
- Library persistence
- favorites
- playlists
- history ownership

### Phase 8
Owns:
- real offline handling

### Phase 9
Owns:
- WAVEN music synchronization through Orion Cloud

### Phase 10
Owns:
- final immersive Full Player
- rich Lyrics experience
- artwork atmosphere
- richer Player ↔ Discovery treatment
- advanced audio-reactive experiences where validated

### Phase 11
Owns:
- downloads

### Phase 12
Owns:
- final release validation and signed distribution acceptance

---

## 16. Final design doctrine

WAVEN should feel alive without becoming noisy.

It should feel premium without pretending to be iOS.

It should use glass without becoming a glass showcase.

It should use WAVEN blue without painting everything blue.

It should use artwork atmosphere without surrendering brand identity.

It should transform musical objects instead of constantly replacing screens.

It should explain less and let music occupy more of the interface.

It should remain responsive on devices that are not the primary test phone.

It should remain usable when motion, atmosphere, or performance effects are reduced.

Most importantly:

> **WAVEN is not a collection of reference designs. Every reference is raw material. WAVEN is the finished language.**
