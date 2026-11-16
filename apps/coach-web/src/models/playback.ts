export type CoachSessionState = "IDLE" | "PREVIEW" | "SCHEDULED" | "RUNNING" | "PAUSED" | "ENDED" | "TERMINATED";
export type ActiveCoachSessionState = Exclude<CoachSessionState, "IDLE">;

export interface PlaybackSession {
  id: string;
  accountNamespace?: string;
  state: ActiveCoachSessionState;
  version: number;
  scheduleId: string;
  courseId: number;
  courseName?: string;
  bundleChecksum: string;
  scheduledStartAtMs: number;
  serverStartAtMs: number;
  pausedAccumulatedMs: number;
  pausedAtMs: number;
  endedAtMs?: number;
  terminatedAtMs?: number;
  elapsedMs?: number;
  serverNowMs: number;
  updatedAtMs?: number;
  startDelayMs?: number;
  lastCommandId?: string;
  lastCommand?: {
    commandId?: string;
    action?: string;
    state?: string;
    resultVersion?: number;
  } | null;
}

export interface PlaybackSessionEnvelope {
  ok?: boolean;
  serverNowMs?: number;
  session?: PlaybackSession | null;
  data?: PlaybackSession | null;
  mqtt?: {
    errors?: string[];
  };
}

