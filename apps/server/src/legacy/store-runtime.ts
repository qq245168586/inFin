import * as legacyStore from "./legacy-store.js";

type StoreModule = Record<string, (...args: unknown[]) => unknown>;

/**
 * 创建 legacy store，并补齐运行时需要的默认配置。
 */
export function createLegacyStore(): StoreModule {
  legacyStore.reloadLegacyStoreState();
  return legacyStore as unknown as StoreModule;
}
