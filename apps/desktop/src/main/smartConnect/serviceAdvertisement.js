const os = require('os');
const { Bonjour } = require('bonjour-service');

function createServiceAdvertisement({ port, protocolVersion, getInstanceId, getFingerprint }) {
  let bonjour = null;
  let service = null;

  return {
    start() {
      if (bonjour || service) return;
      try {
        bonjour = new Bonjour({}, (error) => {
          console.warn('[SmartConnect] NSD advertisement warning:', error?.message || error);
        });
        service = bonjour.publish({
          name: `Orion Desktop (${os.hostname()})`,
          type: 'orion-connect',
          protocol: 'tcp',
          port,
          txt: {
            app: 'orion',
            version: String(protocolVersion),
            instanceId: getInstanceId(),
            fingerprint: getFingerprint(),
          },
        });
      } catch (error) {
        console.warn('[SmartConnect] Could not advertise NSD service:', error.message);
      }
    },
    stop() {
      try { service?.stop?.(); } catch {}
      try { bonjour?.destroy?.(); } catch {}
      service = null;
      bonjour = null;
    },
  };
}

module.exports = { createServiceAdvertisement };
