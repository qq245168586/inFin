import fs from "node:fs";

/**
 * 读取 request buffer，把底层数据转成调用方可直接使用的结构。
 */
export async function readRequestBuffer(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  return chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0);
}

/**
 * 读取 json body，把底层数据转成调用方可直接使用的结构。
 */
export async function readJsonBody(request) {
  const buffer = await readRequestBuffer(request);

  if (!buffer.length) {
    return null;
  }

  return JSON.parse(buffer.toString("utf8"));
}

/**
 * 封装 cors headers 的业务步骤，避免调用方依赖内部实现细节。
 */
function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,HEAD,POST,PUT,DELETE,OPTIONS",
    ...extra
  };
}

/**
 * 写入 json 响应，统一 HTTP 状态和响应头。
 */
export function sendJson(response, statusCode, payload) {
  response.writeHead(
    statusCode,
    corsHeaders({
      "Content-Type": "application/json; charset=utf-8"
    })
  );
  response.end(JSON.stringify(payload, null, 2));
}

/**
 * 写入 no content 响应，统一 HTTP 状态和响应头。
 */
export function sendNoContent(response) {
  response.writeHead(204, corsHeaders());
  response.end();
}

/**
 * 写入 buffer 响应，统一 HTTP 状态和响应头。
 */
export function sendBuffer(response, statusCode, buffer, contentType = "application/octet-stream") {
  response.writeHead(
    statusCode,
    corsHeaders({
      "Content-Type": contentType,
      "Content-Length": buffer.length
    })
  );
  response.end(buffer);
}

/**
 * 写入 file 响应，统一 HTTP 状态和响应头。
 */
export function sendFile(request, response, filePath, contentType = "application/octet-stream") {
  const stats = fs.statSync(filePath);
  const totalSize = stats.size;
  const rangeHeader = request.headers.range;

  if (rangeHeader) {
    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    const start = match?.[1] ? Number(match[1]) : 0;
    const end = match?.[2] ? Number(match[2]) : totalSize - 1;

    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= totalSize) {
      response.writeHead(
        416,
        corsHeaders({
          "Content-Range": `bytes */${totalSize}`
        })
      );
      response.end();
      return;
    }

    response.writeHead(
      206,
      corsHeaders({
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${totalSize}`
      })
    );

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    fs.createReadStream(filePath, { start, end }).pipe(response);
    return;
  }

  response.writeHead(
    200,
    corsHeaders({
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Content-Length": totalSize
    })
  );

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  fs.createReadStream(filePath).pipe(response);
}
