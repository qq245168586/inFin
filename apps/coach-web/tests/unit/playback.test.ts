import assert from "node:assert/strict";
import { test } from "vitest";
import { mockPlaybackEnvelope } from "../fixtures/coachData.ts";
import { activeSessionState, buildScheduleBadge, normalizePlaybackSession, sessionStateLabel } from "../../src/utils/playback.ts";

test("activeSessionState accepts known states case-insensitively and falls back to IDLE", () => {
  assert.equal(activeSessionState("running"), "RUNNING");
  assert.equal(activeSessionState("Paused"), "PAUSED");
  assert.equal(activeSessionState("unknown"), "IDLE");
  assert.equal(activeSessionState(null), "IDLE");
});

test("normalizePlaybackSession accepts either session or data envelopes and fills defensive defaults", () => {
  const normalized = normalizePlaybackSession({
    serverNowMs: 123_456,
    data: {
      ...mockPlaybackEnvelope.session!,
      state: "unexpected" as never,
      accountNamespace: undefined,
      scheduleId: undefined as never,
      courseId: undefined as never,
      version: 0
    }
  });

  assert.equal(normalized?.id, "session-101");
  assert.equal(normalized?.state, "PREVIEW");
  assert.equal(normalized?.accountNamespace, "");
  assert.equal(normalized?.scheduleId, "");
  assert.equal(normalized?.courseId, 0);
  assert.equal(normalized?.version, 1);
  assert.equal(normalized?.serverNowMs, 123_456);
});

test("normalizePlaybackSession rejects empty envelopes without an id", () => {
  assert.equal(normalizePlaybackSession(null), null);
  assert.equal(normalizePlaybackSession({ ok: true, session: null }), null);
  assert.equal(normalizePlaybackSession({ data: { ...mockPlaybackEnvelope.session!, id: "" } }), null);
});

test("session labels and schedule badges map TV playback states to coach-facing copy", () => {
  assert.equal(sessionStateLabel("SCHEDULED"), "SYNCING");
  assert.equal(sessionStateLabel("RUNNING"), "LIVE");
  assert.equal(sessionStateLabel("TERMINATED"), "ENDED");
  assert.deepEqual(buildScheduleBadge("IDLE"), { label: "可开课", tone: "idle" });
  assert.deepEqual(buildScheduleBadge("PAUSED"), { label: "PAUSED", tone: "paused" });
});
