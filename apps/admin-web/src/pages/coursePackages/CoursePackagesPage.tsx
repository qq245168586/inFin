import { useEffect, useMemo, useState } from "react";
import { fetchCoursePackages, saveCoursePackage, deleteCoursePackage } from "../venues/api.ts";
import type { CoursePackageRecord, NoticeFn } from "../venues/types.ts";

interface PackageDraft {
  id: number | null;
  name: string;
  description: string;
}

const emptyDraft: PackageDraft = {
  id: null,
  name: "",
  description: ""
};

export default function CoursePackagesPage({
  authHeader,
  onNotice,
  onReloadMeta
}: {
  authHeader: string;
  onNotice: NoticeFn;
  onReloadMeta: () => Promise<void>;
}) {
  const [packages, setPackages] = useState<CoursePackageRecord[]>([]);
  const [activePackageId, setActivePackageId] = useState<number | null>(null);
  const [draft, setDraft] = useState<PackageDraft>(emptyDraft);
  const [loading, setLoading] = useState("");

  const activePackage = useMemo(
    () => packages.find((item) => Number(item.id) === Number(activePackageId)) || null,
    [activePackageId, packages]
  );

  async function reloadPackages() {
    setLoading("正在加载课程包...");
    try {
      const next = await fetchCoursePackages(authHeader);
      setPackages(next);
      const selected = activePackageId ? next.find((item) => Number(item.id) === Number(activePackageId)) : null;
      const fallback = selected || next[0] || null;
      setActivePackageId(fallback ? Number(fallback.id) : null);
      if (fallback) {
        setDraft({
          id: Number(fallback.id),
          name: fallback.name || "",
          description: fallback.description || ""
        });
      } else {
        setDraft(emptyDraft);
      }
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "加载课程包失败。", "error");
    } finally {
      setLoading("");
    }
  }

  useEffect(() => {
    void reloadPackages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authHeader]);

  function selectPackage(pkg: CoursePackageRecord) {
    setActivePackageId(Number(pkg.id));
    setDraft({
      id: Number(pkg.id),
      name: pkg.name || "",
      description: pkg.description || ""
    });
  }

  function startCreate() {
    setActivePackageId(null);
    setDraft(emptyDraft);
  }

  async function handleSave() {
    if (!draft.name.trim()) {
      onNotice("课程包名称不能为空。", "error");
      return;
    }
    setLoading("正在保存课程包...");
    try {
      const saved = await saveCoursePackage(authHeader, {
        id: draft.id || undefined,
        name: draft.name.trim(),
        description: draft.description.trim()
      });
      await Promise.all([reloadPackages(), onReloadMeta()]);
      setActivePackageId(Number(saved.id));
      setDraft({
        id: Number(saved.id),
        name: saved.name || "",
        description: saved.description || ""
      });
      onNotice("课程包已保存。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "保存课程包失败。", "error");
    } finally {
      setLoading("");
    }
  }

  async function handleDelete() {
    if (!activePackage || activePackage.isDefault) return;
    if (!window.confirm(`确认删除课程包「${activePackage.name}」吗？`)) return;
    setLoading("正在删除课程包...");
    try {
      await deleteCoursePackage(authHeader, Number(activePackage.id));
      await Promise.all([reloadPackages(), onReloadMeta()]);
      onNotice("课程包已删除。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "删除课程包失败。", "error");
    } finally {
      setLoading("");
    }
  }

  return (
    <div className="venue-shell">
      <div className="venue-top">
        <div className="venue-top-title">
          <h2>课程包管理</h2>
          <p>课程包用于绑定场馆和授权编课人员；课程内容在课程端按当前课程包独立维护。</p>
        </div>
        <div className="venue-top-actions">
          <button type="button" className="ghost-button" onClick={() => void reloadPackages()}>
            刷新
          </button>
          <button type="button" className="primary-button" onClick={startCreate}>
            + 新建课程包
          </button>
        </div>
      </div>

      <section className="venue-grid course-package-grid">
        <div className="venue-panel">
          <div className="venue-panel-head">
            <strong>课程包</strong>
            <span className="venue-muted">{packages.length} 个</span>
          </div>
          <div className="venue-list-items">
            {packages.length ? (
              packages.map((pkg) => (
                <button
                  key={pkg.id}
                  type="button"
                  className={`venue-list-item ${Number(pkg.id) === Number(activePackageId) ? "is-active" : ""}`}
                  onClick={() => selectPackage(pkg)}
                >
                  <strong>{pkg.name}</strong>
                  <span className="venue-list-sub">
                    {pkg.courseCount || 0} 节课 {pkg.isDefault ? "· 默认" : ""}
                  </span>
                </button>
              ))
            ) : (
              <div className="venue-empty">还没有课程包。</div>
            )}
          </div>
        </div>

        <div className="venue-panel venue-detail">
          <div className="venue-panel-head">
            <div>
              <strong>{draft.id ? "编辑课程包" : "新建课程包"}</strong>
            </div>
            <div className="venue-top-actions">
              {activePackage && !activePackage.isDefault ? (
                <button type="button" className="danger-button" onClick={() => void handleDelete()}>
                  删除
                </button>
              ) : null}
              <button type="button" className="primary-button" onClick={() => void handleSave()}>
                保存
              </button>
            </div>
          </div>

          <div className="venue-detail-body">
            <div className="venue-card">
              <div className="course-package-form">
                <label className="field">
                  <span>课程包名称</span>
                  <input
                    value={draft.name}
                    onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                    placeholder="例如：拳击课程包"
                  />
                </label>
                <label className="field">
                  <span>说明</span>
                  <textarea
                    value={draft.description}
                    onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                    placeholder="这个课程包服务的训练方向、场馆或使用说明"
                    rows={3}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </section>

      {loading ? <div className="busy-mask">{loading}</div> : null}
    </div>
  );
}
