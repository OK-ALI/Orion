import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { AppState } from 'react-native';
import type {
  MobilePlayerCapabilities,
  MobilePlayerControllerV1,
  MobilePlayerHudState,
  MobilePlayerLoadingState,
  MobilePlayerOverlay,
  MobilePlayerPlaybackSnapshot,
  MobilePlayerPresentation,
  MobilePlayerSurfaceAdapter,
} from '@orion/shared/types';

const EMPTY_PLAYBACK: MobilePlayerPlaybackSnapshot = {
  state: 'loading',
  playing: false,
  currentTime: null,
  duration: null,
  bufferedPosition: null,
  observable: false,
};

const EMPTY_CAPABILITIES: MobilePlayerCapabilities = {
  canPlay: false,
  canPause: false,
  canSeek: false,
  canSubtitles: false,
  canSourceSwitch: true,
  canShield: true,
  canFullscreen: false,
  canPresentation: false,
};

type RestorableHudState = Exclude<MobilePlayerHudState, 'pinned-by-sheet'>;
type State = MobilePlayerControllerV1 & {
  activeSessionId: string | null;
  hudBeforeSheet: RestorableHudState;
};
type Action =
  | { type: 'register'; adapter: MobilePlayerSurfaceAdapter; capabilities: MobilePlayerCapabilities; presentation: MobilePlayerPresentation }
  | { type: 'unregister'; sessionId: string }
  | { type: 'playback'; sessionId: string; snapshot: MobilePlayerPlaybackSnapshot }
  | { type: 'hud'; state: MobilePlayerHudState }
  | { type: 'overlay'; overlay: MobilePlayerOverlay }
  | { type: 'loading'; loadingState: MobilePlayerLoadingState }
  | { type: 'presentation'; presentation: MobilePlayerPresentation };

const INITIAL_STATE: State = {
  activeSurface: null,
  activeSessionId: null,
  hudState: 'initial',
  hudBeforeSheet: 'initial',
  overlay: 'none',
  playback: EMPTY_PLAYBACK,
  capabilities: EMPTY_CAPABILITIES,
  presentation: 'provider',
  loadingState: 'preparing',
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'register':
      return {
        ...INITIAL_STATE,
        activeSurface: action.adapter.surface,
        activeSessionId: action.adapter.sessionId,
        capabilities: action.capabilities,
        presentation: action.presentation,
      };
    case 'unregister':
      if (state.activeSessionId !== action.sessionId) return state;
      return { ...INITIAL_STATE };
    case 'playback': {
      if (state.activeSessionId !== action.sessionId) return state;
      const resumedFromExplicitPause = !state.playback.playing
        && action.snapshot.playing
        && state.hudState === 'visible-explicit';
      return {
        ...state,
        playback: action.snapshot,
        // Playback truth updates the status layer only. It never opens chrome.
        hudState: resumedFromExplicitPause ? 'hidden' : state.hudState,
        loadingState: action.snapshot.state === 'buffering'
          ? 'buffering'
          : action.snapshot.state === 'error'
            ? 'failed'
            : action.snapshot.state === 'loading'
              ? state.loadingState || 'preparing'
              : null,
      };
    }
    case 'hud':
      return { ...state, hudState: action.state };
    case 'overlay':
      if (action.overlay !== 'none') {
        const previous = state.hudState === 'pinned-by-sheet'
          ? state.hudBeforeSheet
          : state.hudState;
        return {
          ...state,
          overlay: action.overlay,
          hudBeforeSheet: previous,
          hudState: 'pinned-by-sheet',
        };
      }
      return {
        ...state,
        overlay: 'none',
        hudState: state.hudBeforeSheet,
      };
    case 'loading':
      return {
        ...state,
        loadingState: action.loadingState,
        // Buffering/preparation use the central status overlay. Only a fatal
        // failure may reveal recovery chrome.
        hudState: action.loadingState === 'failed' ? 'recovery' : state.hudState,
      };
    case 'presentation':
      return { ...state, presentation: action.presentation };
    default:
      return state;
  }
}

interface ControllerValue {
  state: State;
  adapter: MobilePlayerSurfaceAdapter | null;
  registerSurface(adapter: MobilePlayerSurfaceAdapter, capabilities: MobilePlayerCapabilities, presentation: MobilePlayerPresentation): () => void;
  updatePlayback(snapshot: MobilePlayerPlaybackSnapshot, sessionId?: string): void;
  reveal(): void;
  dismiss(): void;
  toggleChromeFromUserTap(): void;
  openOverlay(overlay: Exclude<MobilePlayerOverlay, 'none'>): void;
  closeOverlay(): void;
  setLoading(loading: MobilePlayerLoadingState): void;
  setPresentation(mode: MobilePlayerPresentation): void;
}

const ControllerContext = createContext<ControllerValue | null>(null);

export function MobilePlayerControllerProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;
  const adapterRef = useRef<MobilePlayerSurfaceAdapter | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  }, []);

  const registerSurface = useCallback((
    adapter: MobilePlayerSurfaceAdapter,
    capabilities: MobilePlayerCapabilities,
    presentation: MobilePlayerPresentation,
  ) => {
    adapterRef.current = adapter;
    dispatch({ type: 'register', adapter, capabilities, presentation });
    dispatch({ type: 'playback', sessionId: adapter.sessionId, snapshot: adapter.getSnapshot() });
    return () => {
      if (adapterRef.current?.sessionId !== adapter.sessionId) return;
      adapterRef.current = null;
      dispatch({ type: 'unregister', sessionId: adapter.sessionId });
    };
  }, []);

  const reveal = useCallback(() => {
    if (stateRef.current.overlay !== 'none') return;
    dispatch({ type: 'hud', state: 'visible-explicit' });
  }, []);
  const dismiss = useCallback(() => {
    if (stateRef.current.overlay !== 'none') return;
    dispatch({ type: 'hud', state: 'hidden' });
  }, []);
  const toggleChromeFromUserTap = useCallback(() => {
    const current = stateRef.current;
    if (current.overlay !== 'none'
      || current.hudState === 'pinned-by-sheet'
      || current.hudState === 'recovery') return;
    dispatch({
      type: 'hud',
      state: current.hudState === 'hidden' ? 'visible-explicit' : 'hidden',
    });
  }, []);
  const openOverlay = useCallback((overlay: Exclude<MobilePlayerOverlay, 'none'>) => dispatch({ type: 'overlay', overlay }), []);
  const closeOverlay = useCallback(() => dispatch({ type: 'overlay', overlay: 'none' }), []);
  const updatePlayback = useCallback((snapshot: MobilePlayerPlaybackSnapshot, sessionId?: string) => {
    const activeSessionId = adapterRef.current?.sessionId;
    if (!activeSessionId || (sessionId && sessionId !== activeSessionId)) return;
    dispatch({ type: 'playback', sessionId: activeSessionId, snapshot });
  }, []);
  const setLoading = useCallback((loadingState: MobilePlayerLoadingState) => dispatch({ type: 'loading', loadingState }), []);
  const setPresentation = useCallback((presentation: MobilePlayerPresentation) => dispatch({ type: 'presentation', presentation }), []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') return;
      clearHideTimer();
      const current = stateRef.current;
      if (current.overlay === 'none' && current.playback.playing) {
        dispatch({ type: 'hud', state: 'hidden' });
      }
    });
    return () => {
      subscription.remove();
      clearHideTimer();
    };
  }, [clearHideTimer]);

  useEffect(() => {
    clearHideTimer();
    const canHide = state.playback.playing && state.overlay === 'none'
      && (state.hudState === 'initial' || state.hudState === 'visible-explicit');
    if (canHide) {
      const delay = state.hudState === 'initial' ? 3000 : 4000;
      hideTimer.current = setTimeout(() => dispatch({ type: 'hud', state: 'hidden' }), delay);
    }
    return clearHideTimer;
  }, [clearHideTimer, state.hudState, state.overlay, state.playback.playing]);

  const value = useMemo<ControllerValue>(() => ({
    state,
    adapter: adapterRef.current,
    registerSurface,
    updatePlayback,
    reveal,
    dismiss,
    toggleChromeFromUserTap,
    openOverlay,
    closeOverlay,
    setLoading,
    setPresentation,
  }), [closeOverlay, dismiss, openOverlay, registerSurface, reveal, setLoading, setPresentation, state, toggleChromeFromUserTap, updatePlayback]);

  return <ControllerContext.Provider value={value}>{children}</ControllerContext.Provider>;
}

export function useMobilePlayerController() {
  const value = useContext(ControllerContext);
  if (!value) throw new Error('useMobilePlayerController must be used inside MobilePlayerControllerProvider');
  return value;
}
