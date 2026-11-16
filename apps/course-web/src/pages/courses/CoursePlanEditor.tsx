import DraftNumberInput from "../../components/DraftNumberInput.tsx";
import type { CoursePlan, CourseScript, ReadyDurations } from "../../models/course/types.ts";
import { createCoursePlanItem, createCoursePlanSection } from "../../models/course/factories.ts";

interface CoursePlanEditorProps {
  plan: CoursePlan;
  readyDurations: ReadyDurations;
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

function updateReadyDuration(
  onUpdateScript: CoursePlanEditorProps["onUpdateScript"],
  key: keyof ReadyDurations,
  value: number
) {
  onUpdateScript((current) => ({
    ...current,
    metadata: {
      ...current.metadata,
      readyDurations: {
        warmupSeconds: 15,
        workoutSeconds: 15,
        cooldownSeconds: 10,
        ...(current.metadata.readyDurations || {}),
        [key]: value
      }
    }
  }));
}

export default function CoursePlanEditor({ plan, readyDurations, onUpdateScript }: CoursePlanEditorProps) {
  const sections = Array.isArray(plan?.sections) ? plan.sections : [];
  const safeReadyDurations: ReadyDurations = {
    warmupSeconds: readyDurations?.warmupSeconds ?? 15,
    workoutSeconds: readyDurations?.workoutSeconds ?? 15,
    cooldownSeconds: readyDurations?.cooldownSeconds ?? 10
  };

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

      <div className="ready-duration-panel">
        <div>
          <h4>准备倒计时</h4>
          <p>这些时间会同步到 TV 端，控制每段开始前的 ready 提示。</p>
        </div>
        <div className="ready-duration-grid">
          <label className="field">
            <span>ready for warm up</span>
            <DraftNumberInput
              value={safeReadyDurations.warmupSeconds}
              minValue={0}
              commitOnBlur
              onValueChange={(value) => updateReadyDuration(onUpdateScript, "warmupSeconds", value)}
            />
          </label>
          <label className="field">
            <span>ready for workout</span>
            <DraftNumberInput
              value={safeReadyDurations.workoutSeconds}
              minValue={0}
              commitOnBlur
              onValueChange={(value) => updateReadyDuration(onUpdateScript, "workoutSeconds", value)}
            />
          </label>
          <label className="field">
            <span>ready for cool down</span>
            <DraftNumberInput
              value={safeReadyDurations.cooldownSeconds}
              minValue={0}
              commitOnBlur
              onValueChange={(value) => updateReadyDuration(onUpdateScript, "cooldownSeconds", value)}
            />
          </label>
        </div>
      </div>
    </section>
  );
}
