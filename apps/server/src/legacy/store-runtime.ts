import * as legacyStore from "./legacy-store.js";

type StoreModule = Record<string, (...args: unknown[]) => unknown>;

export function createLegacyStore(): StoreModule {
  legacyStore.reloadLegacyStoreState();
  return legacyStore as unknown as StoreModule;
}
