import {
  useEffect,
  useRef,
} from "react";

export default function useDesktopNetworkRecovery(
  network,
  onRecovery,
) {
  const handledRecoveryEpochRef =
    useRef(network.recoveryEpoch);

  useEffect(() => {
    if (
      network.recoveryEpoch <=
      handledRecoveryEpochRef.current
    ) {
      return;
    }

    handledRecoveryEpochRef.current =
      network.recoveryEpoch;

    onRecovery();

    window.dispatchEvent(
      new CustomEvent(
        "orion:network-restored",
        {
          detail: {
            recoveryEpoch:
              network.recoveryEpoch,
            restoredAt:
              network.restoredAt,
          },
        },
      ),
    );
  }, [
    network.recoveryEpoch,
    network.restoredAt,
    onRecovery,
  ]);
}