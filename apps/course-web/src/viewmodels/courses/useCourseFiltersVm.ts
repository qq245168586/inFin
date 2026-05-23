import { useMemo, useState } from "react";
import type { CourseRecord } from "../../models/course/types.ts";
import { matchesTypeFilter } from "./courseEditorGuards.ts";

export interface CourseFilterState {
  name: string;
  creator: string;
  version: string;
  typeIds: number[];
}

export default function useCourseFiltersVm(courses: CourseRecord[]) {
  const [draft, setDraft] = useState<CourseFilterState>({
    name: "",
    creator: "",
    version: "",
    typeIds: []
  });
  const [filters, setFilters] = useState<CourseFilterState>({
    name: "",
    creator: "",
    version: "",
    typeIds: []
  });

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const nameMatches = !filters.name || course.name.toLowerCase().includes(filters.name.toLowerCase());
      const creatorMatches = !filters.creator || course.creator.toLowerCase().includes(filters.creator.toLowerCase());
      const versionMatches = !filters.version || course.version.toLowerCase().includes(filters.version.toLowerCase());
      return nameMatches && creatorMatches && versionMatches && matchesTypeFilter(course.typeIds || [], filters.typeIds);
    });
  }, [courses, filters.creator, filters.name, filters.typeIds, filters.version]);

  function search() {
    setFilters(draft);
  }

  return { draft, setDraft, filters, setFilters, filteredCourses, search };
}
