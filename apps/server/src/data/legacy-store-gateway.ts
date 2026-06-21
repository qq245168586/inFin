import { Injectable } from "@nestjs/common";
import { createLegacyStore } from "../legacy/store-runtime.js";

type LegacyStoreFunction = (...args: unknown[]) => unknown;
type LegacyStoreModule = Record<string, LegacyStoreFunction>;

const WRITE_OPERATION_PREFIXES = [
  "add",
  "bind",
  "copy",
  "create",
  "delete",
  "heartbeat",
  "login",
  "refresh",
  "register",
  "rescan",
  "save",
  "set",
  "unbind",
  "update",
  "upsert"
];

@Injectable()
export class LegacyStoreGateway {
  private readonly store: LegacyStoreModule;

  /**
   * 初始化 legacy store 网关，允许测试注入替代 store。
   */
  constructor(store: LegacyStoreModule = createLegacyStore()) {
    this.store = store;
  }

  /**
   * 通过名称调用 legacy store 方法，统一处理缺失方法错误。
   */
  call(functionName: string, ...args: unknown[]) {
    const handler = this.store[functionName];

    if (typeof handler !== "function") {
      throw new Error(`Legacy store function not found: ${functionName}`);
    }
    return handler(...args);
  }

  /**
   * 返回底层 legacy store，供兼容层继续使用旧 API。
   */
  raw() {
    return this.store;
  }

  /**
   * 列出 legacy store 暴露的方法，便于测试和诊断。
   */
  functionNames() {
    return Object.keys(this.store).sort();
  }

  /**
   * 判断是否满足 is write operation 条件，供调用方做分支处理。
   */
  isWriteOperation(functionName: string) {
    return WRITE_OPERATION_PREFIXES.some((prefix) => functionName.startsWith(prefix));
  }
}

let defaultLegacyStoreGateway: LegacyStoreGateway | null = null;

/**
 * 读取 default legacy store gateway，并保持返回结构稳定。
 */
export function getDefaultLegacyStoreGateway() {
  if (!defaultLegacyStoreGateway) {
    defaultLegacyStoreGateway = new LegacyStoreGateway();
  }
  return defaultLegacyStoreGateway;
}
