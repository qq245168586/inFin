import { useEffect, useMemo, useState } from "react";

type NoticeTone = "success" | "error";
type AppPlatform = "tv" | "coach";

interface AppVersionsPageProps {
  tokenType: string;
  accessToken: string;
  onBusyTextChange: (text: string) => void;
  onNotice: (message: string, tone?: NoticeTone) => void;
}

interface AppPackageRecord {
  id: number;
  platform: AppPlatform;
  version: string;
  label: string;
  filename: string;
  originalName: string;
  checksum: string;
  sizeBytes: number;
  notes: string;
  source: string;
  createTime: string;
  updateTime: string;
  downloadPath: string;
}

interface AppPackageListPayload {
  generatedAt: string;
  storageDirectory: string;
  packages: AppPackageRecord[];
}

interface ApiResponse<T> {
  data: T;
  message?: string;
}

interface UploadFormState {
  platform: AppPlatform;
  version: string;
  label: string;
  notes: string;
  file: File | null;
}

interface TvScreenItem {
  screenNumber: number;
  deviceId: string;
  online: boolean;
  playbackState: string;
}

interface TvScreensPayload {
  generatedAt: string;
  screens: TvScreenItem[];
  unboundDevices?: TvScreenItem[];
}

function formatDateTime(value?: string): string {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function formatStorageBytes(value?: number): string {
  const size = Number(value || 0);
  if (!Number.isFinite(size) || size <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let unitIndex = 0;
  let current = size;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }

  const precision = current >= 100 || unitIndex === 0 ? 0 : 1;
  return `${current.toFixed(precision)} ${units[unitIndex]}`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "发生未知错误，请稍后再试。";
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;

  if (!response.ok) {
    const message = (payload as { message?: string } | null)?.message || `请求失败 (${response.status})`;
    const shouldExpire =
      (response.status === 401 || response.status === 403) &&
      (String(message || "").includes("登录已失效") || String(message || "").includes("refresh token 已失效"));
    if (shouldExpire) {
      try {
        window.dispatchEvent(new CustomEvent("infini-auth-expired", { detail: { message } }));
      } catch {
        // Ignore dispatch failures.
      }
    }
    throw new Error(message);
  }

  return payload as T;
}

export default function AppVersionsPage({ tokenType, accessToken, onBusyTextChange, onNotice }: AppVersionsPageProps) {
  const [payload, setPayload] = useState<AppPackageListPayload | null>(null);
  const [platformFilter, setPlatformFilter] = useState<AppPlatform>("tv");
  const [uploading, setUploading] = useState(false);
  const [updatingAllTv, setUpdatingAllTv] = useState(false);
  const [selectedTvPackageId, setSelectedTvPackageId] = useState("");
  const [form, setForm] = useState<UploadFormState>({
    platform: "tv",
    version: "",
    label: "",
    notes: "",
    file: null
  });

  const authHeader = `${tokenType} ${accessToken}`;

  async function loadPackages(showBusy = false) {
    if (showBusy) {
      onBusyTextChange("正在加载应用版本...");
    }

    try {
      const response = await requestJson<ApiResponse<AppPackageListPayload>>("/api/app-packages");
      setPayload(response.data);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "加载应用版本失败。", "error");
    } finally {
      if (showBusy) {
        onBusyTextChange("");
      }
    }
  }

  useEffect(() => {
    void loadPackages(false);
  }, []);

  const filteredPackages = useMemo(
    () => (payload?.packages || []).filter((item) => item.platform === platformFilter),
    [payload, platformFilter]
  );

  const tvPackages = useMemo(() => {
    const list = (payload?.packages || []).filter((item) => item.platform === "tv");
    return [...list].sort((a, b) => new Date(b.updateTime).getTime() - new Date(a.updateTime).getTime());
  }, [payload]);

  useEffect(() => {
    if (!tvPackages.length) {
      if (selectedTvPackageId) {
        setSelectedTvPackageId("");
      }
      return;
    }

    const exists = tvPackages.some((item) => String(item.id) === String(selectedTvPackageId));
    if (!exists) {
      setSelectedTvPackageId(String(tvPackages[0].id));
    }
  }, [tvPackages, selectedTvPackageId]);

  async function handleScan() {
    onBusyTextChange("正在扫描服务器安装包目录...");
    try {
      const response = await requestJson<ApiResponse<AppPackageListPayload>>("/api/app-packages/scan", {
        method: "POST"
      });
      setPayload(response.data);
      onNotice("安装包目录已刷新。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "扫描安装包目录失败。", "error");
    } finally {
      onBusyTextChange("");
    }
  }

  async function handleUpload() {
    if (!form.file) {
      onNotice("请先选择一个 APK 文件。", "error");
      return;
    }
    if (!form.version.trim()) {
      onNotice("请填写版本号。", "error");
      return;
    }

    setUploading(true);
    onBusyTextChange("正在上传安装包...");

    const params = new URLSearchParams({
      platform: form.platform,
      version: form.version.trim(),
      label: form.label.trim(),
      notes: form.notes.trim(),
      filename: form.file.name
    });

    try {
      const response = await fetch(`/api/app-packages/upload?${params.toString()}`, {
        method: "POST",
        headers: {
          "Content-Type": form.file.type || "application/vnd.android.package-archive"
        },
        body: form.file
      });

      const payload = (await response.json().catch(() => null)) as ApiResponse<AppPackageRecord> | { message?: string } | null;
      if (!response.ok) {
        throw new Error((payload as { message?: string } | null)?.message || `上传失败 (${response.status})`);
      }

      onNotice(`${form.platform.toUpperCase()} 安装包上传成功。`);
      setForm((current) => ({
        ...current,
        version: "",
        label: "",
        notes: "",
        file: null
      }));
      await loadPackages(false);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "上传安装包失败。", "error");
    } finally {
      setUploading(false);
      onBusyTextChange("");
    }
  }

  async function handleUpdateAllTvDevices() {
    if (updatingAllTv) {
      return;
    }
    if (!selectedTvPackageId) {
      onNotice("请先选择一个 TV 版本。", "error");
      return;
    }

    const selectedPackage = tvPackages.find((item) => String(item.id) === String(selectedTvPackageId)) || null;
    if (!selectedPackage) {
      onNotice("没有找到所选 TV 版本。", "error");
      return;
    }

    if (
      !window.confirm(
        `确定把本账号下所有 TV 设备更新到 ${selectedPackage.version} 吗？离线或非待机状态的屏幕会自动跳过。`
      )
    ) {
      return;
    }

    setUpdatingAllTv(true);

    try {
      onBusyTextChange("正在获取屏幕列表...");
      const screensPayload = await requestJson<TvScreensPayload>("/api/tv/screens", {
        headers: { Authorization: authHeader }
      });
      const screens = (screensPayload?.screens || []).filter((item) => String(item.deviceId || "").trim());
      if (!screens.length) {
        onNotice("当前没有已绑定的 TV 设备。", "error");
        return;
      }

      const eligible = screens.filter(
        (screen) => !!screen.online && String(screen.playbackState || "").toUpperCase() === "IDLE"
      );
      const skippedOffline = screens.filter((screen) => !screen.online);
      const skippedBusy = screens.filter(
        (screen) => screen.online && String(screen.playbackState || "").toUpperCase() !== "IDLE"
      );

      if (!eligible.length) {
        const extra =
          skippedOffline.length || skippedBusy.length
            ? `（离线 ${skippedOffline.length} 台，忙碌 ${skippedBusy.length} 台）`
            : "";
        onNotice(`没有可更新的设备：请确保屏幕在线且处于待机状态。${extra}`, "error");
        return;
      }

      const succeeded: string[] = [];
      const failed: Array<{ deviceId: string; reason: string }> = [];

      for (let index = 0; index < eligible.length; index += 1) {
        const screen = eligible[index];
        const deviceId = String(screen.deviceId || "").trim();
        if (!deviceId) {
          continue;
        }
        onBusyTextChange(
          `正在通知 ${deviceId} 安装 ${selectedPackage.version}... (${index + 1}/${eligible.length})`
        );
        try {
          await requestJson<{ ok: boolean }>("/api/tv/screens/install-package", {
            method: "POST",
            headers: { Authorization: authHeader },
            body: JSON.stringify({
              deviceId,
              packageId: selectedPackage.id
            })
          });
          succeeded.push(deviceId);
        } catch (error) {
          failed.push({ deviceId, reason: getErrorMessage(error) });
        }
      }

      const skippedCount = screens.length - eligible.length;
      const parts: string[] = [];
      parts.push(`已下发更新：${succeeded.length} 台`);
      if (failed.length) {
        parts.push(`失败：${failed.length} 台`);
      }
      if (skippedCount) {
        parts.push(`跳过：${skippedCount} 台`);
      }

      onNotice(`${parts.join("，")}（目标版本：${selectedPackage.version}）。`);

      if (failed.length) {
        const preview = failed
          .slice(0, 3)
          .map((item) => `${item.deviceId}: ${item.reason}`)
          .join("；");
        onNotice(`部分设备下发失败：${preview}${failed.length > 3 ? "…" : ""}`, "error");
      }
    } catch (error) {
      onNotice(getErrorMessage(error), "error");
    } finally {
      setUpdatingAllTv(false);
      onBusyTextChange("");
    }
  }

  return (
    <section className="versions-page">
      <div className="section-head">
        <div>
          <p className="section-kicker">APP Versions</p>
          <h2>应用版本管理</h2>
        </div>
        <div className="section-head-actions">
          <button type="button" className="ghost-button" onClick={handleScan}>
            扫描目录
          </button>
          <button type="button" className="ghost-button" onClick={() => void loadPackages(true)}>
            刷新列表
          </button>
        </div>
      </div>

      <div className="versions-summary-grid">
        <article className="versions-summary-card">
          <span>服务器目录</span>
          <strong>{payload?.storageDirectory || "--"}</strong>
        </article>
        <article className="versions-summary-card">
          <span>TV 版本数</span>
          <strong>{(payload?.packages || []).filter((item) => item.platform === "tv").length}</strong>
        </article>
        <article className="versions-summary-card">
          <span>Coach 版本数</span>
          <strong>{(payload?.packages || []).filter((item) => item.platform === "coach").length}</strong>
        </article>
        <article className="versions-summary-card">
          <span>最后刷新</span>
          <strong>{formatDateTime(payload?.generatedAt)}</strong>
        </article>
      </div>

      <div className="versions-upload-card">
        <div className="section-head compact">
          <div>
            <p className="section-kicker">Upload APK</p>
            <h2>上传安装包</h2>
          </div>
        </div>

        <div className="versions-upload-grid">
          <label>
            <span>应用类型</span>
            <select
              value={form.platform}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  platform: event.target.value as AppPlatform
                }))
              }
            >
              <option value="tv">TV</option>
              <option value="coach">Coach</option>
            </select>
          </label>

          <label>
            <span>版本号</span>
            <input
              value={form.version}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  version: event.target.value
                }))
              }
              placeholder="例如 1.0.3"
            />
          </label>

          <label>
            <span>显示名称</span>
            <input
              value={form.label}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  label: event.target.value
                }))
              }
              placeholder="例如 HYROX TV 正式版"
            />
          </label>

          <label className="versions-upload-file">
            <span>APK 文件</span>
            <input
              type="file"
              accept=".apk,application/vnd.android.package-archive"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  file: event.target.files?.[0] || null
                }))
              }
            />
          </label>

          <label className="versions-upload-notes">
            <span>备注</span>
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  notes: event.target.value
                }))
              }
              placeholder="可选：更新说明、适用场地、回滚说明"
            />
          </label>
        </div>

        <div className="versions-upload-actions">
          <button type="button" className="primary-button" onClick={handleUpload} disabled={uploading}>
            上传安装包
          </button>
          <span>以后通过 SSH 直接把 APK 放到上面的服务器目录里，再点“扫描目录”也会识别出来。</span>
        </div>
      </div>

      <div className="versions-list-card">
        <div className="versions-filter-row">
          <div className="filter-chip-group">
            <button
              type="button"
              className={`filter-chip ${platformFilter === "tv" ? "is-active" : ""}`}
              onClick={() => setPlatformFilter("tv")}
            >
              TV 版本
            </button>
            <button
              type="button"
              className={`filter-chip ${platformFilter === "coach" ? "is-active" : ""}`}
              onClick={() => setPlatformFilter("coach")}
            >
              Coach 版本
            </button>
          </div>
          {platformFilter === "tv" ? (
            <div className="versions-update-actions">
              <label className="versions-update-select">
                <span>更新到版本</span>
                <select value={selectedTvPackageId} onChange={(event) => setSelectedTvPackageId(event.target.value)}>
                  {tvPackages.length ? null : <option value="">暂无可用 TV 版本</option>}
                  {tvPackages.map((appPackage) => (
                    <option key={appPackage.id} value={appPackage.id}>
                      {appPackage.version} · {appPackage.label || appPackage.originalName || appPackage.filename}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="primary-button"
                onClick={() => void handleUpdateAllTvDevices()}
                disabled={updatingAllTv || !tvPackages.length}
              >
                一键更新全部设备
              </button>
            </div>
          ) : null}
        </div>

        <div className="table-card">
          <table>
            <thead>
              <tr>
                <th>版本号</th>
                <th>名称</th>
                <th>文件名</th>
                <th>大小</th>
                <th>来源</th>
                <th>更新时间</th>
              </tr>
            </thead>
            <tbody>
              {filteredPackages.length ? (
                filteredPackages.map((appPackage) => (
                  <tr key={appPackage.id}>
                    <td>{appPackage.version}</td>
                    <td>{appPackage.label}</td>
                    <td>{appPackage.filename}</td>
                    <td>{formatStorageBytes(appPackage.sizeBytes)}</td>
                    <td>{appPackage.source === "upload" ? "网页上传" : "目录扫描"}</td>
                    <td>{formatDateTime(appPackage.updateTime)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="table-empty">
                    暂无可用安装包版本。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
