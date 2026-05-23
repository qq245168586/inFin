import type { CoursePlan, CourseScript } from "../../models/course/types.ts";
import { createCoursePlanItem, createCoursePlanSection } from "../../models/course/factories.ts";

interface CoursePlanEditorProps {
  plan: CoursePlan;
  onUpdateScript: (updater: (current: CourseScript) => CourseScript) => void;
}

function updatePlan(
  onUpdateScript: CoursePlanEditorProps["onUpdateScript"],
  updater: (plan: CoursePlan) => CoursePlan
) {
  onUpdateScript((current) => {
    const currentPlan = current.plan || { sections: [] };
    return {
      ...current,
      plan: updater({
        sections: Array.isArray(currentPlan.sections) ? currentPlan.sections : []
      })
    };
  });
}

export default function CoursePlanEditor({ plan, onUpdateScript }: CoursePlanEditorProps) {
  const sections = Array.isArray(plan?.sections) ? plan.sections : [];

  return (
    <section className="section-card course-plan-editor">
      <div className="section-card-head">
        <div>
          <h3>课程计划</h3>
          <p className="section-copy">给会员看的课程说明，可在 Coach 端点击“计划”同步到所有 TV 屏幕。</p>
        </div>
        <button
          type="button"
          className="primary-button small"
          onClick={() =>
            updatePlan(onUpdateScript, (currentPlan) => ({
              sections: [...currentPlan.sections, createCoursePlanSection()]
            }))
          }
        >
          + 添加小节
        </button>
      </div>

      {sections.length ? (
        <div className="course-plan-section-list">
          {sections.map((section, sectionIndex) => (
            <article key={section.id} className="course-plan-section-card">
              <div className="course-plan-section-toolbar">
                <label className="field course-plan-section-title">
                  <span>小节表头 {sectionIndex + 1}</span>
                  <input
                    value={section.title}
                    placeholder="例如：TIME CAP 6' / 上肢力量 / 目标"
                    onChange={(event) =>
                      updatePlan(onUpdateScript, (currentPlan) => ({
                        sections: currentPlan.sections.map((item) =>
                          item.id === section.id ? { ...item, title: event.target.value } : item
                        )
                      }))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="danger-link"
                  onClick={() =>
                    updatePlan(onUpdateScript, (currentPlan) => ({
                      sections: currentPlan.sections.filter((item) => item.id !== section.id)
                    }))
                  }
                >
                  删除小节
                </button>
              </div>

              <div className="course-plan-items">
                {(section.items || []).map((item, itemIndex) => (
                  <div key={item.id} className="course-plan-item-row">
                    <label className="field">
                      <span>内容 {itemIndex + 1}</span>
                      <input
                        value={item.text}
                        placeholder="例如：30 DB Snatch 哑铃抓举"
                        onChange={(event) =>
                          updatePlan(onUpdateScript, (currentPlan) => ({
                            sections: currentPlan.sections.map((sectionItem) =>
                              sectionItem.id === section.id
                                ? {
                                    ...sectionItem,
                                    items: (sectionItem.items || []).map((contentItem) =>
                                      contentItem.id === item.id ? { ...contentItem, text: event.target.value } : contentItem
                                    )
                                  }
                                : sectionItem
                            )
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="danger-link"
                      onClick={() =>
                        updatePlan(onUpdateScript, (currentPlan) => ({
                          sections: currentPlan.sections.map((sectionItem) =>
                            sectionItem.id === section.id
                              ? {
                                  ...sectionItem,
                                  items: (sectionItem.items || []).filter((contentItem) => contentItem.id !== item.id)
                                }
                              : sectionItem
                          )
                        }))
                      }
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>

              <div className="section-card-footer">
                <button
                  type="button"
                  className="ghost-button small"
                  onClick={() =>
                    updatePlan(onUpdateScript, (currentPlan) => ({
                      sections: currentPlan.sections.map((item) =>
                        item.id === section.id ? { ...item, items: [...(item.items || []), createCoursePlanItem()] } : item
                      )
                    }))
                  }
                >
                  + 添加内容
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="course-plan-empty">
          还没有课程计划。点击右上角“添加小节”，就可以为这节课写一个会员可读的训练安排。
        </div>
      )}
    </section>
  );
}
