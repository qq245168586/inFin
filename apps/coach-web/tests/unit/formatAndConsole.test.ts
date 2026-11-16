import assert from "node:assert/strict";
import { test, beforeEach, afterEach, vi } from "vitest";
import { browserFixture } from "../../../../packages/shared/tests/browser-fixture";
beforeEach(() => vi.stubGlobal("window", browserFixture()));
afterEach(() => vi.unstubAllGlobals());
import { mockAuthSession, mockSchedule } from "../fixtures/coachData.ts";
import { bundleUrl, fetchVenueCoursePackages, switchActiveCoursePackage, venueBody, venueQuery } from "../../src/services/consoleService.ts";
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

test("fetchVenueCoursePackages normalizes legacy items payload", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(
    JSON.stringify({
      data: {
        venueId: "venue-a",
        venueName: "Venue A",
        accountNamespace: "venue-alpha",
        activeCoursePackageId: 2,
        items: [{ id: 2, name: "Hybrid" }]
      }
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )) as typeof fetch;

  try {
    const payload = await fetchVenueCoursePackages(mockAuthSession);
    assert.equal(payload.venue.id, "venue-a");
    assert.equal(payload.venue.name, "Venue A");
    assert.equal(payload.activeCoursePackageId, 2);
    assert.deepEqual(payload.packages.map((item) => item.name), ["Hybrid"]);
    assert.deepEqual(payload.items?.map((item) => item.id), [2]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("switchActiveCoursePackage preserves server warning after persisted switch", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(
    JSON.stringify({
      data: {
        venueId: "venue-a",
        venueName: "Venue A",
        accountNamespace: "venue-alpha",
        activeCoursePackageId: 2,
        packages: [{ id: 2, name: "Hybrid" }]
      },
      warning: "课程包已保存，但 MQTT 发布失败。"
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )) as typeof fetch;

  try {
    const payload = await switchActiveCoursePackage(mockAuthSession, 2, "cmd-1");
    assert.equal(payload.activeCoursePackageId, 2);
    assert.equal(payload.warning, "课程包已保存，但 MQTT 发布失败。");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
