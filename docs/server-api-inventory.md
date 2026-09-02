# Server API Inventory

Updated: 2026-06-26

2026-08-26 addition: TV diagnostic JSONL file uploads (local implementation, not yet deployed).

This document is based on the current server request handler in `apps/server/src/interfaces/http/compat-request-handler.ts`, the generated `apps/server/openapi.json`, and client call sites in `tv-android`, `coach-web`, `course-web`, `admin-web`, and `ops-web`.

Local `apps/server/storage/mqtt-logs` did not contain JSONL records at the time of this pass, so response examples below use the current code-level response envelopes and the frontend/TV models that consume them. MQTT log response shapes are taken from `apps/server/src/services/mqtt-ops-log.ts`.

## Common Response Shapes

### JSON Envelopes

| Shape | Example | Used by |
| --- | --- | --- |
| Data envelope | `{ "data": ... }` | Most admin/content/schedule APIs |
| OK data envelope | `{ "ok": true, "data": ... }` | TV screen mutations, TV control, playback sessions |
| Legacy envelope | `{ "code": 200, "data": ..., "message": "success", "msg": "success" }` | Login, refresh, `/api/user/info`, old user APIs |
| Raw TV bundle | `{ "date": "...", "checksum": "...", "schedules": [], "resources": [] }` | TV and Coach schedule APIs |
| Error | `{ "message": "..." }` or `{ "code": 403, "message": "...", "msg": "..." }` | All JSON APIs |
| File response | Binary body | Media and APK downloads |
| SSE stream | `event: ready`, then `data: OpsEvent` | `/api/ops/mqtt/stream` |

### Core Records

```ts
type TypeOption = {
  id: number;
  name: string;
  coursePackageIds?: number[];
};

type MediaRecord = {
  id: number;
  kind: "video" | "image";
  originalName: string;
  filename: string;
  type?: string;
  mimeType?: string;
  url: string;
  storage?: "local" | "oss";
  checksum: string;
  sizeBytes: number;
  createTime: string;
  updateTime: string;
};

type ActionRecord = {
  id: number;
  name: string;
  description?: string;
  author?: string;
  ownerUsername?: string;
  typeIds: number[];
  courseTags?: string[];
  coursePackageIds?: number[];
  media: MediaRecord | null;
  createTime: string;
  updateTime: string;
};

type CourseRecord = {
  id: number;
  name: string;
  version: string;
  description: string;
  topic?: string;
  rotationType?: "REGION" | "LANE" | "SNAKE";
  stationRules?: Record<string, string>;
  coursePackageIds?: number[];
  script: CourseScript;
  createTime: string;
  updateTime: string;
};

type CourseSummary = Omit<CourseRecord, "script"> & {
  podCount?: number;
  actionCount?: number;
  estimatedDurationMs?: number;
};

type ScheduleRecord = {
  id: number;
  courseId: number;
  courseDeleted?: boolean;
  coursePackageId?: number;
  courseName: string;
  version: string;
  date?: string;
  beginTime: string;
  duration: number;
  description?: string;
  topic?: string;
  rotationType?: "REGION" | "LANE" | "SNAKE";
  stationText?: string;
};

type CoursePackageRecord = {
  id: number;
  name: string;
  description: string;
  courseIds: number[];
  courseCount: number;
  isDefault?: boolean;
  createTime: string;
  updateTime: string;
};

type VenueRecord = {
  id: string;
  name: string;
  accountNamespace: string;
  coursePackageIds?: number[];
  activeCoursePackageId?: number;
  createTime: string;
  updateTime: string;
};

type ConsoleUser = {
  id: number;
  username: string;
  nickname: string;
  avatar: string;
  gender: string;
  accountNamespace: string;
  environmentLabel: string;
  venueName: string;
  gymName: string;
  role: "superadmin" | "venue" | "editor" | string;
  venueId: string;
  coursePackageIds: number[];
  allowedClients: string[];
  password?: string;
};

type TvScreenSnapshot = {
  screenNumber: number;
  orientation: "HORIZONTAL" | "VERTICAL" | "UNASSIGNED";
  accountNamespace?: string;
  previousAccountNamespace?: string;
  previousScreenNumber?: number;
  deviceId: string;
  mqttClientId: string;
  appVersion: string;
  platform: string;
  boundAt: string;
  unboundAt?: string;
  lastSeenAt: string;
  online: boolean;
  playbackState: string;
  activeScheduleId?: string;
  previewMode?: boolean;
  playbackSessionId?: string;
  bundleChecksum?: string;
  playbackElapsedMs?: number;
  venueId?: string;
  venueName?: string;
  previousVenueId?: string;
  previousVenueName?: string;
  bindingState?: "BOUND" | "UNBOUND";
  updateState: string;
  updateTargetVersion: string;
  updateProgressPercent: number;
  updateMessage: string;
  cacheBytes: number;
  cacheFileCount: number;
  cacheUpdatedAt: string;
};

type AppPackageRecord = {
  id: number;
  platform: "tv" | "coach" | string;
  version: string;
  label: string;
  filename: string;
  originalName?: string;
  checksum: string;
  sizeBytes: number;
  notes: string;
  source?: string;
  downloadPath: string;
  createTime: string;
  updateTime: string;
};
```

### TV Bundle Records

```ts
type TvDailyBundle = {
  date: string;
  timeZone: string;
  coursePackageId: number;
  checksum: string;
  generatedAt: string;
  scheduleCount: number;
  schedules: TvDailySchedule[];
  resources: TvResource[];
};

type TvDailySchedule = ScheduleRecord & {
  contentChecksum: string;
  resources: TvResource[];
  course: CourseRecord;
};

type TvResource = {
  key: string;
  url: string;
  actionId?: string | number;
  actionName?: string;
  checksum?: string;
  sizeBytes?: number;
  extension?: string;
};

type PlaybackSession = {
  id: string;
  accountNamespace: string;
  state: "PREVIEW" | "SCHEDULED" | "RUNNING" | "PAUSED" | "ENDED" | "TERMINATED";
  version: number;
  scheduleId: string;
  courseId: number;
  duration: number;
  expectedDurationMs: number;
  expectedEndAtMs: number;
  courseName: string;
  bundleChecksum: string;
  scheduledStartAtMs: number;
  serverStartAtMs: number;
  pausedAccumulatedMs: number;
  pausedAtMs: number;
  endedAtMs: number;
  terminatedAtMs: number;
  createdBy: string;
  createdAtMs: number;
  updatedAtMs: number;
  elapsedMs: number;
  serverNowMs: number;
  startDelayMs: number;
  metadata: Record<string, unknown>;
  createTime: string;
  updateTime: string;
  endTime: string;
  lastCommandId: string;
  lastCommand: {
    commandId?: string;
    action?: string;
    state?: string;
    resultVersion?: number;
  } | null;
};
```

## API List

### Health And Auth

| Method | Path | Auth | Response | Called by / page |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | none | `{ ok, service, dbSafety, mediaStorage, tvControl, now }` | Manual/monitoring |
| POST | `/api/mqtt/auth` | MQTT password in body | `{ result: "allow" \| "deny", is_superuser, client_attrs? }` | EMQX HTTP auth hook |
| POST | `/app/login` | Basic `REDACTED_CONFIGURE_LOCALLY` | Legacy envelope with auth token | Legacy compatible clients |
| POST | `/api/app/login` | Basic `REDACTED_CONFIGURE_LOCALLY` | Legacy envelope with `{ access_token, refresh_token, token_type, expires_in }` | Admin `LoginPage`, Course `LoginPage`, Coach `LoginPage`, Ops `OpsWebApp` |
| GET/POST | `/app/refresh` | Basic `REDACTED_CONFIGURE_LOCALLY` | Legacy envelope with auth token | Legacy compatible clients |
| GET/POST | `/api/app/refresh` | Basic `REDACTED_CONFIGURE_LOCALLY` | Legacy envelope with auth token | Admin/Course/Coach/Ops session restore |
| GET | `/user/info` | Bearer | Legacy envelope with `ConsoleUser` | Legacy compatible clients |
| GET | `/api/user/info` | Bearer | Legacy envelope with `ConsoleUser` | Admin/Course/Coach/Ops auth providers |
| GET | `/user/list` | none | Legacy envelope with `ConsoleUser[]` | Legacy admin/debug |
| GET | `/api/user/list` | none | Legacy envelope with `ConsoleUser[]` | Legacy admin/debug |
| POST | `/user/insert` | none | Legacy envelope with created `ConsoleUser` | Legacy admin/debug |
| POST | `/api/user/insert` | none | Legacy envelope with created `ConsoleUser` | Legacy admin/debug |

### Meta / Bootstrap

| Method | Path | Auth | Query | Response | Called by / page |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/meta` | optional Bearer | `courseDetail=full\|true\|1`, `coursePackageId`, `courseId`, `includeSchedules`, `includeActions`, `includeTemplates` | `{ actionTypes, lessonTypes, coursePackages, actions, courses, coursesMode, templates, schedules }` | Admin `MetaProvider`; Course `MetaProvider`; Coach `metaService` if needed |
| GET | `/api/editor/bootstrap` | optional Bearer | same as `/api/meta` | Same as `/api/meta` | Legacy editor bootstrap |

### Ops / MQTT Logs

| Method | Path | Auth | Query | Response | Called by / page |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/ops/overview` | Super admin Bearer | `namespace`, `deviceId`, `topic`, `type`, `date` | `{ data: { generatedAt, filters, server, mqtt, screens, appPackages } }` | Ops `OpsWebApp` overview |
| GET | `/api/ops/mqtt/events` | Super admin Bearer | `namespace`, `deviceId`, `topic`, `type`, `date`, `limit` | `{ data: { items: OpsEvent[] } }` | Ops `OpsWebApp` log list |
| GET | `/api/ops/mqtt/stream` | Super admin Bearer or query token | `accessToken`, `tokenType`, filters | SSE stream: ready event then `OpsEvent` messages | Ops `OpsWebApp` live stream |

```ts
type OpsEvent = {
  id: string;
  receivedAt: string;
  direction: "in" | "out";
  topic: string;
  namespace: string;
  deviceId: string;
  type: string;
  payload: unknown;
};
```

### Admin Venues / Users / Course Packages

| Method | Path | Auth | Response | Called by / page |
| --- | --- | --- | --- | --- |
| GET | `/api/admin/venues` | Super admin | `{ data: VenueRecord[] }` | Admin `VenueManagementPage`, `DeviceManagementPage`; Course shared venue management |
| POST | `/api/admin/venues` | Super admin | `201 { data: VenueRecord }` | Admin/Course venue creation modal |
| PATCH | `/api/admin/venues/{venueId}` | Super admin | `{ data: VenueRecord }` | Admin venue rename |
| DELETE | `/api/admin/venues/{venueId}` | Super admin | `204 No Content` | Admin/Course venue delete |
| GET | `/api/admin/venues/{venueId}/users` | Super admin | `{ data: ConsoleUser[] }` | Admin/Course `VenueAccountsCard` |
| POST | `/api/admin/venues/{venueId}/users` | Super admin | `201 { data: ConsoleUser }` | Legacy venue-account creation |
| GET | `/api/admin/users` | Super admin | `{ data: ConsoleUser[] }`; supports `q`, `unbound=1`, `role=venue\|editor` | Admin `AccountsPage`, `VenueManagementPage`; Course shared venue management |
| POST | `/api/admin/users` | Super admin | `201 { data: ConsoleUser }` | Admin account creation; Course shared account creation |
| PATCH | `/api/admin/users/{userId}` | Super admin | `{ data: ConsoleUser }` | Admin account password/edit |
| POST | `/api/admin/venues/{venueId}/bind-user` | Super admin | `{ data: ConsoleUser }` | Admin/Course bind account to venue |
| POST | `/api/admin/users/{userId}/unbind` | Super admin | `{ data: ConsoleUser }` | Admin/Course unbind account |
| PUT | `/api/admin/users/{userId}/course-packages` | Super admin | `{ data: ConsoleUser }` | Admin account course-package permission |
| GET | `/api/admin/course-packages` | Super admin | `{ data: CoursePackageRecord[] }` | Admin `CoursePackagesPage`, `VenueManagementPage`; Course shared package page |
| POST | `/api/admin/course-packages` | Super admin | `201 { data: CoursePackageRecord }` | Admin/Course package editor |
| PATCH | `/api/admin/course-packages/{packageId}` | Super admin | `{ data: CoursePackageRecord }` | Admin/Course package editor |
| DELETE | `/api/admin/course-packages/{packageId}` | Super admin | `{ ok: boolean, message?: string }` | Admin/Course package deletion |
| GET | `/api/admin/venues/{venueId}/course-packages` | Super admin | `{ data: VenueCoursePackagesPayload }` | Admin/Course venue package binding |
| POST | `/api/admin/venues/{venueId}/course-packages` | Super admin | `{ data: VenueCoursePackagesPayload }` | Admin/Course bind package to venue |
| DELETE | `/api/admin/venues/{venueId}/course-packages/{packageId}` | Super admin | `{ data: VenueCoursePackagesPayload }` | Admin/Course unbind package from venue |
| POST | `/api/admin/venues/{venueId}/active-course-package` | Super admin | `{ data: VenueCoursePackagesPayload }` | Admin/Course set venue active package |

```ts
type VenueCoursePackagesPayload = {
  venueId: string;
  venueName?: string;
  accountNamespace?: string;
  activeCoursePackageId: number;
  running: boolean;
  venue?: VenueRecord;
  items: CoursePackageRecord[];
  packages?: CoursePackageRecord[];
};
```

### Admin TV Device Management

| Method | Path | Auth | Response | Called by / page |
| --- | --- | --- | --- | --- |
| GET | `/api/admin/venues/{venueId}/screens` | Super admin | `{ data: { generatedAt, screens, unboundDevices } }` | Admin/Course `VenueScreensCard` |
| GET | `/api/admin/tv-devices` | Super admin | `{ data: { generatedAt, devices: TvScreenSnapshot[] } }`; query `venueId`, `online=1` | Admin `DeviceManagementPage` |
| POST | `/api/admin/tv-devices/bind` | Super admin | `{ data: TvScreenSnapshot }`; also publishes `assign_screen` MQTT | Admin `DeviceManagementPage` |
| POST | `/api/admin/tv-devices/unbind` | Super admin | `{ data: TvScreenSnapshot }`; also publishes `unbind_screen` MQTT best-effort | Admin `DeviceManagementPage` |
| POST | `/api/admin/tv-control` | Super admin | `{ ok: true, data: { topic, payload, transport, gateway? } }` | Admin/Course TV package update command |

### Coach Course Package Switching

| Method | Path | Auth | Response | Called by / page |
| --- | --- | --- | --- | --- |
| GET | `/api/coach/course-packages` | Bearer | `{ data: VenueCoursePackagesPayload }` | Coach `CoachSettingsMenu`, `CoachConsolePage` |
| POST | `/api/coach/active-course-package` | Bearer | `{ data: VenueCoursePackagesPayload, warning?: string, message?: "success", msg?: "success" }`; publishes `refresh_checksum` MQTT | Coach `CoachSettingsMenu`, `CoachConsolePage` |

### TV Resources And Playback

| Method | Path | Auth | Query/body | Response | Called by / page |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/tv/daily-bundle` | none | `date`, `timeZone`, `accountNamespace`, `deviceId`, `screenNumber` | `TvDailyBundle` | TV schedule sync; Coach `CoachConsolePage` |
| POST | `/api/tv/diagnostics` | Existing device binding + `X-Infini-Pair-Token` | Raw `application/x-ndjson` file; device/namespace/screen/app-version/log-id headers | 201 or idempotent 200 `{ data: { logId, receivedAt, duplicate } }`; 400/403/413/415/429/503 errors | TV centralized diagnostic outbox; file storage only, 10-day retention; no DB mutations |
| GET | `/api/tv/daily-checksum` | none | same as daily bundle | `{ date, timeZone, checksum, generatedAt, scheduleCount, schedules: ScheduleSummary[] }` | TV periodic checksum polling |
| GET | `/api/tv/schedule-bundle` | none | `scheduleId` | `{ scheduleId, coursePackageId, generatedAt, checksum, schedule, resources }` | TV loads one schedule by remote command |
| GET | `/api/tv/playback-sessions/current` | optional Bearer | `accountNamespace`, `venueId`, `deviceId`, `screenNumber` | `{ ok: true, serverNowMs, session, data: session }` | Coach polling; TV heartbeat/session sync |
| POST | `/api/tv/course-plan/show` | Bearer | `{ commandId, courseId, scheduleId?, playbackSessionId?, accountNamespace?, venueId? }` | `{ ok: true, data: { topic, payload, transport, gateway? } }` | Coach `CoachConsolePage` show plan on TV |
| POST | `/api/tv/playback-sessions/preview` | Bearer | `{ commandId, scheduleId, courseId, scheduledStartAtMs, bundleChecksum, accountNamespace?, venueId? }` | `{ ok, serverNowMs, session, data: session, mqtt }` | Coach preview |
| POST | `/api/tv/playback-sessions/start-from-schedule` | Bearer | preview body plus optional `startDelayMs` | `{ ok, serverNowMs, session, data: session, mqtt }` | Coach start course |
| GET | `/api/tv/playback-sessions/{sessionId}` | Bearer | optional venue namespace query | `{ ok, serverNowMs, session, data: session }` | Coach/debug |
| POST | `/api/tv/playback-sessions/{sessionId}/start` | Bearer | `{ commandId, startDelayMs?, accountNamespace?, venueId? }` | `{ ok, serverNowMs, session, data: session, mqtt }` | Coach resume/start action |
| POST | `/api/tv/playback-sessions/{sessionId}/pause` | Bearer | `{ commandId, accountNamespace?, venueId? }` | `{ ok, serverNowMs, session, data: session, mqtt }` | Coach pause |
| POST | `/api/tv/playback-sessions/{sessionId}/resume` | Bearer | `{ commandId, accountNamespace?, venueId? }` | `{ ok, serverNowMs, session, data: session, mqtt }` | Coach resume |
| POST | `/api/tv/playback-sessions/{sessionId}/end` | Bearer | `{ commandId, accountNamespace?, venueId? }` | `{ ok, serverNowMs, session, data: session, mqtt }` | Coach end course |
| POST | `/api/tv/playback-sessions/{sessionId}/terminate` | Bearer | `{ commandId, reason?, accountNamespace?, venueId? }` | `{ ok, serverNowMs, session, data: session, mqtt }` | Coach force terminate |
| POST | `/api/tv/control` | Bearer | `{ type, scheduleId?, playbackSessionId?, commandId?, bundleChecksum? }` | `{ ok: true, data: { topic, payload, transport, gateway? } }` | Coach manual refresh / legacy control |

### TV Screens

| Method | Path | Auth | Response | Called by / page |
| --- | --- | --- | --- | --- |
| GET | `/api/tv/screens` | Bearer | `{ generatedAt, screens: TvScreenSnapshot[] }` | Coach `CoachScreensPage` |
| POST | `/api/tv/screens/bind` | none | `{ ok: true, data: TvScreenSnapshot }` | TV app startup bind |
| POST | `/api/tv/screens/heartbeat` | none | `{ ok: true, data: TvScreenSnapshot }` | TV periodic heartbeat |
| POST | `/api/tv/screens/pair-bind` | Bearer | `{ ok: true, data: TvScreenSnapshot }`; publishes `assign_screen` MQTT | Coach QR binding |
| POST | `/api/tv/screens/unbind` | Bearer | `{ ok: true, data: TvScreenSnapshot }`; publishes `unbind_screen` MQTT | Coach screen management |
| POST | `/api/tv/screens/reassign` | Bearer | `{ ok: true, data: TvScreenSnapshot }`; publishes `assign_screen` MQTT | Coach screen management / currently not heavily used |
| POST | `/api/tv/screens/clear-cache` | Bearer | `{ ok: true, data: { topic, payload, transport, gateway? } }` | Coach `CoachScreensPage` clear cache |
| POST | `/api/tv/screens/install-package` | Bearer | `{ ok: true, data: { topic, payload, transport, gateway?, package } }` | Coach `CoachScreensPage` install TV package |

TV bind/heartbeat body contains:

```ts
{
  accountNamespace?: string;
  deviceId: string;
  screenNumber: number;
  pairToken?: string;
  mqttClientId?: string;
  appVersion?: string;
  playbackState?: string;
  activeScheduleId?: string;
  previewMode?: boolean;
  playbackSessionId?: string;
  sessionVersion?: number;
  bundleChecksum?: string;
  playbackElapsedMs?: number;
  updateState?: string;
  updateTargetVersion?: string;
  updateProgressPercent?: number;
  updateMessage?: string;
  cacheBytes?: number;
  cacheFileCount?: number;
  cacheUpdatedAt?: string;
}
```

### App Packages

| Method | Path | Auth | Response | Called by / page |
| --- | --- | --- | --- | --- |
| GET | `/api/app-packages` | none currently | `{ data: { generatedAt, storageDirectory, packages: AppPackageRecord[] } }`; query `platform=tv` | Admin `AppVersionsPage`, Admin/Course venue TV update, Coach `CoachScreensPage`, TV app update check |
| POST | `/api/app-packages/scan` | none currently | `{ data: { generatedAt, storageDirectory, packages: AppPackageRecord[] } }` | Admin app version maintenance |
| POST | `/api/app-packages/upload` | none currently | `201 { data: AppPackageRecord }`; query `filename`, `platform`, `version`, `label`, `notes`; raw APK body | Admin `AppVersionsPage` upload |
| GET/HEAD | `/api/app-packages/files/{filename}` | none | APK binary or 404 JSON | TV app package download; manual download |

### Uploads And Media

| Method | Path | Auth | Response | Called by / page |
| --- | --- | --- | --- | --- |
| POST | `/api/upload/video` | Course web sends Bearer; server does not enforce here | `201 { data: MediaRecord }`; query `filename`, raw binary body | Course/Admin `ActionsRoute`, media upload |
| POST | `/api/upload/image` | Course web sends Bearer; server does not enforce here | `201 { data: MediaRecord }`; query `filename`, raw binary body | Course/Admin image upload |
| GET/HEAD | `/api/media/{filename}` | none | Media binary or 404 JSON | Web previews, TV resource download |
| GET/HEAD | `/api/actions/{actionId}/thumbnail` | Bearer | JPEG binary or `{ message }` | Course action thumbnail service |

### Actions / Types

| Method | Path | Auth | Response | Called by / page |
| --- | --- | --- | --- | --- |
| GET | `/api/action-types` | optional Bearer | `{ data: TypeOption[] }`; query `coursePackageId` | Admin/Course `MetaProvider`, `ActionsRoute`, type dialog |
| POST | `/api/action-types` | Bearer | `201 { data: TypeOption }` | Admin/Course `ActionsRoute`, global type dialog |
| GET | `/api/lesson-types` | optional Bearer | `{ data: TypeOption[] }`; query `coursePackageId` | Admin/Course `MetaProvider`, course editor |
| POST | `/api/lesson-types` | Bearer | `201 { data: TypeOption }` | Admin/Course global type dialog |
| GET | `/api/actions` | Bearer | `{ data: ActionRecord[] }`; query `coursePackageId` | Admin/Course `ActionsRoute`, `MetaProvider` |
| POST | `/api/actions` | Bearer | `201 { data: ActionRecord }` | Admin/Course `ActionsRoute` create |
| GET | `/api/actions/{actionId}` | Bearer | `{ data: ActionRecord }` | Action detail/debug |
| PUT | `/api/actions/{actionId}` | Bearer | `{ data: ActionRecord }` | Admin/Course `ActionsRoute` update |
| DELETE | `/api/actions/{actionId}` | Bearer | `{ ok: boolean, message?: string }` | Admin/Course `ActionsRoute` delete |

### Courses And Templates

| Method | Path | Auth | Response | Called by / page |
| --- | --- | --- | --- | --- |
| GET | `/api/courses/options` | optional Bearer | `{ data: CourseOption[] }`; query `coursePackageId` | Course editor option loading |
| GET | `/api/courses` | optional Bearer | `{ data: CourseSummary[] \| CourseRecord[], meta: { detail: "summary" \| "full" } }`; query `detail=full` | Meta/bootstrap, course list |
| POST | `/api/courses` | Bearer | `201 { data: CourseRecord }` | Admin/Course `CoursesRoute` create |
| GET | `/api/courses/{courseId}` | Bearer | `{ data: CourseRecord }` | Course `CoursesRoute`, `TemplatesPage` template-from-course |
| PUT | `/api/courses/{courseId}` | Bearer | `{ data: CourseRecord }` | Admin/Course `CoursesRoute` update |
| DELETE | `/api/courses/{courseId}` | Bearer | `{ ok: boolean, message?: string }` | Admin/Course `CoursesRoute` delete |
| GET | `/api/templates` | optional Bearer | `{ data: { warmup, cooldown, training, course } }` | Admin/Course `TemplatesPage`, `MetaProvider` |
| POST | `/api/templates` | optional Bearer | `201 { data: TemplateRecord }` | Admin/Course template save |
| GET | `/api/templates/{templateId}` | optional Bearer | `{ data: TemplateRecord }` | Template detail/debug |
| PUT | `/api/templates/{templateId}` | optional Bearer | `{ data: TemplateRecord }` | Admin/Course template update |
| DELETE | `/api/templates/{templateId}` | optional Bearer | `{ ok: boolean, message?: string }` | Admin/Course template delete |

Template collections:

```ts
type TemplateCollections = {
  warmup: Array<{ id, kind: "warmup", name, section, updateTime }>;
  cooldown: Array<{ id, kind: "cooldown", name, section, updateTime }>;
  training: Array<{ id, kind: "training", name, videoGroup, updateTime }>;
  course: Array<{ id, kind: "course", name, script?, sourceCourseId?, updateTime }>;
};
```

### Schedules

| Method | Path | Auth | Response | Called by / page |
| --- | --- | --- | --- | --- |
| GET | `/api/schedules` | optional Bearer | `{ data: ScheduleRecord[] }`; query `scope=CURRENTWEEK\|LASTWEEK\|HISTORY`, `coursePackageId` | Admin home schedule legacy flow |
| GET | `/api/schedules/week` | optional Bearer | `{ data: { date, weekStart, weekEnd, weekEndExclusive, schedules } }`; query `date`, `coursePackageId` | Course `HomePage` weekly schedule |
| POST | `/api/schedules` | Bearer | `201 { data: ScheduleRecord }` | Admin/Course schedule dialog |
| POST | `/api/schedules/copy-last-week` | Bearer | `{ data: ScheduleRecord[] }` with copied schedules | Admin/Course copy last week |
| POST | `/api/schedules/copy-week` | Bearer | `{ data: ScheduleRecord[] }` with copied schedules; 409 if target week has schedules and `replaceExisting` is false | Course copy specific week dialog |
| DELETE | `/api/schedules/{scheduleId}` | none currently enforced | `{ ok: boolean, message?: string }` | Admin/Course schedule delete |

## Client Usage Summary

### TV Android

| App area | Files | APIs |
| --- | --- | --- |
| Daily sync / cache | `TvScriptRepositoryCoreApi`, `MainActivityHorizontalScheduleController`, `MainActivityRemotePlaybackController` | `GET /api/tv/daily-bundle`, `GET /api/tv/daily-checksum`, `GET /api/tv/schedule-bundle`, media URLs |
| Playback session sync | `TvScriptRepositoryCoreApi`, `MainActivityRemotePlaybackController` | `GET /api/tv/playback-sessions/current` |
| Screen registration | `MainActivitySessionInfrastructureController`, `TvScriptRepositoryCoreApi` | `POST /api/tv/screens/bind`, `POST /api/tv/screens/heartbeat` |
| App update | `TvScriptRepositoryAppPackages`, `MainActivityPairingAndUpdateController` | `GET /api/app-packages?platform=tv`, `GET /api/app-packages/files/{filename}` |
| MQTT control | `TvMqttMessageManager`, `TvMqttManager` | Receives MQTT payloads produced by `/api/tv/control`, playback APIs, screen APIs, admin TV control |

### Coach Web

| Page / area | Files | APIs |
| --- | --- | --- |
| Login/session | `pages/LoginPage.tsx`, `services/authService.ts` | `/api/app/login`, `/api/app/refresh`, `/api/user/info` |
| Console schedule/control | `pages/CoachConsolePage.tsx`, `viewModels/useCoachConsoleViewModel.ts`, `services/consoleService.ts` | `/api/tv/daily-bundle`, `/api/tv/playback-sessions/current`, `/api/tv/playback-sessions/preview`, `/api/tv/playback-sessions/start-from-schedule`, `/api/tv/playback-sessions/{id}/{action}`, `/api/tv/course-plan/show`, `/api/tv/control` |
| Course package switch | `CoachSettingsMenu.tsx`, `useCoachConsoleViewModel.ts` | `/api/coach/course-packages`, `/api/coach/active-course-package` |
| Screen management | `pages/CoachScreensPage.tsx`, `viewModels/useScreensViewModel.ts`, `services/screensService.ts` | `/api/tv/screens`, `/api/tv/screens/pair-bind`, `/api/tv/screens/unbind`, `/api/tv/screens/clear-cache`, `/api/tv/screens/install-package`, `/api/app-packages?platform=tv` |

### Course Web

| Page / area | Files | APIs |
| --- | --- | --- |
| Login/session | `pages/auth/LoginPage.tsx`, `providers/AuthProvider.tsx` | `/api/app/login`, `/api/app/refresh`, `/api/user/info` |
| Bootstrap/meta | `providers/MetaProvider.tsx` | `/api/meta` |
| Home schedule | `pages/home/HomeRoute.tsx`, `viewmodels/home/useHomeScheduleVm.ts` | `/api/schedules/week`, `/api/schedules`, `/api/schedules/copy-week`, `/api/schedules/copy-last-week`, `/api/schedules/{id}` |
| Actions | `pages/actions/ActionsRoute.tsx` | `/api/actions`, `/api/actions/{id}`, `/api/action-types`, `/api/upload/video`, `/api/upload/image`, `/api/actions/{id}/thumbnail` |
| Courses | `pages/courses/CoursesRoute.tsx`, `viewmodels/courses/useCourseCrudVm.ts` | `/api/courses`, `/api/courses/{id}`, `/api/courses/options` |
| Templates | `pages/templates/TemplatesPage.tsx`, `viewmodels/templates/useTemplatesVm.ts` | `/api/templates`, `/api/templates/{id}`, `/api/courses/{id}` |
| Shared venue/package screens | `pages/venues/*`, `pages/coursePackages/CoursePackagesPage.tsx` | Admin venue/user/course-package APIs, `/api/admin/tv-control`, `/api/app-packages?platform=tv` |

### Admin Web

| Page / area | Files | APIs |
| --- | --- | --- |
| Login/session | `pages/auth/LoginPage.tsx`, `providers/AuthProvider.tsx` | `/api/app/login`, `/api/app/refresh`, `/api/user/info` |
| Bootstrap/meta | `providers/MetaProvider.tsx` | `/api/meta` |
| Course packages | `pages/coursePackages/CoursePackagesPage.tsx` | `/api/admin/course-packages`, `/api/admin/course-packages/{id}` |
| Venue management | `pages/venues/VenueManagementPage.tsx`, `viewmodels/venues/*` | `/api/admin/venues`, `/api/admin/venues/{id}`, `/api/admin/venues/{id}/users`, `/api/admin/venues/{id}/screens`, `/api/admin/users`, `/api/admin/venues/{id}/bind-user`, `/api/admin/users/{id}/unbind`, venue course-package APIs |
| Device management | `pages/devices/DeviceManagementPage.tsx` | `/api/admin/tv-devices`, `/api/admin/tv-devices/bind`, `/api/admin/tv-devices/unbind`, `/api/admin/venues` |
| Accounts | `AccountsPage.tsx` | `/api/admin/users`, `/api/admin/users/{id}`, `/api/admin/users/{id}/course-packages`, `/api/admin/users/{id}/unbind`, `/api/admin/venues`, `/api/admin/course-packages` |
| App versions | `pages/appVersions/*` | `/api/app-packages`, `/api/app-packages/scan`, `/api/app-packages/upload`, `/api/admin/tv-control` |
| Legacy/shared course content | `pages/actions/*`, `pages/courses/*`, `pages/templates/*` | Same content APIs as Course Web |

### Ops Web

| Page / area | Files | APIs |
| --- | --- | --- |
| Login/session | `OpsWebApp.tsx` | `/api/app/login`, `/api/app/refresh`, `/api/user/info` |
| Overview | `OpsWebApp.tsx` | `/api/ops/overview` |
| MQTT log list | `OpsWebApp.tsx` | `/api/ops/mqtt/events` |
| MQTT live stream | `OpsWebApp.tsx` | `/api/ops/mqtt/stream` |

## Notes And Gaps

- `apps/server/openapi.json` is close but misses several current routes: `/api/ops/overview`, `/api/admin/tv-devices`, `/api/admin/tv-control`, `/api/coach/course-packages`, `/api/coach/active-course-package`, `/api/tv/course-plan/show`, `/api/tv/playback-sessions/start-from-schedule`, `/api/actions/{id}/thumbnail`, `/api/schedules/week`, and `/api/mqtt/auth`.
- Several upload/package/file endpoints currently do not enforce Bearer auth in the handler, even though some clients send it.
- `/api/schedules/{scheduleId}` delete currently does not enforce auth in the handler.
- `/api/tv/daily-bundle`, `/api/tv/daily-checksum`, `/api/tv/schedule-bundle`, TV bind, and TV heartbeat are intentionally unauthenticated TV compatibility endpoints and rely on namespace/device scope.
- Local MQTT log directory existed but had no JSONL files. If production logs are available, add concrete response samples for `/api/ops/mqtt/events` and MQTT-publishing APIs from those records.
