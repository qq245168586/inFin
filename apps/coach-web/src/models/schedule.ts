export interface WeekScheduleRecord {
  id: number;
  venueId?: string;
  coursePackageId?: number;
  courseId: number;
  courseName: string;
  version: string;
  beginTime: string;
  duration: number;
}

export interface ScheduleCollection {
  currentWeek: WeekScheduleRecord[];
  lastWeek: WeekScheduleRecord[];
  history: WeekScheduleRecord[];
}

export interface MetaPayload {
  schedules: ScheduleCollection;
}

export interface CoachWeekDay {
  key: string;
  label: string;
  dayNumber: string;
  scheduleCount: number;
}

export interface TvDailyBundle {
  date: string;
  timeZone: string;
  checksum: string;
  generatedAt: string;
  coursePackageId?: number;
  scheduleCount: number;
  schedules: TvDailySchedule[];
}

export interface TvDailySchedule {
  id: number;
  venueId?: string;
  accountNamespace?: string;
  coursePackageId?: number;
  courseId: number;
  courseName: string;
  version: string;
  beginTime: string;
  duration: number;
  contentChecksum?: string;
  course?: {
    script?: CoachCourseScript;
  };
}

export interface CoachCourseScript {
  training?: {
    videoGroups?: CoachVideoGroup[];
    pods?: CoachPod[];
  };
}

export interface CoachVideoGroup {
  id: string;
  name: string;
  screenCount: number;
  screens: CoachVideoGroupScreen[];
}

export interface CoachVideoGroupScreen {
  id: string;
  screenIndex: number;
  videoCards: CoachVideoCard[];
}

export interface CoachVideoCard {
  id: string;
  actionId: string;
  actionName: string;
  stationNumber: string;
  mediaUrl?: string;
  videoUrl?: string;
  url?: string;
  media?: {
    url?: string;
    src?: string;
  };
  video?: {
    url?: string;
    src?: string;
  };
}

export interface CoachPod {
  id: string;
  name: string;
  videoGroupId: string;
}

export interface CoachPreviewItem {
  id: string;
  mediaUrl: string;
  actionName: string;
}

export interface CoursePackageRecord {
  id: number;
  name: string;
  description?: string;
  courseIds?: number[];
  isDefault?: boolean;
}

export interface VenueCoursePackagesPayload {
  venue: {
    id: string;
    name: string;
    accountNamespace: string;
    activeCoursePackageId?: number;
  };
  packages: CoursePackageRecord[];
  activeCoursePackageId?: number;
}
