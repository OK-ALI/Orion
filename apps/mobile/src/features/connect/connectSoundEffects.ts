let connectPlayer: any = null;
let disconnectPlayer: any = null;

function getAudioModule() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-audio');
  } catch {
    return null;
  }
}

/** Plays the Orion Connect pairing/connection sound effect */
export function playConnectSound(): void {
  try {
    const audio = getAudioModule();
    if (!audio?.createAudioPlayer) return;
    if (!connectPlayer) {
      connectPlayer = audio.createAudioPlayer(require('../../../assets/sounds/connect.mp3'));
    }
    connectPlayer?.seekTo?.(0);
    connectPlayer?.play?.();
  } catch {
    // Audio feedback is non-critical and fails safe
  }
}

/** Plays the Orion Connect disconnection sound effect */
export function playDisconnectSound(): void {
  try {
    const audio = getAudioModule();
    if (!audio?.createAudioPlayer) return;
    if (!disconnectPlayer) {
      disconnectPlayer = audio.createAudioPlayer(require('../../../assets/sounds/disconnect.mp3'));
    }
    disconnectPlayer?.seekTo?.(0);
    disconnectPlayer?.play?.();
  } catch {
    // Audio feedback is non-critical and fails safe
  }
}
