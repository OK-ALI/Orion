import type {
  MusicProviderDescriptor,
  MusicProviderKind,
} from "./providers";

/**
 * Provider selection preferences are keyed by capability kind and contain only
 * provider IDs. Private setup data stays outside this contract.
 */
export type MusicProviderSelectionMap = Readonly<
  Partial<Record<MusicProviderKind, string>>
>;

export type MusicProviderRegistryListener = () => void;
export type MusicProviderRegistryUnsubscribe = () => void;

/**
 * Serializable provider-directory state suitable for application boundaries.
 * It intentionally contains descriptors and selected IDs, not executable
 * provider implementations.
 */
export interface MusicProviderRegistrySnapshot {
  providers: readonly MusicProviderDescriptor[];
  activeProviderIds: MusicProviderSelectionMap;
}

/**
 * Platform-neutral registry contract matching the proven Music Planet host
 * operations. TProvider allows a host to expose either runtime providers
 * internally or safe descriptors at an application boundary.
 */
export interface MusicProviderRegistry<TProvider = MusicProviderDescriptor> {
  list(kind?: MusicProviderKind): readonly TProvider[];

  get(
    providerId: string,
    kind?: MusicProviderKind,
  ): TProvider | undefined;

  getActive(kind: MusicProviderKind): TProvider | undefined;

  setActive(
    kind: MusicProviderKind,
    providerId: string,
  ): void | Promise<void>;

  subscribe(
    listener: MusicProviderRegistryListener,
  ): MusicProviderRegistryUnsubscribe;
}
