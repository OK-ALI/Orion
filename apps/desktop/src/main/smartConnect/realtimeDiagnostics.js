function createRealtimeDiagnostics() {
  const counters = {
    received: 0,
    rateRejected: 0,
    replayRejected: 0,
    forwarded: 0,
  };
  const enabled = process.env.ORION_SMART_CONNECT_DIAGNOSTICS === "1";
  const timer = enabled ? setInterval(() => {
    console.log(
      `[SmartConnect realtime] received=${counters.received} rateRejected=${counters.rateRejected} replayRejected=${counters.replayRejected} forwarded=${counters.forwarded}`,
    );
    counters.received = 0;
    counters.rateRejected = 0;
    counters.replayRejected = 0;
    counters.forwarded = 0;
  }, 1000) : null;

  return {
    record(name) {
      if (enabled && Object.hasOwn(counters, name)) counters[name] += 1;
    },
    stop() {
      if (timer) clearInterval(timer);
    },
  };
}

module.exports = { createRealtimeDiagnostics };
