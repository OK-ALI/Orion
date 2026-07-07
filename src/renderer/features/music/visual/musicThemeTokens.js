const SCENE_THEMES = {
  'idle-space': { bg: '#07070b', primary: '#e6e6e0', glow: 'rgba(230, 230, 224, 0.15)' },
  'library': { bg: '#0a0a14', primary: '#7d5fff', glow: 'rgba(125, 95, 255, 0.4)' },
  'playlists': { bg: '#050a12', primary: '#00dcff', glow: 'rgba(0, 220, 255, 0.3)' },
  'albums': { bg: '#1a0b12', primary: '#e50914', glow: 'rgba(229, 9, 20, 0.4)' },
  'artists': { bg: '#141405', primary: '#ffd700', glow: 'rgba(255, 215, 0, 0.25)' },
  'now-playing': { bg: '#05020a', primary: '#ff00ff', glow: 'rgba(255, 0, 255, 0.4)' },
  'queue-satellites': { bg: '#05020b', primary: '#a020f0', glow: 'rgba(160, 32, 240, 0.35)' },
  'lyrics-rings': { bg: '#02050a', primary: '#00fa9a', glow: 'rgba(0, 250, 154, 0.35)' }
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
    '--mp-text': '#e6e6e0',
    '--mp-muted': 'rgba(230, 230, 224, 0.6)',
    '--mp-line': 'rgba(255, 255, 255, 0.08)',
    '--mp-surface': 'rgba(255, 255, 255, 0.03)',
    '--mp-surface-active': 'rgba(255, 255, 255, 0.08)',
    '--mp-player-bg': 'rgba(10, 10, 15, 0.4)',
    '--mp-player-glow': palette?.primary ? `color-mix(in srgb, ${primaryColor} 15%, transparent)` : 'rgba(125, 95, 255, 0.1)'
  };
}
