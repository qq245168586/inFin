import type { AuthSession } from "../../src/models/common.ts";
import type { PlaybackSessionEnvelope } from "../../src/models/playback.ts";
import type { TvDailySchedule, WeekScheduleRecord } from "../../src/models/schedule.ts";
import type { TvScreensPayload } from "../../src/models/screens.ts";

export const mockAuthSession: AuthSession = {
  id: 7,
  username: "coach.demo",
  nickname: "Demo Coach",
  avatar: "",
  gender: "unknown",
  accountNamespace: "venue-alpha",
  environmentLabel: "test",
  gymName: "Infini Studio",
  role: "coach",
  venueId: "venue-001",
  venueName: "Main Venue",
  access_token: "access-token",
  refresh_token: "refresh-token",
  token_type: "Bearer",
  expires_in: 3600
};

export const mockSchedule: TvDailySchedule = {
  id: 101,
  venueId: "venue-001",
  accountNamespace: "venue-alpha",
  coursePackageId: 3,
  courseId: 9001,
  courseName: "Power Flow",
  version: "v12",
  date: "2026-06-19",
  beginTime: "2026-06-19T20:30:00+08:00",
  duration: 75,
  description: "Evening class",
  topic: "strength",
  rotationType: "LANE",
  contentChecksum: "checksum-101",
  course: {
    script: {
      metadata: {
        name: "Power Flow",
        topic: "strength",
        rotationType: "LANE",
        trainingPanel: {
          workSeconds: 45,
          restSeconds: 15
        }
      },
      training: {
        videoGroups: [
          {
            id: "group-a",
            name: "Main",
            screenCount: 2,
            screens: [
              {
                id: "screen-2",
                screenIndex: 2,
                videoCards: [
                  {
                    id: "card-2",
                    actionId: "move-2",
                    actionName: "Lunge",
                    stationNumber: "2",
                    video: { src: "https://cdn.example.test/lunge.mp4" }
                  }
                ]
              },
              {
                id: "screen-1",
                screenIndex: 1,
                videoCards: [
                  {
                    id: "card-1",
                    actionId: "move-1",
                    actionName: "Squat",
                    stationNumber: "1",
                    mediaUrl: "https://cdn.example.test/squat.mp4"
                  },
                  {
                    id: "card-empty",
                    actionId: "move-empty",
                    actionName: "No media",
                    stationNumber: "1"
                  }
                ]
              }
            ]
          }
        ],
        pods: []
      }
    }
  }
};

export const weekSchedules: WeekScheduleRecord[] = [
  {
    id: 201,
    venueId: "venue-001",
    courseId: 9001,
    courseName: "Monday Strength",
    version: "v1",
    beginTime: "2026-06-15T08:00:00+08:00",
    duration: 45
  },
  {
    id: 202,
    venueId: "venue-001",
    courseId: 9002,
    courseName: "Monday Mobility",
    version: "v1",
    beginTime: "2026-06-15T19:00:00+08:00",
    duration: 60
  },
  {
    id: 203,
    venueId: "venue-001",
    courseId: 9003,
    courseName: "Sunday Reset",
    version: "v1",
    beginTime: "2026-06-21T10:00:00+08:00",
    duration: 50
  }
];

export const mockPlaybackEnvelope: PlaybackSessionEnvelope = {
  ok: true,
  serverNowMs: 1_797_480_000_000,
  session: {
    id: "session-101",
    accountNamespace: "venue-alpha",
    state: "RUNNING",
    version: 2,
    scheduleId: "101",
    courseId: 9001,
    courseName: "Power Flow",
    bundleChecksum: "checksum-101",
    scheduledStartAtMs: 1_797_658_200_000,
    serverStartAtMs: 1_797_658_200_000,
    pausedAccumulatedMs: 0,
    pausedAtMs: 0,
    serverNowMs: 1_797_480_000_000
  }
};

export const mockScreensPayload: TvScreensPayload = {
  generatedAt: "2026-06-19T12:00:00+08:00",
  screens: [
    {
      screenNumber: 1,
      orientation: "VERTICAL",
      accountNamespace: "venue-alpha",
      deviceId: "tv-001",
      mqttClientId: "tv-client-001",
      appVersion: "1.0.0",
      platform: "android-tv",
      boundAt: "2026-06-01T08:00:00+08:00",
      lastSeenAt: "2026-06-19T12:00:00+08:00",
      online: true,
      playbackState: "RUNNING",
      activeScheduleId: "101",
      previewMode: false,
      playbackSessionId: "session-101",
      bundleChecksum: "checksum-101",
      playbackElapsedMs: 120_000,
      updateState: "DOWNLOADING",
      updateTargetVersion: "1.0.1",
      updateProgressPercent: 40,
      updateMessage: "Downloading",
      cacheBytes: 1_572_864,
      cacheFileCount: 4,
      cacheUpdatedAt: "2026-06-19T11:50:00+08:00"
    }
  ]
};
