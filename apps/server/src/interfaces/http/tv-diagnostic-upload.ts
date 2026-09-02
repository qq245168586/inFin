import type { IncomingMessage, ServerResponse } from "node:http";
import { sendJson } from "../../utils/http.js";
import { TvDiagnosticFiles, tvDiagnosticFiles } from "../../services/tv-diagnostic-files.js";
import {
  DiagnosticError, MAX_DIAGNOSTIC_BYTES, validateDiagnosticLogId, type DiagnosticIdentity
} from "../../services/tv-diagnostic-schema.js";

/** Reads at most 64 KiB without retaining an oversized stream or destroying the error response. */
function readLogFile(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const finish = () => {
      clearTimeout(timer);
      request.off("data", data);
      request.off("end", end);
      request.off("aborted", aborted);
      request.off("error", failed);
    };
    const failed = (error: Error) => {
      finish();
      request.on("error", () => {});
      request.resume();
      reject(error);
    };
    const aborted = () => failed(new DiagnosticError(400, "UPLOAD_ABORTED", "Log upload aborted."));
    const data = (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_DIAGNOSTIC_BYTES) failed(new DiagnosticError(413, "LOG_TOO_LARGE", "Log exceeds 64 KiB."));
      else chunks.push(Buffer.from(chunk));
    };
    const end = () => { finish(); resolve(Buffer.concat(chunks)); };
    const timer = setTimeout(() => failed(new DiagnosticError(408, "UPLOAD_TIMEOUT", "Log upload timed out.")), 10_000);
    request.on("data", data);
    request.on("end", end);
    request.on("aborted", aborted);
    request.on("error", failed);
  });
}

/** Accepts diagnostic files only for the authenticated binding; no DB mutations or raw file paths. */
export async function handleTvDiagnosticUpload(
  request: IncomingMessage, response: ServerResponse,
  authenticate: () => DiagnosticIdentity, files: TvDiagnosticFiles = tvDiagnosticFiles
) {
  try {
    const identity = authenticate();
    files.admit(identity.deviceId);
    const logId = validateDiagnosticLogId(request.headers["x-infini-log-id"]);
    if (request.headers["content-type"]?.split(";")[0].trim() !== "application/x-ndjson") {
      throw new DiagnosticError(415, "INVALID_LOG_CONTENT_TYPE", "Upload an application/x-ndjson file.");
    }
    if (request.headers["content-encoding"] && request.headers["content-encoding"] !== "identity") {
      throw new DiagnosticError(415, "UNSUPPORTED_LOG_ENCODING", "Compressed uploads are not supported.");
    }
    if (Number(request.headers["content-length"]) > MAX_DIAGNOSTIC_BYTES) {
      throw new DiagnosticError(413, "LOG_TOO_LARGE", "Log exceeds 64 KiB.");
    }
    const result = await files.receive(identity, logId, await readLogFile(request));
    sendJson(response, result.duplicate ? 200 : 201, { data: result });
  } catch (error) {
    request.resume();
    if (error instanceof DiagnosticError) {
      if (error.status === 429) response.setHeader("Retry-After", "60");
      sendJson(response, error.status, { code: error.code, message: error.message });
    } else {
      console.warn("TV diagnostic file could not be stored.");
      sendJson(response, 503, { code: "LOG_STORAGE_UNAVAILABLE", message: "Diagnostic storage unavailable." });
    }
  }
}
