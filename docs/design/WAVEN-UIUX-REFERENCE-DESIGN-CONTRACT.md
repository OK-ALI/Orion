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
- **WAVEN blue:** life, identity, active-state accents, interaction emphasis
- **Artwork-derived colors:** temporary atmosphere only

Artwork color may tint the environment, especially around the player and detail heroes, but it must never replace WAVEN blue as the interaction accent. Active controls do not need blue-filled surfaces: the accepted P5.5A rule keeps primary/selected interaction fills WAVEN black and uses blue selectively for edges, icons, arrows, waveform/progress, focus, and identity.

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

### Provider identity presentation rule
- WAVEN product surfaces do not display upstream metadata-provider brand names.
- Internal provider IDs, health, transport, and implementation names remain infrastructure concerns rather than product identity.
- Search, Home/Discovery, detail surfaces, loading states, errors, result headers, and empty states use WAVEN-neutral language instead of upstream provider branding.
- A future provider or platform requirement for mandatory visible attribution must receive explicit product and architecture review before changing this rule.

### P6.3 Home / Discovery implementation contract — 2026-09-16
- Preserve the physically accepted Rev4F/Rev4H Home hierarchy and material language rather than redesigning Home around provider data.
- Keep the dominant first-run hero as an honest Search invitation until a later authorized owner can supply real active-session or listening-history content.
- Keep Recently Played truthfully empty until playback history ownership exists; P6.3 must not fabricate recent activity or enter Phase 7 persistence.
- Keep the existing Songs / Artists / Albums Explore shortcuts and append real provider-backed discovery beneath them. Explore destinations use purpose-built WAVEN semantic icons, not fallback media artwork: **Icons represent destinations and actions; artwork represents music entities.**
- Project dashboard content into WAVEN-neutral **Songs**, **Artists**, **Albums**, and **Playlists** groups when those entity types are actually present. Do not render upstream dashboard titles, attribution, provider names, or provider diagnostics on the product surface.
- Artist shelves must preserve provider semantics: only entities explicitly marked `MUSIC_PAGE_TYPE_ARTIST` may render as WAVEN Artists. A generic `UC*` channel browse identity by itself is not enough to classify an entity as an artist.
- Home discovery must preserve query intent. The generic `Top songs` whole-Home fallback is retired. WAVEN owns a stable core Songs / Artists / Albums / Playlists composition: real dashboard/catalog entities are preferred, and any missing core lane is backfilled only by a category-directed public discovery query whose results are filtered through the existing strict entity classifier. Exact catalog items may still vary with provider availability, but a VPN/IP-dependent dashboard omission must not by itself add or remove a core Home lane.
- Real dashboard playlist shelves are first-class P6.3 discovery input. A provider-curated `MUSIC_PAGE_TYPE_PLAYLIST` shelf counts as usable dashboard content and is projected into a WAVEN-neutral **Playlists** group; it must not be discarded merely because Songs/Artists/Albums are absent, which would incorrectly trigger the generic fallback.
- Use real remote artwork where available and the deterministic WAVEN fallback only when a real music entity lacks usable artwork or image loading fails. Do not use fallback artwork as a generic icon substitute for navigation categories or actions.
- Loading uses restrained dark skeleton treatment; empty/unavailable states stay concise; retry is a real 48dp action; partial availability is disclosed without exposing raw failure text.
- Discovery cards remain informational in P6.3. Artist/album detail navigation, pagination, caching, suggestions, and playback handoff remain separate later Phase 6 slices.
- P6.3 is fetch/UI-only, so Expo Go is a valid first physical evidence tier. It does not validate native Media3 playback behavior.

### Accepted atmosphere idea
Artwork colors may extend beyond artwork and tint the surrounding environment.

### WAVEN translation
- Dark glass search surface
- Selected filters use a WAVEN-black active surface with a restrained WAVEN-blue edge/accent
- Inactive filters remain silver/black glass
- Artwork-derived environmental glow sits behind relevant content
- WAVEN blue remains the interaction accent rather than becoming a large filled slab

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

### P5.2 implementation contract

The first implementation slice of Reference 05 must preserve these product rules:

- First launch may route through a WAVEN-owned entry surface after the fast native splash.
- The in-app handoff keeps the black canvas, centered **WA[V]EN** identity, blue-V emphasis, and one restrained WAVEN sound-signal visual.
- The first-run screen stays deliberately small: identity, one musical visual, one short welcome statement, and the two valid continuation choices.
- **Continue with Google** reuses the already-established Google identity bridge only.
- **Continue locally** is a first-class path. Local-only use remains supported while signed out or offline.
- Successful Google identity stores only WAVEN's local display/session snapshot needed for presentation and later account binding.
- P5.2 does not request Google Drive app-data authorization, read the PortableProfile, perform a controlled no-op write, create WAVEN music namespaces, or begin Cloud music synchronization.
- WAVEN Orion Cloud music synchronization remains P9.
- Expo Go may validate the supported JS/UI presentation and local continuation path; real native Google identity acceptance remains a development-build evidence tier.
- Repeat launches must not be forced through a long cinematic intro. Startup continuity may appear only for the time genuinely needed to resolve the local entry state.
- Reduced Motion simplifies entry motion to stable presentation rather than removing product identity or interaction feedback.
- Transition from entry into Home uses the same black navigation substrate so the experience feels continuous rather than like a separate authentication application.

### P5.2 Revision 1 physical review — 2026-09-15

The first physical Expo Go review confirmed that the entry architecture and brand foundation are sound, but the central musical visual and overall composition are not ready to lock.

#### Accepted from Revision 1
- The **WA[V]EN** + **Where Music Lives** brand treatment remains directionally correct.
- Black/silver/WAVEN-blue language is coherent.
- The entry page stays intentionally small rather than becoming a multi-page onboarding flow.
- Google identity and local-first continuation remain the correct two product choices.

#### Rejected / refine before acceptance
- The centered equalizer-style tile is too generic for WAVEN and reads like a conventional music-app icon rather than a recognizable WAVEN entry signature.
- The screen currently reads as four disconnected vertical islands: brand, generic visual, welcome copy, and authentication controls.
- The visual must connect the composition rather than merely occupy the center.
- The Google control is allowed to remain clear, but it should not visually own WAVEN's first impression.
- Architecture-heavy explanatory language should be reduced.

### P5.2 Revision 2 visual target

Revision 2 translates Reference 05 more literally through WAVEN's own grammar:

1. The blue **V** is treated as the conceptual source of the entry signal.
2. A restrained blue/silver **living sound field** replaces the enclosed equalizer tile.
3. The field uses V-derived geometry and drifting spectral ribbons rather than a fake album cover, waveform badge, planet, or orbital motif.
4. The visual remains unboxed so the black canvas becomes part of the composition.
5. Brand, sound field, welcome copy, and actions should feel like one continuous vertical experience.
6. Entry moments remain short and deliberate: identity settles, the sound field emerges, then welcome/actions arrive.
7. Reduced Motion collapses this to a stable presentation without losing hierarchy.
8. Product copy stays human and brief. The screen may state that Orion identity is optional and local use is available, but must not explain Cloud architecture.
9. Revision 2 remains an iterative physical-review target, not an accepted final entry design until viewed on the S24 Ultra.

### P5.2 Revision 2 physical review — 2026-09-15

Revision 2 improved motion quality materially, but the settled composition still does not communicate music clearly enough to lock.

#### Accepted from Revision 2
- The staged motion feels premium and should be preserved as the motion-quality baseline.
- The overall entry hierarchy and vertical balance improved over Revision 1.
- WA[V]EN, tagline, welcome copy, and the two continuation actions remain the correct structural ingredients.

#### Rejected / refine before acceptance
- The central blue dot, vertical stem, and angled arms read as a transmitter, antenna, or radar metaphor rather than a musical one.
- The faint charcoal oval around the lower ribbons is visible on the black canvas and reads as an unfinished container.
- The center visual still behaves like a separate object instead of atmosphere flowing through the whole entry composition.

### P5.2 Revision 3 visual target

Revision 3 keeps the premium motion timing while removing the wrong metaphor.

1. Remove the dot, vertical stem, V-arm/antenna geometry, and every visible enclosing oval or charcoal field edge.
2. Use only a small family of **free-flowing spectral ribbons** with no enclosing box, circle, badge, or device silhouette.
3. Ribbons should be asymmetric, blue/silver, softly luminous, and fade completely into the black canvas at both ends.
4. Movement should be slow drift and breathing, not beacon pulsing, scanning, or network-style signaling.
5. The strongest ribbon may carry a silver highlight through WAVEN blue so the abstraction still reads as sound energy.
6. A very faint origin mist may imply that the visual belongs to the WA[V]EN identity without drawing a literal connector line from the logo.
7. The visual should bridge the empty space between brand and welcome copy, not become another isolated object.
8. No raw charcoal container should remain visible on the settled screen.
9. Revision 3 remains a physical-review target and is not accepted until viewed on the S24 Ultra.

### P5.2 Revision 3 physical review — 2026-09-15

Revision 3 removed the radar/antenna metaphor and preserved the successful blue/silver palette, but the settled spectral ribbons still read as decorative geometry rather than music.

#### Accepted from Revision 3
- The WAVEN blue + silver combination on black is strongly preferred and should carry forward.
- The premium slow motion quality remains directionally correct.
- Removing the visible charcoal oval/container was correct.

#### Rejected / refine before acceptance
- Three detached spectral lines have insufficient musical meaning.
- The central visual still feels like abstract decoration rather than a recognizable music-state motif.
- The entry canvas needs more environmental depth without abandoning black as WAVEN's foundation.

### P5.2 Revision 4 visual target — Living Waveform + Atmospheric Black

Revision 4 gives the center visual an explicit musical meaning while preserving the strongest color and motion discoveries from prior revisions.

1. Replace free spectral ribbons with one **premium horizontal living music waveform** built from a dense series of rounded amplitude marks.
2. The waveform is not a cheap equalizer. It should read like an audio-track waveform: varied peaks and valleys around one center axis, with WAVEN blue flowing toward a restrained silver/white highlight near the musical center.
3. Animation is silent and long-running. Neighboring waveform regions breathe at different slow phases so the visual feels continuously alive without an obvious restart.
4. P5.2 must **not autoplay audible music** or seize audio focus on entry. The waveform provides the sensation of music before playback exists.
5. A future optional sonic logo may be considered separately, but it is not part of this P5.2 implementation.
6. Keep true black as the dominant canvas, then layer extremely restrained full-screen deep-navy/WAVEN-blue and cool-silver gradients through the musical middle of the screen.
7. Atmospheric gradients must have no visible circles, cards, boxes, or hard edges. They should read as softly blurred environmental light and collapse naturally back into black.
8. The brand area remains comparatively clean. Atmosphere becomes slightly richer around the waveform and fades again toward actions.
9. The current Google/local account behavior remains untouched. This revision is visual/motion refinement only.
10. Reduced Motion freezes the waveform into a stable premium audio shape while retaining the atmospheric hierarchy.
11. Revision 4 remains a physical-review target and is not accepted until viewed on the S24 Ultra.

### P5.2 Revision 4A clarification — WAVEN Atmospheric Canvas

A visual-reference clarification established that the intended background language is broader than the restrained Entry-only glow implemented in Revision 4.

The correct interpretation is a **shared WAVEN Atmospheric Canvas**:

- It is a design-system primitive, not an Entry-only decoration.
- True black remains the structural anchor and contrast foundation.
- Large, soft environmental sweeps of deep navy and WAVEN blue provide the dominant atmospheric light.
- A restrained cool-silver/white illumination counterbalances the blue in selected regions.
- Transitions must be broad and blurred in appearance, with no visible circles, cards, gradient boundaries, or isolated glow blobs.
- The composition should feel like light existing behind the interface rather than color painted onto a component.
- Primary WAVEN surfaces that use `WavenAppShell` inherit this atmospheric language automatically.
- Screen-specific intensity may vary, but Home, Search, Library, Entry, and later UI surfaces must remain recognizably part of the same atmospheric family.
- Root navigation substrate remains black so route transitions preserve the physically proven no-white-flash behavior.
- Glass, artwork, text, controls, and future player surfaces sit above the atmospheric canvas rather than replacing it.
- Entry uses the stronger atmospheric variant because it is an identity moment; denser/productivity-oriented surfaces may use quieter variants.
- The living waveform remains the P5.2 Entry musical visual target and stays silent.

This clarification expands the visual-system rule inside authorized Phase 5 only. It does not authorize provider, playback, P6, or Orion Cloud music-sync work.

### P5.2 Revision 4A physical review — 2026-09-15

Revision 4A materially improved the Entry experience. The living waveform finally reads as music and the shared WAVEN Atmospheric Canvas establishes the intended black/navy/blue/silver environmental language. The direction is accepted for refinement, not yet locked.

#### Keep
- Blue + silver living-waveform palette.
- Calm, long-running waveform motion.
- Shared Atmospheric Canvas as a global WAVEN primitive.
- Black as the structural anchor.
- Entry composition, Google/local hierarchy, and local-first behavior.

#### Revision 4B refinements
1. Remove the visible rectangular/raw strip behind the waveform. Waveform glow must belong to individual waveform marks and dissolve naturally with no container geometry.
2. Darken the Atmospheric Canvas substantially. Black should dominate while navy, WAVEN blue, and cool silver remain low-brightness environmental light.
3. Entry headline becomes **Your Sound, Your Way.** with **Your** in WAVEN silver and **Sound / Way** in WAVEN blue.
4. Expand the Entry waveform toward roughly the usable screen width rather than keeping a small centered object.
5. Replace the near-diamond waveform silhouette with a more irregular musical passage: clustered peaks, quiet valleys, asymmetric energy, and selective silver accents.
6. Strongly vignette the left and right waveform edges through per-mark opacity/taper so the waveform appears to continue into darkness rather than clip or overflow.
7. Preserve slow independent regional breathing so the waveform feels alive without an obvious animation restart.
8. On the Entry page only, move the centered **WA[V]EN / Where Music Lives** lockup down into the main experience and position it directly above the waveform. The top becomes intentional atmospheric breathing room.
9. Keep the current action hierarchy and account behavior unchanged.
10. Keep Entry silent. No autoplay audio or audio-focus acquisition is introduced.

Revision 4B remains a physical-review target. No P5.2 visual acceptance is claimed until the revised Entry and shared shell atmosphere are inspected on the physical Android device.

### P5.2 Revision 4B physical review — 2026-09-15

Revision 4B is the first Entry revision that reads as a coherent WAVEN identity moment rather than a collection of separate premium elements.

#### Physically accepted direction
- The darker Atmospheric Canvas now feels appropriately premium.
- The moved-down WA[V]EN lockup creates intentional top breathing room and visually belongs with the waveform.
- The raw waveform strip is gone.
- The blue/silver headline treatment is successful.
- The wider waveform, edge dissolution, and slower motion direction are successful.
- No account, Cloud, playback, or navigation behavior was changed by this visual refinement.

#### Revision 4C waveform-only refinement
1. Keep all Entry layout, typography, atmosphere, actions, and brand positioning from Revision 4B unchanged.
2. Expand the waveform to effectively the full usable width of the device while retaining a tiny safety inset.
3. Increase waveform height modestly so it becomes the hero visual without crowding the brand lockup or headline.
4. Use a denser, less symmetric musical passage with multiple energy clusters, quieter valleys, and taller peaks at different horizontal positions.
5. Distribute a small number of silver accents across the passage rather than centering them all around one focal point.
6. Add a third slow regional animation phase so adjacent areas breathe independently and the waveform feels like music evolving rather than one equalizer pulse.
7. Strengthen the per-mark edge vignette so the far-left and far-right waveform marks dissolve into darkness before any clipping can be perceived.
8. Keep waveform glow local to each mark and low-opacity. No shared glow rectangle or visible container may return.
9. Preserve Reduced Motion behavior.
10. Revision 4C is waveform-only. No Entry copy, Atmospheric Canvas, account behavior, playback, Cloud, provider, or navigation changes are authorized by this refinement.

If Revision 4C passes physical review, the Entry visual direction may be treated as ready for P5.2 interaction validation rather than further concept exploration.

### P5.2 Revision 4D physical-shell continuity — 2026-09-15

Physical local-continuation validation exposed one shell-level atmosphere seam: the shared Atmospheric Canvas ended at the primary route content boundary, while the persistent bottom-navigation region inherited only the black root substrate. This made the gradient appear to stop immediately above the floating navigation pill.

Revision 4D corrects the ownership boundary rather than painting a second gradient behind navigation:

1. The default `WavenAtmosphericCanvas` is owned once by primary root navigation so the same canvas sits behind both the route stack and persistent bottom navigation.
2. `WavenAppShell` becomes transparent and no longer creates its own duplicate atmospheric canvas.
3. Primary Stack content is transparent so Home, Search, and Library reveal the persistent root canvas.
4. Non-primary routes retain the black Stack substrate. Entry continues to own its stronger `entry` atmospheric variant, preventing double-stacking.
5. The root itself remains WAVEN black. Therefore the physically proven no-white-flash protection is preserved even if an atmospheric layer is absent during a route boundary.
6. The floating bottom-navigation pill remains transparent at its outer wrapper and visually floats over the same uninterrupted atmosphere as the page above it.
7. This is a visual shell-continuity repair only. It does not change navigation destinations, account/session behavior, playback, providers, or Orion Cloud behavior.

### P5.2 Revision 4E primary-page brand hierarchy — 2026-09-15

Physical validation confirmed that the local-first Entry session survives a real app relaunch: after choosing **Continue locally**, a subsequent fresh launch skips Entry and returns directly to Home without repeating sign-in or first-run presentation.

A final primary-page hierarchy refinement is also adopted:

1. **Home** keeps the centered **WA[V]EN / Where Music Lives** lockup because Home is the product's identity and re-entry surface.
2. **Search** does not repeat the WAVEN wordmark or tagline. Its own page title and search controls become the immediate hierarchy.
3. **Library** does not repeat the WAVEN wordmark or tagline. Its own page title, filters, and collection state become the immediate hierarchy.
4. The shared shell exposes brand visibility explicitly, while the existing Home `brandTagline` request continues to imply the full brand lockup.
5. Removing repeated branding from Search and Library is a density/hierarchy refinement only. Atmospheric Canvas, persistent bottom navigation, route behavior, session behavior, playback, providers, and Orion Cloud behavior remain unchanged.
6. Future primary pages should not automatically repeat the Home brand lockup. Brand repetition must be justified by the page's role rather than inherited by default.

### P5.2 Revision 4F Home translation of Reference 02 — 2026-09-15

Physical review identified that the P5.1 Home shell remained structurally clean but visually too utility-led compared with the accepted intent of **Reference 02 — Content Hierarchy + Library Density**.

Revision 4F therefore strengthens the Home translation without copying the white reference skin, its exact cards, or fabricated music:

1. Home keeps the centered **WA[V]EN / Where Music Lives** lockup as its identity header.
2. The first body surface becomes one dominant artwork-led music hero rather than a small utility row.
3. The hero uses WAVEN's deterministic fallback-art family and stacked/depth treatment. It does not invent album names, artists, listening history, recommendations, or provider data.
4. The hero remains an honest first-run invitation to explore music until later phases can supply real Continue Listening / Made For You / active-session data.
5. Recently Played remains visibly present but truthfully empty until real playback history exists.
6. An artwork-led **Explore** row exposes Songs, Artists, and Albums as category directions without pretending those category tiles are real releases.
7. **Your Music** remains a direct Library shortcut.
8. Once later phases provide real content, real artwork/history/discovery should replace first-run placeholders while preserving this hierarchy: dominant music surface → recent activity → discovery → library.
9. Home should feel curated, visual, music-first, and spacious without large dead zones or walls of identical glass cards.
10. This is a P5 presentation refinement only. It does not implement P6 discovery/provider behavior, P7 history/library persistence, fake recommendations, or Orion Cloud music synchronization.

If the physical Rev4F Home does not improve the product hierarchy, the accepted P5.1/Rev4E Home structure remains recoverable from the previous checkpoint boundary.

### P5.2 Revision 4G Home glass-atmosphere pass — 2026-09-15

Physical Rev4F review accepted the **overall Reference-02 Home hierarchy** but found its material treatment too opaque and slab-like. The hierarchy is therefore retained while its surfaces are translated more strongly through WAVEN Glass.

Revision 4G rules:

1. Keep the Rev4F structure unchanged: Home identity → dominant music hero → Recently Played → Explore → Your Music.
2. Make the hero a restrained translucent near-black glass surface so the shared WAVEN Atmospheric Canvas remains visually present through the composition.
3. Use a very low-opacity cool-silver edge/highlight and a restrained WAVEN-blue lower tint. No neon outline and no unrelated accent color.
4. Slightly reduce hero artwork and vertical density so more of the next section can enter the first viewport without demoting the hero.
5. Rear artwork-stack layers become lighter and more translucent so they read as floating acrylic/glass depth rather than three opaque cards.
6. Recently Played and Your Music use lighter translucent glass instead of dense black slabs.
7. Explore remains comparatively exposed and artwork-led rather than wrapping every tile in another glass container.
8. Do not add `BlurView`, `expo-blur`, platform backdrop filters, or a new dependency during this P5 refinement. The effect must remain compatible with the pinned Expo/RN baseline and rely on transparency, hierarchy, edge light, and the existing Atmospheric Canvas.
9. This pass changes material presentation only. It does not add real recommendations, history, provider content, Cloud activity, playback ownership, or P6/P7 behavior.
10. Physical review decides whether Rev4G becomes the accepted Home material language.

### P5.2 Revision 4H hero-glass polish — 2026-09-15

Physical Rev4G review accepted the Reference-02 hierarchy and the lighter WAVEN Glass direction, but exposed one material artifact: the hero's lower blue tint was visibly readable as a horizontal rectangular band behind the primary action.

Revision 4H makes a deliberately narrow polish:

1. Remove the hero-local rectangular blue tint layer completely.
2. Let the shared **WAVEN Atmospheric Canvas** provide environmental blue behind and through the hero instead of painting a second local rectangle.
3. Make the hero base slightly more transparent while retaining the restrained cool-silver top/edge highlight.
4. Preserve the Rev4G tighter hero geometry, stacked artwork treatment, Recently Played glass, Explore composition, Your Music glass, navigation, typography, and all interaction behavior.
5. No new blur implementation, dependency, Cloud behavior, provider behavior, playback behavior, or phase scope is introduced.
6. The intended result is continuous glass with no visible internal rectangular machinery.

### P5.2 Revision 4H physical checkpoint lock — 2026-09-15 (historical intermediate record)

The owner physically reviewed the current P5.2 presentation on a Samsung Galaxy S24 Ultra and accepts this visual/material boundary. This checkpoint locks the approved direction without claiming all of P5.2 complete.

#### Physically accepted / validated
- **Entry Revision 4C** is the accepted Entry visual direction: the near-full-width irregular blue/silver living waveform, moved-down WA[V]EN lockup, atmospheric black presentation, and current action hierarchy are approved.
- **Revision 4D** root atmosphere continuity is accepted: one shared Atmospheric Canvas continues behind primary content and floating bottom navigation, with the black root substrate retained as transition safety.
- **Continue locally** is physically validated. The local entry session persists across a full Expo Go/app relaunch, and the next launch skips Entry and returns directly to Home.
- Expo Go's Google action is physically validated to fail safely with the controlled message **“Google Sign-In is not configured for this build.”** This expected fallback does not crash or imply native identity acceptance.
- **Revision 4F** is the locked Home hierarchy: Home identity → dominant artwork-led music surface → Recently Played → Explore → Your Music.
- **Revision 4G** is the locked WAVEN Glass direction: restrained translucent near-black material, cool-silver edge light, selective glass, and the shared Atmospheric Canvas remaining visible through surfaces.
- **Revision 4H** is the locked hero-material polish: the visible horizontal blue tint band is removed, environmental blue comes from the shared Atmospheric Canvas, and the hero reads as one continuous glass surface.
- The current Home visual/material language is approved and should not be reopened for arbitrary micro-polish. Later functional integration may still justify a targeted UI repair if it exposes a real product issue.

#### Still pending before P5.2 completion
- Real Google identity/sign-in has **not** been physically accepted in a compatible native/development build. Expo Go fallback evidence cannot substitute for that native evidence tier.
- P5.2 therefore remains **IN PROGRESS**. Phase 5 has no Completion ACK, overall WAVEN v1 completion remains **38%**, and Phase 6 remains **NOT AUTHORIZED**.
- This checkpoint authorizes no Orion Cloud write, no Drive music work, no WAVEN music synchronization, no playback-owner change, and no later-phase implementation.

### P5.2 completion reconciliation — native identity accepted

The Rev4H checkpoint above is intentionally retained as historical evidence of the state at that moment. Its pending-native-identity note was later satisfied: the physical Samsung Galaxy S24 Ultra WAVEN native/development path completed the real Google chooser and returned into Home through the existing identity bridge. This does not promote that evidence into permanently signed distributed acceptance.

### P5.3 Mini Player design lock

The accepted compact player remains intentionally narrow in scope:

- artwork, title/artist, Play/Pause, and a read-only compact waveform/progress treatment;
- native Media3 remains the sole playback/queue owner;
- overflowing titles may use the accepted continuous forward-only marquee;
- Reduced Motion keeps the title static and suppresses nonessential player motion;
- direct waveform seeking, Previous/Next, Up Next, richer transport, Quick Player, and final Full Player behavior remain later-surface work.

### P5.4 accessibility/responsive lock

The Phase 5 shell must preserve the physically accepted accessibility and geometry behavior:

- real minimum touch targets for audited controls;
- large-text recovery rather than clipped/overlapping hierarchy;
- TalkBack semantics, selected-state announcement, and logical focus;
- Android Back history for user navigation;
- gesture and 3-button navigation safe areas;
- compact/standard/roomy/tablet-like responsive classes without treating the S24 Ultra as a fixed template;
- Reduced Motion-safe navigation, Entry, Mini Player, and marquee behavior.

### P5.5A product-language, transition, and interaction-material lock

Physical review accepted the following as the current WAVEN direction:

- normal product surfaces do not expose development/build/Expo/internal implementation vocabulary;
- Entry stays minimal and no longer repeats account-choice guidance already expressed by its actions;
- Entry → Home uses an atmospheric continuity handoff rather than an abrupt route snap;
- primary and selected interaction surfaces use WAVEN black;
- WAVEN blue remains selective and valuable through active icons, edges, arrows, waveform/progress, focus, and identity rather than coating entire controls;
- this material rule applies to the accepted Bottom Navigation selection pill, Search/Library selected filters, Home primary action, Library Find Music action, and Mini Player Play/Pause surface.

### P5.5B closure truthfulness rule

Before Phase 5 Completion ACK, shell-only states must remain visibly truthful about their current capability. In particular, the P5 Search shell may echo a typed search term but must not label that inert shell state as actively “SEARCHING” before Phase 6 owns real provider requests/results. All changed interactive controls must continue to honor the established 48dp touch-target and accessibility rules.

### Phase 5 completion lock — 2026-09-16

Phase 5 is accepted under `ACK-P05-2026-09-16` with final published closure checkpoint `68d55a57456ace75cd87ab6fdf702aec246409b5`.

The locked Phase 5 design boundary includes the black/silver/WAVEN-blue visual system, restrained WAVEN Glass, atmospheric continuity, Home/Search/Library primary shell, persistent compact Mini Player, coherent fallback artwork, real accessibility/touch-target rules, responsive layout classes, Reduced Motion behavior, product-safe language, the Entry → Home atmospheric handoff, WAVEN-black selected/interactive surfaces with blue retained as accent, and truthful shell-only Search presentation before provider work exists.

The final P5.5B gate passed TypeScript and `116/116` automated tests, and the changed Search presentation/touch geometry passed physical review on Samsung Galaxy S24 Ultra / Android 16. This completion lock does not authorize Phase 6 and does not claim permanently signed distributed acceptance.

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
