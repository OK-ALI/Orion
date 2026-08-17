import type { PortableProfileV3 } from "../types/portableProfile";

/**
 * Backend-neutral cloud profile boundary.
 *
 * revisionTag is deliberately opaque. Each backend may map it to its own
 * conditional-write/version token without leaking provider details upward.
 */
export type CloudProfileReadResult =
  | {
      state: "missing";
      revisionTag: null;
    }
  | {
      state: "found";
      profile: PortableProfileV3;
      revisionTag: string;
      remoteModifiedAt: number | null;
    };

export interface CloudProfileWriteRequest {
  profile: PortableProfileV3;
  /**
   * null is valid only when the caller expects no remote profile to exist.
   * Implementations must treat a mismatched tag as a conflict, not overwrite.
   */
  expectedRevisionTag: string | null;
}

export type CloudProfileWriteResult =
  | {
      state: "written";
      revisionTag: string;
      remoteModifiedAt: number | null;
    }
  | {
      state: "conflict";
      revisionTag: string | null;
    };

export interface CloudProfileStore {
  read(profileKey: string): Promise<CloudProfileReadResult>;
  write(
    profileKey: string,
    request: CloudProfileWriteRequest,
  ): Promise<CloudProfileWriteResult>;
}
