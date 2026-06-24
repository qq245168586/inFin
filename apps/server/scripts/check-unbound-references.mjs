import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const UNBOUND_REFERENCE_DIAGNOSTIC_CODES = new Set([
  2304,
  2552
]);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(scriptDir, "..");
const tsconfigPath = path.join(serverRoot, "tsconfig.json");
const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);

if (configFile.error) {
  reportDiagnostics([configFile.error]);
  process.exit(1);
}

const parsedConfig = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  serverRoot,
  {
    noEmit: true
  },
  tsconfigPath
);

if (parsedConfig.errors.length) {
  reportDiagnostics(parsedConfig.errors);
  process.exit(1);
}

const host = ts.createCompilerHost(parsedConfig.options);
const originalReadFile = host.readFile.bind(host);

host.readFile = (fileName) => {
  const text = originalReadFile(fileName);
  if (!text || !isServerSourceFile(fileName)) {
    return text;
  }
  return text.replace(/^\s*\/\/\s*@ts-nocheck\s*$/gm, "");
};

const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options, host);
const diagnostics = ts
  .getPreEmitDiagnostics(program)
  .filter((diagnostic) => UNBOUND_REFERENCE_DIAGNOSTIC_CODES.has(diagnostic.code));

if (diagnostics.length) {
  console.error("Found unbound server references. These would become runtime ReferenceError in ts-nocheck files.");
  reportDiagnostics(diagnostics);
  process.exit(1);
}

function isServerSourceFile(fileName) {
  const normalized = path.resolve(fileName);
  return normalized.startsWith(path.join(serverRoot, "src") + path.sep) && normalized.endsWith(".ts");
}

function reportDiagnostics(diagnostics) {
  const hostForFormat = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => serverRoot,
    getNewLine: () => "\n"
  };
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, hostForFormat));
}
