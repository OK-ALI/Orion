const TERMINAL_FINALIZATION_IDLE_MS = 60 * 1000;

function isTerminalFragmentState(entry = {}) {
  const total = Number(entry.totalFragments) || 0;
  const completed = Number(entry.completedFragments) || 0;
  const progress = Number(entry.progress) || 0;
  return total > 0 && completed >= total && progress >= 99;
}

function finalizationWatchdogAction(entry = {}, idleMs = 0) {
  if (!isTerminalFragmentState(entry) || idleMs < TERMINAL_FINALIZATION_IDLE_MS) {
    return "wait";
  }
  return (Number(entry.finalizationRecoveryCount) || 0) < 1 ? "recover" : "fail";
}

module.exports = {
  TERMINAL_FINALIZATION_IDLE_MS,
  finalizationWatchdogAction,
  isTerminalFragmentState,
};
