import { radii, spacing } from '@orion/shared/tokens';
import type { MobileThemeTokens } from '../../context/ThemeContext';

export const createConnectPairingLayoutStyles = (theme: MobileThemeTokens) => ({
  modalKeyboardAvoider: { flex: 1 },
  modalOverlay: {
    flexGrow: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[4],
  },
  modalOverlayPhone: {
    justifyContent: 'flex-end' as const,
    paddingHorizontal: 0,
    paddingBottom: 0,
  },
  glassModalCard: {
    width: '100%' as const,
    maxWidth: 400,
    backgroundColor: theme.elevated,
    borderRadius: radii['2xl'],
    padding: spacing[5],
    borderWidth: 1,
    borderColor: theme.danger,
    alignItems: 'center' as const,
  },
  glassModalCardPhone: {
    maxWidth: undefined,
    maxHeight: '88%' as const,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  glassModalCardWide: { maxHeight: '92%' as const, maxWidth: 560 },
  glassModalCardKeyboard: { paddingVertical: spacing[3] },
});
