const test = require("node:test");
const assert = require("node:assert/strict");
const {
  TERMINAL_FINALIZATION_IDLE_MS,
  finalizationWatchdogAction,
  isTerminalFragmentState,
} = require("../../../src/main/downloader/finalizationWatchdog");

test("terminal fragment state requires completed fragments and 99 percent", () => {
  assert.equal(isTerminalFragmentState({ totalFragments: 100, completedFragments: 99, progress: 99 }), false);
  assert.equal(isTerminalFragmentState({ totalFragments: 100, completedFragments: 100, progress: 99 }), true);
  assert.equal(isTerminalFragmentState({ totalFragments: 100, completedFragments: 101, progress: 99 }), true);
});

test("finalization watchdog waits before the terminal idle threshold", () => {
  assert.equal(
    finalizationWatchdogAction(
      { totalFragments: 100, completedFragments: 100, progress: 99, finalizationRecoveryCount: 0 },
      TERMINAL_FINALIZATION_IDLE_MS - 1,
    ),
    "wait",
  );
});

test("finalization watchdog performs one recovery and then fails boundedly", () => {
  const terminal = { totalFragments: 100, completedFragments: 100, progress: 99 };
  assert.equal(
    finalizationWatchdogAction({ ...terminal, finalizationRecoveryCount: 0 }, TERMINAL_FINALIZATION_IDLE_MS),
    "recover",
  );
  assert.equal(
    finalizationWatchdogAction({ ...terminal, finalizationRecoveryCount: 1 }, TERMINAL_FINALIZATION_IDLE_MS),
    "fail",
  );
});
