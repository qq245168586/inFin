import * as jsonFileStore from "../data/json-file-store.js";

type StoreModule = Record<string, (...args: unknown[]) => unknown>;

/**
 * 创建 JSON file store，并补齐运行时需要的默认配置。
 */
export function createJsonFileStore(): StoreModule {
  jsonFileStore.reloadStoreState();
  return jsonFileStore as unknown as StoreModule;
}
