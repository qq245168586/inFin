import type { CourseRecord } from "./types.ts";

export type CourseGroups = Record<string, CourseRecord[]>;

export function groupCoursesByName(courses: CourseRecord[]): CourseGroups {
  return courses.reduce((groups, course) => {
    const key = course.name;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(course);
    groups[key].sort((left, right) => right.version.localeCompare(left.version));
    return groups;
  }, {} as CourseGroups);
}
