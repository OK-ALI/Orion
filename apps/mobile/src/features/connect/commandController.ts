import type { SmartConnectRemoteCommand } from '@orion/shared/types';

export function createRemoteCommand(
  action: string,
  value: unknown,
  deviceId: string,
  sequence: number,
): SmartConnectRemoteCommand {
  return {
    id: `${deviceId || 'mobile'}-${Date.now()}-${sequence}`,
    sequence,
    action: action as SmartConnectRemoteCommand['action'],
    value: action === 'cursor_move' ? undefined : value,
    pointer: action === 'cursor_move'
      ? {
          x: Math.max(0, Math.min(1, Number((value as any)?.x ?? (value as any)?.xRatio) || 0)),
          y: Math.max(0, Math.min(1, Number((value as any)?.y ?? (value as any)?.yRatio) || 0)),
        }
      : undefined,
    sentAt: Date.now(),
  };
}

