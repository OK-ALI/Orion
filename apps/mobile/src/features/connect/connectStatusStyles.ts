import type { MobileThemeTokens } from '../../context/ThemeContext';
import { radii } from '@orion/shared/tokens';

export const createConnectStatusStyles = (theme: MobileThemeTokens) => ({
  statusPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  statusPillConnected: {
    backgroundColor: theme.surface,
    borderColor: theme.success,
  },
  statusPillDisconnected: {
    backgroundColor: theme.surface,
    borderColor: theme.warning,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    color: theme.text,
    fontSize: 11,
    fontWeight: '700' as const,
  },
});
