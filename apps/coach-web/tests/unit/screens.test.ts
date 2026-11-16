import assert from "node:assert/strict";
import { test } from "vitest";
import { mockScreensPayload } from "../fixtures/coachData.ts";
import { parsePairPayload, stateLabel, stateTone, updateInProgress, updateStateLabel, updateStateTone } from "../../src/utils/screens.ts";

test("screen playback state helpers map known states and unknown values", () => {
  const screen = mockScreensPayload.screens[0];

  assert.equal(stateLabel(screen.playbackState), "上课中");
  assert.equal(stateTone(screen.playbackState), "running");
  assert.equal(stateLabel("offline"), "待机");
  assert.equal(stateTone("offline"), "idle");
});

test("package update helpers treat installed packages as in-progress until the TV reports idle", () => {
  assert.equal(updateStateLabel("downloading"), "下载中");
  assert.equal(updateStateTone("DOWNLOADED"), "preview");
  assert.equal(updateInProgress("INSTALLING"), true);
  assert.equal(updateInProgress("INSTALLED"), true);
  assert.equal(updateInProgress(""), false);
});

test("parsePairPayload reads supported deep links and uppercases pair tokens", () => {
  assert.deepEqual(
    parsePairPayload("infini-tv://pair?deviceId=tv-001&pairToken=ab12"),
    {
      deviceId: "tv-001",
      pairToken: "AB12",
      raw: "infini-tv://pair?deviceId=tv-001&pairToken=ab12"
    }
  );

  assert.deepEqual(
    parsePairPayload("deviceId=tv%2Fencoded&pairToken=xy-9"),
    {
      deviceId: "tv/encoded",
      pairToken: "XY-9",
      raw: "deviceId=tv%2Fencoded&pairToken=xy-9"
    }
  );
});

test("parsePairPayload rejects empty, unsupported, or incomplete QR payloads", () => {
  assert.equal(parsePairPayload(""), null);
  assert.equal(parsePairPayload("https://example.test?deviceId=tv-001&pairToken=AB12"), null);
  assert.equal(parsePairPayload("infini-tv://pair?deviceId=tv-001"), null);
});
