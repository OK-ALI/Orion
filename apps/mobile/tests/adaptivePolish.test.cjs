"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const mobileRoot = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(mobileRoot, relative), "utf8");

test("top-level utility pages use the shared editorial header", () => {
  for (const relative of [
    "src/features/discover/DiscoverScreen.tsx",
    "src/features/connect/ConnectScreen.tsx",
    "src/features/library/LibraryScreen.tsx",
    "app/(tabs)/downloads.tsx",
    "app/(tabs)/settings.tsx",
  ]) {
    assert.match(read(relative), /MobilePageHeader/);
  }
  const header = read("src/components/MobilePageHeader.tsx");
  assert.match(header, /paddingTop: isTablet \? insets\.top \+ 20 : isLandscape \? insets\.top \+ 12 : insets\.top \+ 64/);
  assert.match(header, /accessibilityRole="header"/);
});

test("Discover, Connect and their people surface consume live theme tokens", () => {
  const discover = read("src/features/discover/DiscoverScreen.tsx");
  const discoverStyles = read("src/features/discover/discoverStyles.ts");
  const connect = read("src/features/connect/ConnectScreen.tsx");
  const connectStyles = read("src/features/connect/connectStyles.ts");
  const person = read("src/components/PersonCard.tsx");
  assert.match(discover, /useOrionTheme/);
  assert.match(discoverStyles, /createDiscoverStyles.*MobileThemeTokens/);
  assert.match(connect, /useOrionTheme/);
  assert.match(connectStyles, /createConnectStyles.*MobileThemeTokens/);
  assert.match(person, /useOrionTheme/);
  assert.doesNotMatch(discover, /backgrounds\.base|accent\.primary|text\.muted/);
  assert.doesNotMatch(connect, /backgrounds\.base|accent\.primary/);
});

test("application confirmations use Orion dialogs instead of raw alerts", () => {
  const roots = ["app", "src"];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (/\.(?:ts|tsx)$/.test(entry.name)) {
        const source = fs.readFileSync(target, "utf8");
        assert.doesNotMatch(source, /Alert\.alert\s*\(|\balert\s*\(/, `Raw alert in ${target}`);
      }
    }
  };
  roots.forEach((root) => visit(path.join(mobileRoot, root)));
  assert.match(read("src/features/library/LibraryScreen.tsx"), /OrionDialog/);
  assert.match(read("src/features/connect/ConnectScreen.tsx"), /QR code not recognized/);
});

test("Library keeps explicit tabs and adds direction-locked finger paging", () => {
  const library = read("src/features/library/LibraryScreen.tsx");
  assert.match(library, /Gesture\.Pan\(\)/);
  assert.match(library, /activeOffsetX\(\[-24, 24\]\)/);
  assert.match(library, /failOffsetY\(\[-14, 14\]\)/);
  assert.match(library, /accessibilityRole="tab"/);
  assert.match(library, /preferences\.reducedMotion \? 0 : 210/);
});

test("offline status floats inside the safe area and compacts after four seconds", () => {
  const banner = read("src/components/OfflineBanner.tsx");
  const layout = read("app/_layout.tsx");
  assert.match(banner, /insets\.top \+ 8/);
  assert.match(banner, /setTimeout\(\(\) => setState\("compact"\), 4000\)/);
  assert.match(banner, /Offline — cached library data remains available/);
  assert.match(layout, /<OfflineBanner \/>/);
});

test("Home Continue Watching uses a compact capped rail presentation", () => {
  const card = read("src/features/library/ContinueWatchingCard.tsx");
  const home = read("src/features/library/HomeContinueWatching.tsx");
  const library = read("src/features/library/LibraryScreen.tsx");
  assert.match(card, /Math\.min\(330/);
  assert.match(card, /aspectRatio: 16 \/ 9/);
  assert.match(home, /presentation="home-rail"/);
  assert.match(library, /presentation="library-full"/);
  assert.match(card, /width: 44, height: 44/);
});


test("Phase 7 keeps the floating navigation trigger reachable without changing its visual footprint", () => {
  const trigger = read("src/components/FloatingSidebarTrigger.tsx");
  assert.match(trigger, /accessibilityRole="button"/);
  assert.match(trigger, /accessibilityLabel="Open navigation"/);
  assert.match(trigger, /hitSlop=\{4\}/);
  assert.match(trigger, /width: 40/);
  assert.match(trigger, /height: 40/);
});

test("Discover reserves the floating trigger lane only on phone landscape", () => {
  const discover = read("src/features/discover/DiscoverScreen.tsx");
  const header = read("src/components/MobilePageHeader.tsx");
  assert.match(discover, /reserveFloatingTriggerInLandscape/);
  assert.match(header, /reserveFloatingTriggerInLandscape && isLandscape && !isTablet \? 72 : horizontal/);
  assert.match(header, /paddingRight: horizontal/);
});


test("Phase 7 drawer keeps destinations grouped without expanding Connect functionality", () => {
  const drawer = read("src/components/SidebarDrawer.tsx");
  assert.match(drawer, /label: 'BROWSE'/);
  assert.match(drawer, /label: 'YOUR ORION'/);
  assert.match(drawer, /label: 'CONNECT'/);
  assert.match(drawer, /label: 'SYSTEM'/);
  assert.match(drawer, /name: 'Home'/);
  assert.match(drawer, /name: 'Discover & Search'/);
  assert.match(drawer, /name: 'Library'/);
  assert.match(drawer, /name: 'Downloads'/);
  assert.match(drawer, /name: 'Smart Remote'/);
  assert.match(drawer, /name: 'Settings'/);
  assert.match(drawer, /backgroundColor: theme\.accent, borderColor: theme\.accent, shadowColor: theme\.accent/);

  const navStart = drawer.indexOf("const NAV_SECTIONS = [");
  const navEnd = drawer.indexOf("] as const;", navStart);
  assert.ok(navStart >= 0 && navEnd > navStart, "SidebarDrawer NAV_SECTIONS declaration should remain present");

  const navDefinition = drawer.slice(navStart, navEnd + "] as const;".length);
  assert.doesNotMatch(navDefinition, /name: '(?:Account|Notifications|Updates|Privacy & Data)'/);
});

test("Phase 7 Settings uses a scalable active-only section architecture", () => {
  const settings = read("app/(tabs)/settings.tsx");
  const architecture = read("src/features/settings/settingsArchitecture.ts");

  for (const id of ["account", "appearance", "sync", "playback", "accessibility", "updates", "connect", "downloads"]) {
    assert.match(architecture, new RegExp(`id: '${id}'`));
  }
  assert.match(architecture, /id: 'account', label: 'Account', status: 'active'/);
  assert.match(architecture, /id: 'appearance', label: 'Appearance', status: 'active'/);
  assert.match(architecture, /id: 'accessibility', label: 'Accessibility', status: 'active'/);
  for (const id of ["sync", "playback", "updates", "connect", "downloads"]) {
    assert.match(architecture, new RegExp(`id: '${id}', label: '[^']+', status: 'reserved'`));
  }

  assert.match(settings, /MOBILE_SETTINGS_SECTION_BY_ID\.account/);
  assert.match(settings, /<AccountSettingsContent \/>/);
  assert.match(settings, /MOBILE_SETTINGS_SECTION_BY_ID\.appearance/);
  assert.match(settings, /MOBILE_SETTINGS_SECTION_BY_ID\.accessibility/);
  assert.match(settings, /Follow system appearance/);
  assert.match(settings, /Reduced motion/);
  assert.match(settings, /Additional settings stay hidden until their Mobile features are ready\./);
  assert.doesNotMatch(settings, /Google sign-in and cross-device sync are intentionally scheduled/);
  assert.doesNotMatch(settings, /Account settings|Sync settings|Playback settings|Update settings|Connect settings|Download settings/);
});


test("Phase 7 theme descriptions and Custom accent derive one live semantic accent family", () => {
  const settings = read("app/(tabs)/settings.tsx");
  const themeContext = read("src/context/ThemeContext.tsx");

  for (const description of [
    "Orion's cinematic dark signature.",
    "Pure black tuned for OLED displays.",
    "Warm cinema tones with softer contrast.",
    "Cool blue-gray tones for a calmer screen.",
    "A bright projector-inspired light theme.",
    "Your accent on Orion's dark canvas.",
  ]) {
    assert.match(settings, new RegExp(description.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(settings, /accessibilityHint=\{THEME_DESCRIPTIONS\[id\]\}/);
  assert.match(settings, /id === "custom" && preferences\.customAccent/);
  assert.match(settings, /backgroundColor: previewAccent/);
  assert.match(themeContext, /accentSoft: accentSoft\(accent\)/);
  assert.match(themeContext, /onAccent: onAccent\(accent\)/);
  assert.match(themeContext, /const customAccent = value === null \? null : normalizeAccent\(value\)/);
  assert.doesNotMatch(themeContext, /return \{ \.\.\.base, accent: preferences\.customAccent \}/);
});

test("Phase 7 watched UX completes movie, episode and season controls without merging library namespaces", () => {
  const detail = read("src/features/media-detail/MediaDetailScreen.tsx");
  const controls = read("src/features/media-detail/WatchedControls.tsx");
  const watchedHook = read("src/features/media-detail/useMediaDetailWatched.ts");
  const watchedState = read("src/features/library/watchedState.ts");
  const libraryContext = read("src/context/LibraryContext.tsx");
  const undoBanner = read("src/components/WatchedUndoBanner.tsx");

  assert.match(detail, /<SeasonWatchedControl/);
  assert.match(detail, /watchedActions\.isEpisodeWatched/);
  assert.match(detail, /<EpisodeWatchedButton/);
  assert.match(detail, /watchedActions\.movieWatched/);
  assert.match(detail, /<WatchedFeedback/);
  assert.match(controls, /Mark Season \$\{season\} Watched/);
  assert.match(controls, /<OrionDialog/);
  assert.match(controls, /History, playback progress and My List stay unchanged/);
  assert.match(controls, /<WatchedUndoBanner/);

  assert.match(watchedHook, /toggleMovieWatched/);
  assert.match(watchedHook, /toggleEpisodeWatched/);
  assert.match(watchedHook, /requestSeasonToggle/);
  assert.match(watchedHook, /previouslyWatched/);
  assert.match(watchedHook, /showUndo/);
  assert.doesNotMatch(watchedHook, /removeProgress|clearHistory|toggleSave/);

  assert.match(libraryContext, /markSeasonWatched/);
  assert.match(libraryContext, /markSeasonUnwatched/);
  assert.match(libraryContext, /isSeasonWatched/);
  assert.match(watchedState, /tv_\$\{seriesId\}_episode_\$\{episodeId\}/);
  assert.match(watchedState, /record\.series_id \?\? record\.seriesId/);
  assert.match(undoBanner, /accessibilityLiveRegion="polite"/);
  assert.match(undoBanner, /Undo watched change/);
});



test("Phase 7 watched confirmation keeps copy scroll-safe above landscape actions", () => {
  const dialog = read("src/components/OrionDialog.tsx");

  assert.match(dialog, /scroll: \{ flexGrow: 0, flexShrink: 1, minHeight: 0 \}/);
  assert.match(dialog, /maxHeight: '86%'/);
  assert.match(dialog, /height < 520/);
  assert.match(dialog, /actionsStacked/);
});

test("Phase 7 My List derives All, Unwatched and Watched views without new persisted collections", () => {
  const library = read("src/features/library/LibraryScreen.tsx");
  const watchedState = read("src/features/library/watchedState.ts");
  const context = read("src/context/LibraryContext.tsx");

  assert.match(library, /id: 'all', label: 'All'/);
  assert.match(library, /id: 'unwatched', label: 'Unwatched'/);
  assert.match(library, /id: 'watched', label: 'Watched'/);
  assert.match(library, /savedItemWatchState\(watched, item\)/);
  assert.match(library, /data=\{filteredSavedItems\}/);
  assert.match(library, /accessibilityHint=\{`Shows \$\{filter\.label\.toLowerCase\(\)\} titles in My List`\}/);
  assert.match(library, /No watched titles in My List yet/);
  assert.match(library, /Nothing left in Unwatched/);

  assert.match(watchedState, /export function isSavedItemFullyWatched/);
  assert.match(watchedState, /next_episode_to_air/);
  assert.match(watchedState, /last_episode_to_air/);
  assert.match(watchedState, /season_number/);
  assert.doesNotMatch(context, /myListWatched|myListUnwatched|savedWatched|savedUnwatched/);
});


test("Phase 7 watched artwork tick follows shared watched truth across MediaCard surfaces", () => {
  const library = read("src/features/library/LibraryScreen.tsx");
  const card = read("src/components/MediaCard.tsx");
  const context = read("src/context/LibraryContext.tsx");
  const watchedHook = read("src/features/media-detail/useMediaDetailWatched.ts");
  const watchedState = read("src/features/library/watchedState.ts");

  assert.match(library, /watchedSavedKeys/);
  assert.match(library, /watched=\{watchedSavedKeys\.has\(savedItemKey\(item\)\)\}/);
  assert.match(card, /watched\?: boolean/);
  assert.match(card, /isItemFullyWatched/);
  assert.match(card, /const itemWatched = watched \?\? isItemFullyWatched\(item\)/);
  assert.match(card, /\{itemWatched && \(/);
  assert.match(card, /name="checkmark"/);
  assert.match(card, /color=\{theme\.success\}/);
  assert.match(card, /bottom: 8/);
  assert.match(context, /reconcileSeriesWatched/);
  assert.match(context, /isItemFullyWatched/);
  assert.match(watchedHook, /reconcileSeriesWatched\(data\)/);
  assert.match(watchedState, /is_series_summary/);
  assert.match(watchedState, /derived_from_episodes/);
  assert.match(watchedState, /valid_until/);
  assert.doesNotMatch(card, /markMovieWatched|markSeasonWatched/);
});

test("Phase 7 global Search shortcut is reachable everywhere except playback and hands focus to Discover", () => {
  const root = read("app/_layout.tsx");
  const shortcut = read("src/components/GlobalSearchShortcut.tsx");
  const discover = read("src/features/discover/DiscoverScreen.tsx");

  assert.match(root, /<GlobalSearchShortcut \/>/);
  assert.match(shortcut, /accessibilityLabel="Search Orion"/);
  assert.match(shortcut, /accessibilityHint="Opens Discover and focuses search"/);
  assert.match(shortcut, /pathname\.startsWith\('\/player'\)/);
  assert.match(shortcut, /keyboardDidShow/);
  assert.match(shortcut, /preferences\.reducedMotion/);
  assert.match(shortcut, /pathname: '\/discover', params: \{ focusSearch: request \}/);
  assert.match(shortcut, /router\.setParams\(\{ focusSearch: request \}\)/);
  assert.match(discover, /useLocalSearchParams<\{ focusSearch\?: string \}>/);
  assert.match(discover, /searchInputRef\.current\?\.focus\(\)/);
  assert.match(discover, /router\.setParams\(\{ focusSearch: '0' \}\)/);
  assert.match(discover, /accessibilityLabel="Search Orion"/);
  assert.match(discover, /duration: 190/);
});

test("Phase 7.7.1b keeps global Search behavior and blur glass without a hard highlight line", () => {
  const shortcut = read("src/components/GlobalSearchShortcut.tsx");

  assert.match(shortcut, /import \{ BlurView \} from 'expo-blur'/);
  assert.match(shortcut, /<BlurView/);
  assert.match(shortcut, /intensity=\{78\}/);
  assert.match(shortcut, /tint=\{theme\.dark \? 'dark' : 'light'\}/);
  assert.match(shortcut, /styles\.glassInner/);
  assert.match(shortcut, /styles\.glassWash/);
  assert.doesNotMatch(shortcut, /glassHighlight/);
  assert.match(shortcut, /color=\{theme\.accent\}/);
  assert.doesNotMatch(shortcut, /backgroundColor: theme\.elevated/);
  assert.match(shortcut, /width: 46/);
  assert.match(shortcut, /height: 46/);
  assert.match(shortcut, /pathname\.startsWith\('\/player'\)/);
  assert.match(shortcut, /accessibilityLabel="Search Orion"/);
});

test("Phase 7 ordinary browsing surfaces expose meaningful roles, state and screen-reader actions", () => {
  const card = read("src/components/MediaCard.tsx");
  const drawer = read("src/components/SidebarDrawer.tsx");
  const library = read("src/features/library/LibraryScreen.tsx");
  const settings = read("app/(tabs)/settings.tsx");
  const detail = read("src/features/media-detail/MediaDetailScreen.tsx");
  const watchedControls = read("src/features/media-detail/WatchedControls.tsx");

  assert.match(card, /accessibilityLabel=\{accessibilitySummary\}/);
  assert.match(card, /accessibilityActions=\{/);
  assert.match(card, /actionName === 'longpress'/);
  assert.match(drawer, /accessibilityViewIsModal=\{!persistent\}/);
  assert.match(drawer, /accessibilityHint="Closes the Orion navigation drawer"/);
  assert.match(library, /AccessibilityInfo\.announceForAccessibility/);
  assert.match(library, /accessibilityLabel=\{`\$\{tab\.label\}, \$\{counts\[tab\.id\]\} items`\}/);
  assert.match(settings, /accessibilityRole="switch"/);
  assert.match(settings, /accessibilityState=\{\{ checked: preferences\.reducedMotion \}\}/);
  assert.match(detail, /accessibilityLabel="Go back"/);
  assert.match(detail, /accessibilityRole="tab"/);
  assert.match(detail, /accessibilityLabel=\{`Episode \$\{ep\.episode_number\}, \$\{ep\.name\}/);
  assert.match(watchedControls, /accessibilityState=\{\{ selected: watched \}\}/);
});

test("Phase 7 high-frequency browsing controls keep at least a 44 dp reachable target", () => {
  const shortcut = read("src/components/GlobalSearchShortcut.tsx");
  const discoverStyles = read("src/features/discover/discoverStyles.ts");
  const detailStyles = read("src/features/media-detail/mediaDetailStyles.ts");

  assert.match(shortcut, /width: 46/);
  assert.match(shortcut, /height: 46/);
  for (const style of ["filterPill", "typePill", "regionPill", "subfilterPill", "backPill", "dropdownPill", "loadMoreButton", "modalOption"]) {
    assert.match(discoverStyles, new RegExp(`${style}: \\{[\\s\\S]*?minHeight: 44`));
  }
  assert.match(discoverStyles, /modalCloseBtn: \{[\s\S]*?width: 44,[\s\S]*?height: 44/);
  assert.match(detailStyles, /tabPill: \{[\s\S]*?minHeight: 44/);
  assert.match(detailStyles, /seasonPill: \{[\s\S]*?minHeight: 44/);
});


test("Phase 7.8.1 bounds Hero work to the visible active Home route", () => {
  const hero = read("src/components/HeroBillboard.tsx");

  assert.match(hero, /usePathname/);
  assert.match(hero, /AppState\.addEventListener\('change', setAppState\)/);
  assert.match(hero, /pathname === '\/' \|\| pathname === '\/index'/);
  assert.match(hero, /preferences\.reducedMotion \|\| !heroActive/);
  assert.match(hero, /initialNumToRender=\{3\}/);
  assert.match(hero, /maxToRenderPerBatch=\{3\}/);
  assert.match(hero, /windowSize=\{5\}/);
});


test("Phase 7.8.2 defers TV episode catalog work until Episodes is actually opened", () => {
  const detail = read("src/features/media-detail/MediaDetailScreen.tsx");

  assert.match(detail, /activeTab !== 'episodes'/);
  assert.match(detail, /if \(isMovie \|\| activeTab !== 'episodes' \|\| !selectedSeason\) return/);
  assert.match(detail, /tmdbFetch<any>\(`\/tv\/\$\{id\}\/season\/\$\{selectedSeason\}`\)/);
  assert.match(detail, /if \(!cancelled\) setEpisodes\(res\.episodes \|\| \[\]\)/);
  assert.match(detail, /return \(\) => \{ cancelled = true; \}/);
  assert.match(detail, /\[activeTab, id, isMovie, selectedSeason\]/);
  const watchedHook = read("src/features/media-detail/useMediaDetailWatched.ts");
  assert.match(watchedHook, /reconcileSeriesWatched\(data\)/);
});

test("Phase 7.8.3 keeps catalog ordering while removing repeated scans and compacts long person biographies", () => {
  const discover = read("src/features/discover/DiscoverScreen.tsx");
  const person = read("app/person/[id].tsx");

  assert.match(discover, /const existingKeys = new Set\(/);
  assert.match(discover, /prev\.map\(\(item: any\) => `\$\{item\.media_type\}_\$\{item\.id\}`\)/);
  assert.match(discover, /if \(existingKeys\.has\(key\)\) return false/);
  assert.doesNotMatch(discover, /merged\.filter\(\(item\) => !prev\.some/);

  assert.match(person, /const uniqueCredits = useMemo\(\(\) => \{/);
  assert.match(person, /const seenIds = new Set<string>\(\)/);
  assert.match(person, /if \(seenIds\.has\(key\)\) continue/);
  assert.match(person, /return unique\.sort\(/);
  assert.doesNotMatch(person, /acc\.find\(item => item\.id === current\.id\)/);
  assert.ok(person.indexOf("const uniqueCredits = useMemo") < person.indexOf("if (loading)"));

  assert.match(person, /const BIO_PREVIEW_LINES = 6/);
  assert.match(person, /numberOfLines=\{bioExpanded \? undefined : BIO_PREVIEW_LINES\}/);
  assert.match(person, /onTextLayout=\{\(event\) => measureBiography\(event\.nativeEvent\.lines\.length\)\}/);
  assert.match(person, /LayoutAnimation\.configureNext\(LayoutAnimation\.Presets\.easeInEaseOut\)/);
  assert.match(person, /setLayoutAnimationEnabledExperimental\?\.\(true\)/);
  assert.match(person, /if \(!preferences\.reducedMotion\)/);
  assert.match(person, /accessibilityState=\{\{ expanded: bioExpanded \}\}/);
  assert.match(person, /bioToggle: \{[\s\S]*?minHeight: 44/);
  assert.match(person, /\{bioExpanded \? 'Show less' : 'Show more'\}/);
});


test("Phase 7.8.4 isolates browsing visuals and player persistence actions from unrelated library churn", () => {
  const context = read("src/context/LibraryContext.tsx");
  const card = read("src/components/MediaCard.tsx");
  const hero = read("src/components/HeroBillboard.tsx");
  const detail = read("src/features/media-detail/MediaDetailScreen.tsx");
  const watchedHook = read("src/features/media-detail/useMediaDetailWatched.ts");
  const player = read("src/features/playback/PlayerScreen.tsx");
  const embedded = read("src/features/playback/EmbedPlayerSurface.tsx");
  const native = read("src/features/playback/NativePlayerSurface.tsx");

  assert.match(context, /const LibraryVisualContext = createContext<LibraryVisualContextType \| null>\(null\)/);
  assert.match(context, /const LibraryPlaybackActionsContext = createContext<LibraryPlaybackActionsContextType \| null>\(null\)/);
  assert.match(context, /const visualValue = useMemo<LibraryVisualContextType>/);
  assert.match(context, /const playbackActionsValue = useMemo<LibraryPlaybackActionsContextType>/);

  const visualBlock = context.slice(context.indexOf("const visualValue"), context.indexOf("// Player surfaces"));
  assert.match(visualBlock, /saved,/);
  assert.match(visualBlock, /watched,/);
  assert.doesNotMatch(visualBlock, /\bhistory\b|\bprogress\b|recordPlayback|getPlaybackProgress/);

  const playbackActionsBlock = context.slice(context.indexOf("const playbackActionsValue"), context.indexOf("const value ="));
  assert.match(playbackActionsBlock, /recordPlayback/);
  assert.match(playbackActionsBlock, /getPlaybackProgress/);
  assert.doesNotMatch(playbackActionsBlock, /\bsaved\b|\bwatched\b|\bhistory\b|\bprogress\b/);

  for (const source of [card, hero, detail, watchedHook]) {
    assert.match(source, /useLibraryVisual/);
    assert.doesNotMatch(source, /\buseLibrary\(\)/);
  }
  for (const source of [player, embedded, native]) {
    assert.match(source, /useLibraryPlaybackActions/);
    assert.doesNotMatch(source, /\buseLibrary\(\)/);
  }

  assert.match(context, /export function useLibrary\(\)/);
  assert.match(context, /export function useLibraryVisual\(\)/);
  assert.match(context, /export function useLibraryPlaybackActions\(\)/);
});

test("Phase 7.8.5 budgets image-heavy browsing lists without changing catalog truth or artwork quality", () => {
  const policy = read("src/services/listPerformance.ts");
  const home = read("app/(tabs)/index.tsx");
  const discover = read("src/features/discover/DiscoverScreen.tsx");
  const library = read("src/features/library/LibraryScreen.tsx");
  const continueRail = read("src/features/library/HomeContinueWatching.tsx");
  const person = read("app/person/[id].tsx");
  const detail = read("src/features/media-detail/MediaDetailScreen.tsx");
  const card = read("src/components/MediaCard.tsx");
  const hero = read("src/components/HeroBillboard.tsx");

  const profiles = read("src/services/performanceProfiles.ts");
  assert.match(policy, /getGridRenderBudget/);
  assert.match(policy, /safeColumns \* tuning\.gridInitialRows/);
  assert.match(policy, /safeColumns \* tuning\.gridBatchRows/);
  assert.match(policy, /getRailRenderBudget/);
  assert.match(policy, /Math\.ceil\(safeWidth \/ safeSpan\)/);
  assert.match(policy, /getStackListRenderBudget/);
  assert.match(profiles, /balanced: \{[\s\S]*gridInitialRows: 3,[\s\S]*gridBatchRows: 2,[\s\S]*gridWindowSize: 7/);
  assert.match(profiles, /balanced: \{[\s\S]*stackInitialItems: 5,[\s\S]*stackBatchItems: 5,[\s\S]*stackWindowSize: 7/);

  assert.match(home, /getRailRenderBudget/);
  assert.match(home, /initialNumToRender=\{renderBudget\.initialNumToRender\}/);
  assert.match(continueRail, /getRailRenderBudget/);
  assert.match(discover, /data=\{filteredSearchResults\}/);
  assert.match(discover, /initialNumToRender=\{gridRenderBudget\.initialNumToRender\}/);
  assert.match(library, /initialNumToRender=\{savedGridRenderBudget\.initialNumToRender\}/);
  assert.match(library, /stackListRenderBudget\.initialNumToRender/);
  assert.match(person, /initialNumToRender=\{filmographyRenderBudget\.initialNumToRender\}/);

  assert.match(detail, /data=\{topCast\}/);
  assert.match(detail, /data=\{fullCast\}/);
  assert.match(detail, /data=\{recommendedItems\}/);
  assert.doesNotMatch(detail, /castList\.slice\(0, 25\)\.map/);

  // 7.8.5 changes how many image-heavy cells are mounted, not their catalog
  // identity, order, source resolution, or the accepted high-quality hero/detail art.
  assert.match(card, /imgUrl\(item\.poster_path, 'w500'\)/);
  assert.match(hero, /imgUrl\(item\.backdrop_path, 'original'\)/);
  assert.match(detail, /imgUrl\(data\.backdrop_path, 'original'\)/);
});


test("Phase 7.9.1 adds real automatic/manual performance profiles and a registry-driven Settings section navigator", () => {
  const layout = read("app/_layout.tsx");
  const settings = read("app/(tabs)/settings.tsx");
  const architecture = read("src/features/settings/settingsArchitecture.ts");
  const navigator = read("src/features/settings/SettingsSectionNavigator.tsx");
  const context = read("src/context/PerformanceContext.tsx");
  const profiles = read("src/services/performanceProfiles.ts");
  const listPolicy = read("src/services/listPerformance.ts");
  const packageJson = read("package.json");

  assert.match(packageJson, /"expo-device": "~57\.0\.1"/);
  assert.match(layout, /<PerformanceProvider>/);
  assert.match(architecture, /id: 'performance', label: 'Performance', status: 'active'/);
  assert.match(architecture, /MOBILE_ACTIVE_SETTINGS_SECTIONS/);

  assert.match(context, /mobilePerformancePreferencesV1/);
  assert.match(context, /selection: 'automatic'/);
  assert.match(context, /Device\.totalMemory/);
  assert.match(context, /Device\.deviceYearClass/);
  assert.match(context, /resolveAutomaticPerformanceProfile/);
  assert.match(profiles, /id: 'efficiency'/);
  assert.match(profiles, /id: 'balanced'/);
  assert.match(profiles, /id: 'quality'/);
  assert.match(profiles, /return 'balanced'/);

  assert.match(settings, /SettingsSectionNavigator/);
  assert.match(settings, /sections=\{MOBILE_ACTIVE_SETTINGS_SECTIONS\}/);
  assert.match(settings, /sectionId="performance"/);
  assert.match(settings, /Automatic \(Recommended\)/);
  assert.match(settings, /Active profile/);
  assert.match(settings, /Profiles currently tune browsing render budgets/);
  assert.match(navigator, /Jump to section/);
  assert.match(navigator, /accessibilityRole="radio"/);
  assert.match(navigator, /onSelect\(section\.id\)/);

  assert.match(listPolicy, /PERFORMANCE_RENDER_TUNING\[profile\]/);
  for (const relative of [
    "app/(tabs)/index.tsx",
    "app/person/[id].tsx",
    "src/features/discover/DiscoverScreen.tsx",
    "src/features/library/HomeContinueWatching.tsx",
    "src/features/library/LibraryScreen.tsx",
    "src/features/media-detail/MediaDetailScreen.tsx",
  ]) {
    const source = read(relative);
    assert.match(source, /usePerformanceProfile/);
    assert.match(source, /resolvedProfile/);
  }
});


test("Phase 7.9.1b keeps Automatic stable on total RAM and tolerates reserved-memory headroom", () => {
  const profiles = read("src/services/performanceProfiles.ts");

  assert.match(profiles, /Device\.totalMemory/);
  assert.match(profiles, /not currently-free RAM/);
  assert.match(profiles, /if \(memory !== null\) \{/);
  assert.match(profiles, /if \(memory < 4 \* GIB\) \{[\s\S]*return 'efficiency'/);
  assert.match(profiles, /if \(memory >= 7 \* GIB\) \{[\s\S]*return 'quality'/);
  assert.doesNotMatch(profiles, /memory >= 8 \* GIB/);
  assert.doesNotMatch(profiles, /memory >= 6 \* GIB &&/);
  assert.match(profiles, /With no RAM signal, year-class remains a conservative fallback only/);
});

test("Phase 7.10.1 gives Media Detail a cleaner hierarchy and episode progress without duplicating watched state", () => {
  const detail = read("src/features/media-detail/MediaDetailScreen.tsx");
  const watched = read("src/features/media-detail/WatchedControls.tsx");
  const styles = read("src/features/media-detail/mediaDetailStyles.ts");

  // Header/actions become a deliberate vertical hierarchy instead of a staggered
  // two-column wrap, while preserving every accepted action.
  assert.match(detail, /styles\.actionStack/);
  assert.match(detail, /styles\.secondaryActionRow/);
  assert.match(styles, /actionStack: \{ width: '100%', gap: spacing\[2\], marginTop: spacing\[3\] \}/);
  assert.match(styles, /headerMeta: \{[\s\S]*?minHeight: 155,[\s\S]*?justifyContent: 'center'/);
  assert.match(detail, /numberOfLines=\{2\}>\{genres\}/);

  // One watched presentation per scope: season has one control and episode has
  // one toggle. The old duplicate badges are no longer rendered on the card.
  assert.doesNotMatch(watched, />All episodes</);
  assert.doesNotMatch(detail, /<EpisodeWatchedBadge/);
  assert.match(watched, /movieWatchedStatus/);
  assert.match(detail, /<EpisodeWatchedButton/);

  // Episode progress reads the already-verified playback record through the
  // stable actions lane, refreshes on screen focus, and never competes with a
  // manually watched state.
  assert.match(detail, /useLibraryPlaybackActions/);
  assert.match(detail, /useFocusEffect/);
  assert.match(detail, /getPlaybackProgress\('tv', id, selectedSeason, ep\.episode_number\)/);
  assert.match(detail, /!episodeWatched[\s\S]*?isVerifiedPlaybackEvidence\(episodeProgress\.evidence\)/);
  assert.match(detail, /styles\.episodeProgressTrack/);
  assert.match(detail, /styles\.episodeProgressFill/);
  assert.match(styles, /episodeProgressTrack: \{[\s\S]*?height: 3/);
});


test("Phase 7.10.3 keeps episode cards composed while preserving the complete overview behind Show more", () => {
  const detail = read("src/features/media-detail/MediaDetailScreen.tsx");
  const watched = read("src/features/media-detail/WatchedControls.tsx");
  const styles = read("src/features/media-detail/mediaDetailStyles.ts");

  // Collapsed cards stay concise, but the source overview is always rendered
  // intact. Expansion only changes line clamping and never substitutes text.
  assert.match(detail, /function EpisodeOverview\(/);
  assert.match(detail, /numberOfLines=\{expanded \? undefined : 2\}/);
  assert.match(detail, /\{overview\}/);
  assert.match(detail, /\{expanded \? 'Show less' : 'Show more'\}/);
  assert.match(detail, /setExpanded\(\(value\) => !value\)/);
  assert.doesNotMatch(detail, /overview\.slice\(|overview\.substring\(|overview\.substr\(/);

  // Overflow is measured from real rendered lines instead of guessed from a
  // character count, and the measuring copy is hidden from accessibility.
  assert.match(detail, /onTextLayout=\{handleMeasure\}/);
  assert.match(detail, /event\.nativeEvent\.lines\.length > 2/);
  assert.match(detail, /importantForAccessibility="no-hide-descendants"/);
  assert.match(styles, /episodeOverviewMeasure: \{[\s\S]*?position: 'absolute'[\s\S]*?opacity: 0/);

  // At normal phone text sizes the two actions use one deliberate row; their
  // full screen-reader labels remain unchanged.
  assert.match(styles, /epActionRow: \{[\s\S]*?flexWrap: 'nowrap'[\s\S]*?gap: 4/);
  assert.doesNotMatch(watched, /marginRight: 8/);
  assert.match(watched, /accessibilityLabel=\{watched \? `Mark Episode \$\{episodeNumber\} unwatched` : `Mark Episode \$\{episodeNumber\} watched`\}/);

  // Light-theme Media Detail fades directly into the semantic page background
  // and explicitly disables cinema text shadows. This fixes Projector Silver
  // without hard-coding one theme id or changing dark-theme cinema treatment.
  assert.match(detail, /const backdropFadeColors = theme\.dark/);
  assert.match(detail, /`\$\{theme\.background\}00`/);
  assert.match(detail, /`\$\{theme\.background\}E8`/);
  assert.match(detail, /colors=\{backdropFadeColors\}/);
  assert.match(detail, /textShadowRadius: theme\.dark \? 10 : 0/);
  assert.match(detail, /textShadowRadius: theme\.dark \? 4 : 0/);
  assert.doesNotMatch(detail, /theme\.id === ['"]projector-silver['"]/);
});

test("Phase 7.10.4 clips Person parallax artwork at the hero boundary without flattening the profile", () => {
  const person = read("app/person/[id].tsx");

  // Preserve the accepted parallax treatment itself. The fix is a clipping
  // boundary, not removal of motion or replacement of the portrait hero.
  assert.match(person, /const headerTranslateY = scrollY\.interpolate\(/);
  assert.match(person, /outputRange: \[-50, 0, 150\]/);
  assert.match(person, /transform: \[\{ translateY: headerTranslateY \}, \{ scale: headerScale \}\]/);

  // Transformed artwork must stop at the semantic hero boundary instead of
  // painting underneath Biography/Filmography after the content scrolls up.
  assert.match(person, /headerContainer: \{[\s\S]*?height: 500,[\s\S]*?overflow: 'hidden'/);
  assert.doesNotMatch(person, /headerContainer: \{[\s\S]*?overflow: 'visible'/);

  // The floating info HUD and biography expansion remain in the content body,
  // so clipping the artwork cannot clip the HUD or discard biography text.
  assert.match(person, /<View style=\{\[styles\.contentContainer/);
  assert.match(person, /style=\{\[styles\.infoHud/);
  assert.match(person, /numberOfLines=\{bioExpanded \? undefined : BIO_PREVIEW_LINES\}/);
  assert.match(person, /\{data\.biography\}/);
});


test("Post-P7.1 adds lazy TMDB movie-collection parity without changing standalone movie tabs", () => {
  const detail = read("src/features/media-detail/MediaDetailScreen.tsx");
  const collection = read("src/features/media-detail/MovieCollectionTab.tsx");

  // Collection appears only when TMDB says the movie belongs to one. The full
  // collection request stays lazy because the tab component is mounted only
  // after the user selects Collection.
  assert.match(detail, /data\?\.belongs_to_collection\?\.id/);
  assert.match(detail, /\.\.\.\(collectionRef \? \['collection'\] : \[\]\)/);
  assert.match(detail, /activeTab === 'collection' && collectionRef/);
  assert.match(collection, /tmdbFetch<any>\(`\/collection\/\$\{collectionId\}`\)/);
  assert.match(collection, /media_type: 'movie'/);
  assert.match(collection, /sort\(collectionReleaseOrder\)/);

  // Collection cards remain normal Orion movie cards, including existing
  // watched/My List semantics, while the current movie is marked and inert.
  assert.match(collection, /<MediaCard/);
  assert.match(collection, /contextLabel=\{current \? 'Current' : undefined\}/);
  assert.match(collection, /disabled=\{current\}/);
});

test("Post-P7.1 collection navigation stacks the next Media Detail so Back preserves browsing context", () => {
  const detail = read("src/features/media-detail/MediaDetailScreen.tsx");
  const card = read("src/components/MediaCard.tsx");

  // A collection selection must push, never replace, the originating detail
  // route. React Navigation therefore keeps the previous screen instance and
  // its active tab / scroll state available to Android and Orion Back.
  assert.match(detail, /const openCollectionMovie = useCallback/);
  assert.match(detail, /router\.push\(\{[\s\S]*?pathname: '\/media\/\[id\]'[\s\S]*?type: 'movie'/);
  assert.doesNotMatch(detail, /openCollectionMovie[\s\S]*?router\.replace/);

  // Shared cards can truthfully expose an inert Current item without changing
  // behavior for every other MediaCard caller.
  assert.match(card, /disabled\?: boolean/);
  assert.match(card, /contextLabel\?: string/);
  assert.match(card, /accessibilityState=\{\{ disabled \}\}/);
});

test("Post-P7.1a keeps collection tabs fixed at normal phone text while preserving the accessibility fallback", () => {
  const detail = read("src/features/media-detail/MediaDetailScreen.tsx");

  // The newly introduced fourth movie tab should not create a tiny accidental
  // horizontal scroll on ordinary phones. It gets one bounded proportional row.
  assert.match(detail, /const \{ fontScale \} = useWindowDimensions\(\)/);
  assert.match(detail, /const fitCollectionTabs = isMovie && !!collectionRef && !isTablet && fontScale <= 1\.05/);
  assert.match(detail, /fitCollectionTabs \? \([\s\S]*?flexDirection: 'row', gap: 6, width: '100%'/);
  assert.match(detail, /const fittedFlex = tab === 'recommended' \? 1\.8 : tab === 'collection' \? 1\.5 : 0\.85/);
  assert.match(detail, /\{ flex: fittedFlex, paddingHorizontal: 6, alignItems: 'center' \}/);
  assert.match(detail, /numberOfLines=\{1\}/);

  // Tablets and enlarged accessibility text keep the previous horizontally
  // scrollable pills rather than clipping or shrinking labels into unreadability.
  assert.match(detail, /\) : \(\s*<ScrollView horizontal showsHorizontalScrollIndicator=\{false\}/);
});
