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

  constructor(store: LegacyStoreModule = createLegacyStore()) {
    this.store = store;
  }

  call(functionName: string, ...args: unknown[]) {
    const handler = this.store[functionName];
    if (typeof handler !== "function") {
      throw new Error(`Legacy store function not found: ${functionName}`);
    }
    return handler(...args);
  }

  raw() {
    return this.store;
  }

  functionNames() {
    return Object.keys(this.store).sort();
  }

  isWriteOperation(functionName: string) {
    return WRITE_OPERATION_PREFIXES.some((prefix) => functionName.startsWith(prefix));
  }
}

let defaultLegacyStoreGateway: LegacyStoreGateway | null = null;

export function getDefaultLegacyStoreGateway() {
  if (!defaultLegacyStoreGateway) {
    defaultLegacyStoreGateway = new LegacyStoreGateway();
  }
  return defaultLegacyStoreGateway;
}
