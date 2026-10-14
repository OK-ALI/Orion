import { GLIMPSE_INTERNAL_PREVIEW } from '../glimpse/glimpseBuild';
// Internal physical receipt qualification only; no payload or credential is retained.
let lastRequest = '';
let armed = false;
export function armFeedbackAckLoss(request: string | undefined): boolean {
  if (!GLIMPSE_INTERNAL_PREVIEW || !request || !/^[a-z0-9-]{1,64}$/.test(request) || request === lastRequest) return false;
  lastRequest = request; armed = true; return true;
}
export function consumeFeedbackAckLoss(): boolean {
  if (!GLIMPSE_INTERNAL_PREVIEW || !armed) return false;
  armed = false; return true;
}
