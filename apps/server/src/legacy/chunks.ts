import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function legacyDirname(importMetaUrl: string) {
  return path.dirname(fileURLToPath(importMetaUrl));
}

export function readChunks(directory: string, prefix: string) {
  const sourceDirectory = fs.existsSync(directory) ? directory : directory.replace(`${path.sep}dist${path.sep}`, `${path.sep}src${path.sep}`);
  return fs
    .readdirSync(sourceDirectory)
    .filter((name) => name.startsWith(`${prefix}.`) && name.endsWith(".txt"))
    .sort()
    .map((name) => fs.readFileSync(path.join(sourceDirectory, name), "utf8"))
    .join("\n");
}

export function stripEsmImports(source: string) {
  return source.replace(/import[\s\S]*?from\s+["'][^"']+["'];\n/g, "");
}

export function namesFromExportedFunctions(source: string) {
  return [...source.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g)].map((match) => match[1]);
}
