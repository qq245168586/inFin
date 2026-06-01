import EmptyBlock from "../../components/EmptyBlock.tsx";
import FilterChips from "../../components/FilterChips.tsx";
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
  const config = course.script?.metadata?.stationRules;
  return [
    { label: "Set", value: config?.set || "" },
    { label: "Work", value: config?.work || "" },
    { label: "Rest", value: config?.rest || "" },
    { label: "Switch", value: config?.switch || "" }
  ].filter((item) => item.value.trim());
}

export default function CourseLibrary({
  lessonTypes,
  lessonTypeNameById,
  courseFiltersDraft,
  onCourseFiltersDraftChange,
  onSearch,
  filteredCourses,
  courseTemplates,
  coursePackageName,
  onOpenCourseEditor,
  onOpenCourseTemplateDialog,
  onRemoveCourse
}: {
  lessonTypes: Array<{ id: number; name: string }>;
  lessonTypeNameById: Map<number, string>;
  courseFiltersDraft: CourseFilterState;
  onCourseFiltersDraftChange: (updater: (current: CourseFilterState) => CourseFilterState) => void;
  onSearch: () => void;
  filteredCourses: CourseRecord[];
  courseTemplates: CourseTemplateRecord[];
  coursePackageName: string;
  onOpenCourseEditor: (course?: CourseRecord) => void;
  onOpenCourseTemplateDialog: () => void;
  onRemoveCourse: (courseId: number) => void;
}) {
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
            options={lessonTypes}
            selectedIds={courseFiltersDraft.typeIds}
            onToggle={(typeId) =>
              onCourseFiltersDraftChange((current) => ({ ...current, typeIds: toggleNumberId(current.typeIds, typeId) }))
            }
          />
        </div>
      </div>

      <div className="divider" />

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
            {filteredCourses.length ? (
              filteredCourses.map((course) => (
                <tr key={course.id}>
                  <td>{course.id}</td>
                  <td>{course.version}</td>
                  <td>
                    <div className="course-cell">
                      <strong>{course.name}</strong>
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
                    <button type="button" className="table-link" onClick={() => onOpenCourseEditor(course)}>
                      编辑
                    </button>
                    <button type="button" className="table-link danger" onClick={() => onRemoveCourse(course.id)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))
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
