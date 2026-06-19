import assert from "node:assert/strict";
import test from "node:test";
import { mockAuthSession, mockSchedule } from "../fixtures/coachData.ts";
import { bundleUrl, venueBody, venueQuery } from "../../src/services/consoleService.ts";
import { buildCourseLogo, buildFormalPreviews, formatStorageBytes, isActiveSessionState, isAuthExpiredMessage, shortSessionId } from "../../src/utils/format.ts";

test("buildFormalPreviews sorts screens and skips cards without media", () => {
  assert.deepEqual(buildFormalPreviews(mockSchedule), [
    {
      id: "preview-group-a-screen-1-card-1-0",
      mediaUrl: "https://cdn.example.test/squat.mp4",
      actionName: "Squat"
    },
    {
      id: "preview-group-a-screen-2-card-2-1",
      mediaUrl: "https://cdn.example.test/lunge.mp4",
      actionName: "Lunge"
    }
  ]);
  assert.deepEqual(buildFormalPreviews(null), []);
});

test("course logo and compact id helpers have stable fallbacks", () => {
  assert.equal(buildCourseLogo("power flow"), "PF");
  assert.equal(buildCourseLogo("  "), "IN");
  assert.equal(shortSessionId("session-abcdef-123456"), "sessio…3456");
  assert.equal(shortSessionId("short-id"), "short-id");
  assert.equal(shortSessionId(""), "--");
});

test("auth and active-state helpers recognize coach workflow states", () => {
  assert.equal(isAuthExpiredMessage("请求失败 (401)"), true);
  assert.equal(isAuthExpiredMessage("refresh token 已失效"), true);
  assert.equal(isAuthExpiredMessage("普通网络错误"), false);
  assert.equal(isActiveSessionState("PREVIEW"), true);
  assert.equal(isActiveSessionState("ENDED"), false);
});

test("formatStorageBytes handles zero, invalid, and rounded larger values", () => {
  assert.equal(formatStorageBytes(0), "0 B");
  assert.equal(formatStorageBytes(Number.NaN), "0 B");
  assert.equal(formatStorageBytes(512), "512 B");
  assert.equal(formatStorageBytes(1536), "1.5 KB");
  assert.equal(formatStorageBytes(1_572_864), "1.5 MB");
});

test("bundleUrl includes Shanghai time zone and optional account namespace", () => {
  assert.equal(
    bundleUrl("2026-06-19", mockAuthSession),
    "/api/tv/daily-bundle?date=2026-06-19&timeZone=Asia%2FShanghai&accountNamespace=venue-alpha"
  );
  assert.equal(
    bundleUrl("2026-06-19"),
    "/api/tv/daily-bundle?date=2026-06-19&timeZone=Asia%2FShanghai"
  );
});

test("venueQuery and venueBody prefer venueId, then scoped account namespace", () => {
  assert.equal(venueQuery(mockAuthSession, false), "?venueId=venue-001");
  assert.equal(
    venueQuery({ ...mockAuthSession, venueId: "" }, false),
    "?accountNamespace=venue-alpha"
  );
  assert.equal(
    venueQuery({ ...mockAuthSession, venueId: "", accountNamespace: "super-ns" }, true),
    ""
  );
  assert.equal(
    venueQuery({ ...mockAuthSession, venueId: "" }, true, { ...mockSchedule, venueId: "", accountNamespace: "schedule-ns" }),
    "?accountNamespace=schedule-ns"
  );
  assert.deepEqual(
    venueBody(mockAuthSession, true, { commandId: "cmd-1" }, { ...mockSchedule, venueId: "venue-999" }),
    {
      commandId: "cmd-1",
      venueId: "venue-999",
      accountNamespace: "venue-alpha"
    }
  );
});
