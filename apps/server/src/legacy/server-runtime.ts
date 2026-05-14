import fs from "node:fs";
import http from "node:http";
import { createHash } from "node:crypto";
import path from "node:path";
import { URL } from "node:url";
import * as store from "../data/store.js";
import * as mediaStorage from "../services/media-storage.js";
import * as mqttOpsLog from "../services/mqtt-ops-log.js";
import * as tvControl from "../services/tv-control.js";
import * as httpUtils from "../utils/http.js";
import { legacyDirname, readChunks, stripEsmImports } from "./chunks.js";

type LegacyRequestHandler = (request: http.IncomingMessage, response: http.ServerResponse) => Promise<void>;

export async function createLegacyRequestHandler(): Promise<LegacyRequestHandler> {
  const chunksDir = path.join(legacyDirname(import.meta.url), "server-chunks");
  const source = readChunks(chunksDir, "server");
  const executable = stripEsmImports(source)
    .replace("const server = http.createServer(async (request, response) => {", "const legacyRequestHandler = async (request, response) => {")
    .replace("\n});\n\nstartOpsMqttSubscriber();", "\n};\n\nstartOpsMqttSubscriber();")
    .replace(/\nserver\.listen\(port, host,[\s\S]*?\n\}\);\s*$/, "\nreturn legacyRequestHandler;");

  const factory = new Function(
    "fs",
    "http",
    "createHash",
    "path",
    "URL",
    "deps",
    `const { store, mediaStorage, tvControl, mqttOpsLog, httpUtils } = deps;
${declareBindings("store", Object.keys(store))}
${declareBindings("mediaStorage", Object.keys(mediaStorage))}
${declareBindings("tvControl", Object.keys(tvControl))}
${declareBindings("mqttOpsLog", Object.keys(mqttOpsLog))}
${declareBindings("httpUtils", Object.keys(httpUtils))}
${executable}`
  );

  return factory(fs, http, createHash, path, URL, {
    store,
    mediaStorage,
    tvControl,
    mqttOpsLog,
    httpUtils
  }) as LegacyRequestHandler;
}

function declareBindings(objectName: string, names: string[]) {
  return `const { ${names.join(", ")} } = ${objectName};`;
}
