import type { IStorageAdapter } from '@orion/shared/api';
import {
  buildPortableMyListPreviewV1,
  portableMyListPreviewSignatureV1,
} from '@orion/shared/types';

const SAVED_KEY = 'saved';
const SAVED_ORDER_KEY = 'savedOrder';

export interface PersistedMyListReceiptV1 {
  saved: Record<string, any>;
  itemIdentities: string[];
  count: number;
  savedOrder: string[];
  normalizedContentSignature: string;
}

function parsePersistedMyList(savedRaw: string | null, orderRaw: string | null) {
  if (savedRaw == null || orderRaw == null) throw new Error('MY_LIST_PERSISTENCE_READBACK_MISSING');
  const persistedSaved: unknown = JSON.parse(savedRaw);
  const persistedOrder: unknown = JSON.parse(orderRaw);
  if (
    !persistedSaved
    || typeof persistedSaved !== 'object'
    || Array.isArray(persistedSaved)
    || !Array.isArray(persistedOrder)
    || persistedOrder.some((key) => typeof key !== 'string')
  ) {
    throw new Error('MY_LIST_PERSISTENCE_READBACK_INVALID');
  }
  return {
    saved: persistedSaved as Record<string, any>,
    savedOrder: persistedOrder as string[],
  };
}

function sameStrings(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function restorePrevious(
  storage: IStorageAdapter,
  previousSaved: string | null,
  previousOrder: string | null,
) {
  if (previousSaved == null) storage.remove(SAVED_KEY);
  else storage.set(SAVED_KEY, previousSaved);
  if (previousOrder == null) storage.remove(SAVED_ORDER_KEY);
  else storage.set(SAVED_ORDER_KEY, previousOrder);
}

export function replacePersistedMyListV1(
  storage: IStorageAdapter,
  nextSaved: Record<string, any>,
  nextSavedOrder: string[],
): PersistedMyListReceiptV1 {
  const previousSaved = storage.get(SAVED_KEY);
  const previousOrder = storage.get(SAVED_ORDER_KEY);
  try {
    // The collection and its ordering form one logical replacement. Any write
    // or verification failure restores the complete previous pair.
    storage.set(SAVED_KEY, JSON.stringify(nextSaved));
    storage.set(SAVED_ORDER_KEY, JSON.stringify(nextSavedOrder));

    const persisted = parsePersistedMyList(
      storage.get(SAVED_KEY),
      storage.get(SAVED_ORDER_KEY),
    );
    const expectedPreview = buildPortableMyListPreviewV1(nextSaved, nextSavedOrder);
    const persistedPreview = buildPortableMyListPreviewV1(persisted.saved, persisted.savedOrder);
    const expectedIdentities = Object.keys(expectedPreview.records).sort();
    const persistedIdentities = Object.keys(persistedPreview.records).sort();
    const normalizedContentSignature = portableMyListPreviewSignatureV1(persistedPreview);
    if (
      expectedPreview.rejectedKeys.length > 0
      || persistedPreview.rejectedKeys.length > 0
      || Object.keys(persisted.saved).length !== Object.keys(nextSaved).length
      || !sameStrings(persisted.savedOrder, nextSavedOrder)
      || !sameStrings(persistedPreview.orderedKeys, expectedPreview.orderedKeys)
      || !sameStrings(persistedIdentities, expectedIdentities)
      || normalizedContentSignature !== portableMyListPreviewSignatureV1(expectedPreview)
    ) {
      throw new Error('MY_LIST_PERSISTENCE_READBACK_MISMATCH');
    }

    return {
      saved: persisted.saved,
      itemIdentities: persistedIdentities,
      count: persistedIdentities.length,
      savedOrder: [...persisted.savedOrder],
      normalizedContentSignature,
    };
  } catch (error) {
    try {
      restorePrevious(storage, previousSaved, previousOrder);
    } catch {
      // The global storage health boundary surfaces persistent backend failure.
    }
    throw error;
  }
}
