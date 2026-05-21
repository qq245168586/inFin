import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  cloneCourseScript,
  createTrainingPanel,
  courseScriptUsesAction,
  legacyCourseToScript,
  normalizeCoursePlan,
  summarizeCourseScript,
  validateCourseScript
} from "../../../../packages/shared/src/course-script.js";
import { legacyDirname, namesFromExportedFunctions, readChunks, stripEsmImports } from "./chunks.js";

type StoreModule = Record<string, (...args: unknown[]) => unknown>;

export function createLegacyStore(): StoreModule {
  const currentDir = legacyDirname(import.meta.url);
  const chunksDir = path.join(currentDir, "store-chunks");
  const legacyStoreDir = path.resolve(process.cwd(), "src/data");
  const source = readChunks(chunksDir, "store");
  const exportNames = namesFromExportedFunctions(source);
  const executable = stripEsmImports(source)
    .replace("const __dirname = path.dirname(fileURLToPath(import.meta.url));", "const __dirname = legacyStoreDir;")
    .replace(/export\s+(async\s+function|function)\s+/g, "$1 ");
  const factory = new Function(
    "fs",
    "createHash",
    "randomBytes",
    "path",
    "fileURLToPath",
    "cloneCourseScript",
    "createTrainingPanel",
    "courseScriptUsesAction",
    "legacyCourseToScript",
    "normalizeCoursePlan",
    "summarizeCourseScript",
    "validateCourseScript",
    "legacyStoreDir",
    `${executable}\nreturn { ${exportNames.join(", ")} };`
  );

  return factory(
    fs,
    createHash,
    randomBytes,
    path,
    fileURLToPath,
    cloneCourseScript,
    createTrainingPanel,
    courseScriptUsesAction,
    legacyCourseToScript,
    normalizeCoursePlan,
    summarizeCourseScript,
    validateCourseScript,
    legacyStoreDir
  ) as StoreModule;
}
