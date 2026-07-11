const SCENE_THEMES = {
  'idle-space': { bg: '#050508', primary: '#5c60f5', glow: 'rgba(92, 96, 245, 0.15)' },
  'library': { bg: '#0a0a14', primary: '#7d5fff', glow: 'rgba(125, 95, 255, 0.4)' },
  'playlists': { bg: '#07070d', primary: '#8b7cf6', glow: 'rgba(139, 124, 246, 0.24)' },
  'albums': { bg: '#1a0b12', primary: '#e50914', glow: 'rgba(229, 9, 20, 0.4)' },
  'artists': { bg: '#141405', primary: '#ffd700', glow: 'rgba(255, 215, 0, 0.25)' },
  'now-playing': { bg: '#05020a', primary: '#b779f7', glow: 'rgba(183, 121, 247, 0.32)' },
  'queue-satellites': { bg: '#05020b', primary: '#a020f0', glow: 'rgba(160, 32, 240, 0.35)' },
  'lyrics-rings': { bg: '#050509', primary: '#e6e2ef', glow: 'rgba(230, 226, 239, 0.2)' }
};

export function computeThemeTokens(palette, sceneState) {
  // Fallback to scene-specific defaults
  const theme = SCENE_THEMES[sceneState] || SCENE_THEMES['idle-space'];
  
  // Use extracted artwork palette colors if available, falling back to theme-defined accent
  const baseColor = palette?.base || theme.bg;
  const primaryColor = palette?.primary || theme.primary;
  const spectralColor = palette?.spectral || primaryColor;
  
  return {
    '--mp-bg': theme.bg,
    '--mp-primary': primaryColor,
    '--mp-spectral': spectralColor,
    '--mp-glow': palette?.primary ? `color-mix(in srgb, ${primaryColor} 40%, transparent)` : theme.glow,
    '--mp-text': 'var(--music-scene-text)',
    '--mp-muted': 'var(--music-scene-text-muted)',
    '--mp-line': 'var(--music-glass-edge)',
    '--mp-surface': 'var(--music-scene-surface)',
    '--mp-surface-active': 'var(--music-active-surface)',
    '--mp-player-bg': 'var(--music-scene-glass-strong)',
    '--mp-player-glow': palette?.primary ? `color-mix(in srgb, ${primaryColor} 15%, transparent)` : 'rgba(125, 95, 255, 0.1)'
  };
}
