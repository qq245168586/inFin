import { useEffect, useMemo, useState } from "react";
import EmptyBlock from "../../components/EmptyBlock.tsx";
import FilterChips from "../../components/FilterChips.tsx";
import { groupCoursesByName } from "../../models/course/groupCoursesByName.ts";
import type { CourseRecord } from "../../models/course/types.ts";
import type { CourseTemplateRecord } from "../../models/templates.ts";
import { formatDate } from "../../utils/datetime.ts";
import { toggleNumberId } from "../../utils/array.ts";

interface CourseFilterState {
  name: string;
  creator: string;
  version: string;
  typeIds: number[];
}

function getTrainingCardCount(course: CourseRecord): number {
  return (
    course.summary?.trainingCardCount ??
    course.script?.training?.videoGroups?.reduce(
      (sum, group) => sum + group.screens.reduce((screenSum, screen) => screenSum + screen.videoCards.length, 0),
      0
    ) ??
    0
  );
}

function getPodCount(course: CourseRecord): number {
  return course.summary?.podCount ?? course.script?.training?.pods?.length ?? 0;
}

function getWarmupCount(course: CourseRecord): number {
  return course.summary?.warmupActionCount ?? course.script?.sections?.warmup?.items?.length ?? 0;
}

function getStationRuleItems(course: CourseRecord): Array<{ label: string; value: string }> {
  const config = course.script?.metadata?.stationRules || course.stationRules;
  return [
    { label: "Set", value: config?.set || "" },
    { label: "Work", value: config?.work || "" },
    { label: "Rest", value: config?.rest || "" },
    { label: "Switch", value: config?.switch || "" }
  ].filter((item) => item.value.trim());
}

function latestCourseInGroup(courses: CourseRecord[]): CourseRecord {
  return [...courses].sort((left, right) => {
    const timeDiff = new Date(right.updateTime || 0).getTime() - new Date(left.updateTime || 0).getTime();
    if (timeDiff !== 0) return timeDiff;
    return right.version.localeCompare(left.version);
  })[0];
}

export default function CourseLibrary({
  lessonTypes,
  lessonTypeNameById,
  courseFiltersDraft,
  onCourseFiltersDraftChange,
  onSearch,
  courses,
  filteredCourses,
  courseTemplates,
  coursePackageName,
  onOpenCourseEditor,
  onOpenCourseSimulator,
  onOpenCourseTemplateDialog,
  onRemoveCourse
}: {
  lessonTypes: Array<{ id: number; name: string }>;
  lessonTypeNameById: Map<number, string>;
  courseFiltersDraft: CourseFilterState;
  onCourseFiltersDraftChange: (updater: (current: CourseFilterState) => CourseFilterState) => void;
  onSearch: () => void;
  courses: CourseRecord[];
  filteredCourses: CourseRecord[];
  courseTemplates: CourseTemplateRecord[];
  coursePackageName: string;
  onOpenCourseEditor: (course?: CourseRecord) => void;
  onOpenCourseSimulator: (course: CourseRecord) => void;
  onOpenCourseTemplateDialog: () => void;
  onRemoveCourse: (courseId: number) => void;
}) {
  const [activeCourseSeriesName, setActiveCourseSeriesName] = useState("");
  const availableLessonTypes = useMemo(() => {
    const availableTypeIds = new Set<number>();
    courses.forEach((course) => {
      (course.typeIds || []).forEach((typeId) => availableTypeIds.add(Number(typeId)));
    });
    return lessonTypes.filter((type) => availableTypeIds.has(Number(type.id)));
  }, [courses, lessonTypes]);
  const courseGroups = useMemo(() => groupCoursesByName(filteredCourses), [filteredCourses]);
  const activeCourseSeries = activeCourseSeriesName ? courseGroups[activeCourseSeriesName] || [] : [];
  const isSeriesView = Boolean(activeCourseSeriesName && activeCourseSeries.length);
  const libraryRows = useMemo(
    () =>
      Object.entries(courseGroups).map(([name, courses]) => ({
        name,
        courses,
        representative: latestCourseInGroup(courses),
        isSeries: courses.length > 1
      })),
    [courseGroups]
  );
  const visibleCourses = isSeriesView ? activeCourseSeries : filteredCourses;

  useEffect(() => {
    if (activeCourseSeriesName && !courseGroups[activeCourseSeriesName]) {
      setActiveCourseSeriesName("");
    }
  }, [activeCourseSeriesName, courseGroups]);

  function renderCourseRow(course: CourseRecord) {
    return (
      <tr key={course.id}>
        <td>{course.id}</td>
        <td>
          <span className="course-version-badge">{course.version || "--"}</span>
        </td>
        <td>
          <div className="course-cell">
            <div className="course-cell-title">
              <strong>{course.name}</strong>
              <span className="course-inline-version">Version {course.version || "--"}</span>
            </div>
            <span>
              {getWarmupCount(course)} 热身 / {getTrainingCardCount(course)} 训练动作 / {getPodCount(course)} Pod
            </span>
          </div>
        </td>
        <td>{course.creator}</td>
        <td>
          <div className="table-tags">
            {course.typeIds.length ? (
              course.typeIds.map((typeId) => (
                <span key={typeId} className="table-tag">
                  {lessonTypeNameById.get(typeId) || `分类 ${typeId}`}
                </span>
              ))
            ) : (
              <span className="table-tag is-muted">未分类</span>
            )}
          </div>
        </td>
        <td>
          <div className="table-tags">
            {getStationRuleItems(course).length ? (
              getStationRuleItems(course).map((item) => (
                <span key={item.label} className="table-tag">
                  {item.label}: {item.value}
                </span>
              ))
            ) : (
              <span className="table-tag is-muted">未配置</span>
            )}
          </div>
        </td>
        <td className="cell-nowrap">{formatDate(course.updateTime)}</td>
        <td>
          <button type="button" className="table-link" onClick={() => onOpenCourseSimulator(course)}>
            模拟
          </button>
          <button type="button" className="table-link" onClick={() => onOpenCourseEditor(course)}>
            编辑
          </button>
          <button type="button" className="table-link danger" onClick={() => onRemoveCourse(course.id)}>
            删除
          </button>
        </td>
      </tr>
    );
  }

  function renderSeriesRow(row: { name: string; courses: CourseRecord[]; representative: CourseRecord; isSeries: boolean }) {
    if (!row.isSeries) {
      return renderCourseRow(row.representative);
    }
    const course = row.representative;
    const versions = row.courses.map((item) => item.version || "--");
    return (
      <tr key={`series-${row.name}`} className="course-series-row">
        <td>
          <span className="course-series-count">{row.courses.length}</span>
        </td>
        <td>
          <span className="course-version-badge">共 {row.courses.length} 版</span>
        </td>
        <td>
          <div className="course-cell">
            <div className="course-cell-title">
              <strong>{row.name}</strong>
              <span className="course-inline-version">Latest Version {course.version || "--"}</span>
            </div>
            <span>
              同名课程系列 · {versions.slice(0, 4).join(" / ")}
              {versions.length > 4 ? ` / +${versions.length - 4}` : ""}
            </span>
          </div>
        </td>
        <td>{course.creator}</td>
        <td>
          <div className="table-tags">
            {course.typeIds.length ? (
              course.typeIds.map((typeId) => (
                <span key={typeId} className="table-tag">
                  {lessonTypeNameById.get(typeId) || `分类 ${typeId}`}
                </span>
              ))
            ) : (
              <span className="table-tag is-muted">未分类</span>
            )}
          </div>
        </td>
        <td>
          <div className="table-tags">
            <span className="table-tag">系列课程</span>
            <span className="table-tag">最新 {formatDate(course.updateTime)}</span>
          </div>
        </td>
        <td className="cell-nowrap">{formatDate(course.updateTime)}</td>
        <td>
          <button type="button" className="primary-button small course-series-expand-button" onClick={() => setActiveCourseSeriesName(row.name)}>
            展开 {row.courses.length} 个版本
          </button>
        </td>
      </tr>
    );
  }

  return (
    <div className="page-content">
      <div className="page-section">
        <div className="section-head">
          <div>
            <p className="page-eyebrow">Course Library</p>
            <h2>课程列表</h2>
            <p className="section-copy course-package-section-copy">
              {coursePackageName ? `正在维护课程包：${coursePackageName}` : "当前账号暂未绑定课程包。"}
            </p>
          </div>
          <div className="section-head-actions">
            <button type="button" className="ghost-button" onClick={onOpenCourseTemplateDialog} disabled={!courseTemplates.length}>
              从整课模板创建
            </button>
            <button type="button" className="primary-button" onClick={() => onOpenCourseEditor()}>
              + 添加课程
            </button>
          </div>
        </div>

        <div className="filter-grid course-grid">
          <label className="field">
            <span>课程名称</span>
            <input
              value={courseFiltersDraft.name}
              onChange={(event) => onCourseFiltersDraftChange((current) => ({ ...current, name: event.target.value }))}
              placeholder="按课程名称搜索"
            />
          </label>
          <label className="field">
            <span>课程设计者</span>
            <input
              value={courseFiltersDraft.creator}
              onChange={(event) =>
                onCourseFiltersDraftChange((current) => ({ ...current, creator: event.target.value }))
              }
              placeholder="按设计者搜索"
            />
          </label>
          <label className="field">
            <span>课程版本</span>
            <input
              value={courseFiltersDraft.version}
              onChange={(event) =>
                onCourseFiltersDraftChange((current) => ({ ...current, version: event.target.value }))
              }
              placeholder="按版本搜索"
            />
          </label>
          <div className="filter-action">
            <button type="button" className="primary-button" onClick={onSearch}>
              搜索
            </button>
          </div>
        </div>

        <div className="filter-line">
          <span className="filter-label">课程类型</span>
          <FilterChips
            options={availableLessonTypes}
            selectedIds={courseFiltersDraft.typeIds}
            onToggle={(typeId) =>
              onCourseFiltersDraftChange((current) => ({ ...current, typeIds: toggleNumberId(current.typeIds, typeId) }))
            }
          />
        </div>
      </div>

      <div className="divider" />

      <div className="course-list-nav">
        {isSeriesView ? (
          <>
            <button type="button" className="ghost-button small course-list-back-button" onClick={() => setActiveCourseSeriesName("")}>
              ← 返回全部课程
            </button>
            <div>
              <strong>{activeCourseSeriesName}</strong>
              <span>{activeCourseSeries.length} 个版本</span>
            </div>
          </>
        ) : (
          <div>
            <strong>全部课程</strong>
            <span>{filteredCourses.length} 个课程 · 同名课程已自动折叠</span>
          </div>
        )}
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>课程序号</th>
              <th>课程版本</th>
              <th>课程名称</th>
              <th>课程设计者</th>
              <th>课程类型</th>
              <th>Rule</th>
              <th>最后更新时间</th>
              <th>管理</th>
            </tr>
          </thead>
          <tbody>
            {visibleCourses.length ? (
              isSeriesView ? activeCourseSeries.map(renderCourseRow) : libraryRows.map(renderSeriesRow)
            ) : (
              <tr>
                <td colSpan={8}>
                  <EmptyBlock title="没有找到匹配课程" copy="可以调整筛选条件，或者新增一个课程版本。" />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
