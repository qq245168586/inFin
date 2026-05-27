import { useEffect, useMemo, useState } from "react";
import type { NoticeFn, TvScreenSnapshot, VenueRecord } from "../venues/types.ts";
import { bindTvDeviceToVenue, fetchTvDevices, fetchVenues, unbindTvDevice } from "../venues/api.ts";

type DeviceBindDraft = {
  venueId: string;
  screenNumber: number;
};

function formatTime(value?: string): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getDeviceVenueLabel(device: TvScreenSnapshot): string {
  if (device.venueName) return device.venueName;
  if (device.accountNamespace) return device.accountNamespace;
  return "未绑定";
}

function getDevicePreviousVenueLabel(device: TvScreenSnapshot): string {
  if (device.previousVenueName) return device.previousVenueName;
  if (device.previousAccountNamespace) return device.previousAccountNamespace;
  return "--";
}

export default function DeviceManagementPage({
  authHeader,
  onNotice
}: {
  authHeader: string;
  onNotice: NoticeFn;
}) {
  const [venues, setVenues] = useState<VenueRecord[]>([]);
  const [devices, setDevices] = useState<TvScreenSnapshot[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [loading, setLoading] = useState("");
  const [bindDrafts, setBindDrafts] = useState<Record<string, DeviceBindDraft>>({});

  const venueById = useMemo(() => new Map(venues.map((venue) => [venue.id, venue])), [venues]);

  async function reload(signal?: AbortSignal) {
    setLoading("正在加载设备...");
    try {
      const [nextVenues, nextDevices] = await Promise.all([
        fetchVenues(authHeader, signal),
        fetchTvDevices(authHeader, { venueId: selectedVenueId, onlineOnly }, signal)
      ]);
      setVenues(nextVenues);
      setDevices(nextDevices.devices || []);
      setBindDrafts((current) => {
        const next: Record<string, DeviceBindDraft> = { ...current };
        const defaultVenueId = selectedVenueId || nextVenues[0]?.id || "";
        for (const device of nextDevices.devices || []) {
          if (!next[device.deviceId]) {
            next[device.deviceId] = {
              venueId: device.venueId || defaultVenueId,
              screenNumber: device.screenNumber && device.screenNumber > 0 ? device.screenNumber : 1
            };
          }
        }
        return next;
      });
    } catch (error) {
      if (!signal?.aborted) {
        onNotice(error instanceof Error ? error.message : "加载设备失败。", "error");
      }
    } finally {
      if (!signal?.aborted) {
        setLoading("");
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authHeader, selectedVenueId, onlineOnly]);

  function updateDraft(deviceId: string, patch: Partial<DeviceBindDraft>) {
    setBindDrafts((current) => ({
      ...current,
      [deviceId]: {
        venueId: patch.venueId ?? current[deviceId]?.venueId ?? selectedVenueId ?? venues[0]?.id ?? "",
        screenNumber: patch.screenNumber ?? current[deviceId]?.screenNumber ?? 1
      }
    }));
  }

  async function handleBind(device: TvScreenSnapshot) {
    const draft = bindDrafts[device.deviceId];
    if (!draft?.venueId) {
      onNotice("请选择要绑定的场馆。", "error");
      return;
    }
    if (!draft.screenNumber || draft.screenNumber < 1 || draft.screenNumber > 5) {
      onNotice("请选择 1-5 的屏幕编号。", "error");
      return;
    }
    const venue = venueById.get(draft.venueId);
    if (!window.confirm(`确认把 ${device.deviceId} 绑定到 ${venue?.name || draft.venueId} 的屏幕 ${draft.screenNumber} 吗？`)) {
      return;
    }
    setLoading("正在绑定设备...");
    try {
      await bindTvDeviceToVenue(authHeader, device.deviceId, draft.venueId, draft.screenNumber);
      onNotice("设备已绑定。");
      await reload();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "绑定设备失败。", "error");
    } finally {
      setLoading("");
    }
  }

  async function handleUnbind(device: TvScreenSnapshot) {
    if (!window.confirm(`确认解绑 ${device.deviceId} 吗？解绑后 TV 会回到二维码等待绑定。`)) {
      return;
    }
    setLoading("正在解绑设备...");
    try {
      await unbindTvDevice(authHeader, device.deviceId, device.accountNamespace || "");
      onNotice("设备已解绑。");
      await reload();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "解绑设备失败。", "error");
    } finally {
      setLoading("");
    }
  }

  const boundCount = devices.filter((device) => device.bindingState !== "UNBOUND" && device.accountNamespace).length;
  const onlineCount = devices.filter((device) => device.online).length;

  return (
    <div className="device-shell">
      <div className="venue-top">
        <div className="venue-top-title">
          <h2>设备管理</h2>
          <p>查看所有 TV 盒子状态，处理未绑定设备，并按场馆筛选排查归属。</p>
        </div>
        <div className="venue-top-actions">
          <button type="button" className="ghost-button" onClick={() => void reload()}>
            刷新
          </button>
        </div>
      </div>

      <section className="device-toolbar venue-card">
        <label className="toolbar-field">
          <span>场馆过滤</span>
          <select value={selectedVenueId} onChange={(event) => setSelectedVenueId(event.target.value)}>
            <option value="">全部场馆与未绑定设备</option>
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name}
              </option>
            ))}
          </select>
        </label>
        <label className="device-check">
          <input type="checkbox" checked={onlineOnly} onChange={(event) => setOnlineOnly(event.target.checked)} />
          <span>只看在线</span>
        </label>
        <div className="device-summary">
          <span className="venue-badge">设备 {devices.length}</span>
          <span className={`venue-badge ${onlineCount ? "is-online" : ""}`}>在线 {onlineCount}</span>
          <span className="venue-badge">已绑定 {boundCount}</span>
        </div>
      </section>

      <section className="device-list">
        {devices.length ? (
          devices.map((device) => {
            const isBound = device.bindingState !== "UNBOUND" && Boolean(device.accountNamespace);
            const draft = bindDrafts[device.deviceId] || {
              venueId: selectedVenueId || venues[0]?.id || "",
              screenNumber: 1
            };
            return (
              <article key={device.deviceId} className={`device-card ${isBound ? "is-bound" : "is-unbound"}`}>
                <div className="device-card-head">
                  <div>
                    <span className="venue-muted">{isBound ? "已绑定设备" : "未绑定设备"}</span>
                    <strong>{device.deviceId}</strong>
                  </div>
                  <div className="venue-badges">
                    <span className={`venue-dot ${device.online ? "is-on" : ""}`}>{device.online ? "在线" : "离线"}</span>
                    <span className="venue-badge">{isBound ? "已绑定" : "待绑定"}</span>
                  </div>
                </div>

                <div className="device-meta">
                  <div>
                    <span>当前场馆</span>
                    <strong>{getDeviceVenueLabel(device)}</strong>
                  </div>
                  <div>
                    <span>当前屏幕</span>
                    <strong>{isBound ? `屏幕 ${device.screenNumber}` : "--"}</strong>
                  </div>
                  <div>
                    <span>上次场馆</span>
                    <strong>{getDevicePreviousVenueLabel(device)}</strong>
                  </div>
                  <div>
                    <span>上次屏幕</span>
                    <strong>{device.previousScreenNumber ? `屏幕 ${device.previousScreenNumber}` : "--"}</strong>
                  </div>
                  <div>
                    <span>版本</span>
                    <strong>{device.appVersion || "--"}</strong>
                  </div>
                  <div>
                    <span>状态</span>
                    <strong>{device.playbackState || "IDLE"}</strong>
                  </div>
                  <div>
                    <span>最后在线</span>
                    <strong>{formatTime(device.lastSeenAt)}</strong>
                  </div>
                  <div>
                    <span>解绑时间</span>
                    <strong>{formatTime(device.unboundAt)}</strong>
                  </div>
                </div>

                {isBound ? (
                  <div className="device-actions">
                    <button type="button" className="ghost-button" onClick={() => void handleUnbind(device)}>
                      解绑设备
                    </button>
                  </div>
                ) : (
                  <div className="device-bind-row">
                    <select value={draft.venueId} onChange={(event) => updateDraft(device.deviceId, { venueId: event.target.value })}>
                      <option value="">选择场馆</option>
                      {venues.map((venue) => (
                        <option key={venue.id} value={venue.id}>
                          {venue.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={draft.screenNumber}
                      onChange={(event) => updateDraft(device.deviceId, { screenNumber: Number(event.target.value) })}
                    >
                      {[1, 2, 3, 4, 5].map((screenNumber) => (
                        <option key={screenNumber} value={screenNumber}>
                          屏幕 {screenNumber}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="primary-button small" onClick={() => void handleBind(device)}>
                      绑定到场馆
                    </button>
                  </div>
                )}
              </article>
            );
          })
        ) : (
          <div className="venue-empty">当前没有匹配的 TV 设备。</div>
        )}
      </section>

      {loading ? <div className="busy-mask">{loading}</div> : null}
    </div>
  );
}
