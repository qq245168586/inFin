import jsQR from "jsqr";
import { useEffect, useMemo, useRef, useState } from "react";

type NoticeTone = "success" | "error";

interface CoachScreensPageProps {
  authSession: {
    access_token: string;
    token_type: string;
  };
  onBusyTextChange: (text: string) => void;
  onNotice: (message: string, tone?: NoticeTone) => void;
  onAuthExpired: (message?: string) => void;
}

interface TvScreenItem {
  screenNumber: number;
  orientation: "VERTICAL" | "HORIZONTAL" | "UNASSIGNED";
  accountNamespace?: string;
  deviceId: string;
  mqttClientId: string;
  appVersion: string;
  platform: string;
  boundAt: string;
  lastSeenAt: string;
  online: boolean;
  playbackState: string;
  activeScheduleId: string;
  previewMode: boolean;
  playbackSessionId: string;
  bundleChecksum: string;
  playbackElapsedMs: number;
  updateState: string;
  updateTargetVersion: string;
  updateProgressPercent: number;
  updateMessage: string;
  cacheBytes: number;
  cacheFileCount: number;
  cacheUpdatedAt: string;
}

interface TvScreensPayload {
  generatedAt: string;
  screens: TvScreenItem[];
}

interface TvScreenMutationPayload {
  ok: boolean;
  data?: TvScreenItem | null;
}

interface AppPackageRecord {
  id: number;
  platform: "tv" | "coach";
  version: string;
  label: string;
}

interface AppPackageListPayload {
  generatedAt: string;
  storageDirectory: string;
  packages: AppPackageRecord[];
}

interface AppPackageEnvelope {
  data: AppPackageListPayload;
}

interface DetectedBarcode {
  rawValue?: string;
}

interface BarcodeDetectorShape {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructorShape {
  new (options?: { formats?: string[] }): BarcodeDetectorShape;
}

const COURSE_TIME_ZONE = "Asia/Shanghai";
const POLL_INTERVAL_MS = 5000;
const HIDDEN_POLL_INTERVAL_MS = 15000;
const DEFAULT_PAIR_INPUT = "";
const DEFAULT_PAIR_SCREEN = "1";

function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  return fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  }).then(async (response) => {
    const payload = (await response.json().catch(() => null)) as T | { message?: string } | null;
    if (!response.ok) {
      throw new Error((payload as { message?: string } | null)?.message || `请求失败 (${response.status})`);
    }
    return payload as T;
  });
}

function isAuthExpiredMessage(message: string): boolean {
  return /登录已失效|重新登录|refresh token 已失效|客户端凭证无效|请求失败 \(401\)|请求失败 \(403\)/i.test(
    String(message || "")
  );
}

function formatDateTime(value?: string): string {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: COURSE_TIME_ZONE,
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
  let current = size;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }

  const precision = current >= 100 || unitIndex === 0 ? 0 : 1;
  return `${current.toFixed(precision)} ${units[unitIndex]}`;
}

function stateLabel(value: string): string {
  switch (String(value || "").toUpperCase()) {
    case "SYNCING":
      return "同步中";
    case "PREVIEW":
      return "预览中";
    case "RUNNING":
      return "上课中";
    case "PAUSED":
      return "已暂停";
    default:
      return "待机";
  }
}

function stateTone(value: string): string {
  switch (String(value || "").toUpperCase()) {
    case "SYNCING":
      return "syncing";
    case "PREVIEW":
      return "preview";
    case "RUNNING":
      return "running";
    case "PAUSED":
      return "paused";
    default:
      return "idle";
  }
}

function updateStateLabel(value: string): string {
  switch (String(value || "").toUpperCase()) {
    case "DOWNLOADING":
      return "下载中";
    case "DOWNLOADED":
      return "待安装";
    case "INSTALLING":
      return "安装中";
    case "ERROR":
      return "安装失败";
    default:
      return "待机";
  }
}

function updateStateTone(value: string): string {
  switch (String(value || "").toUpperCase()) {
    case "DOWNLOADING":
      return "syncing";
    case "DOWNLOADED":
      return "preview";
    case "INSTALLING":
      return "running";
    case "ERROR":
      return "paused";
    default:
      return "idle";
  }
}

function parsePairPayload(rawValue: string) {
  const raw = String(rawValue || "").trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "infini-tv:" && parsed.protocol !== "infini-tv-pair:") {
      return null;
    }
    const deviceId = String(parsed.searchParams.get("deviceId") || "").trim();
    const pairToken = String(parsed.searchParams.get("pairToken") || "").trim().toUpperCase();
    if (!deviceId || !pairToken) {
      return null;
    }
    return { deviceId, pairToken, raw };
  } catch {
    const fallbackMatch = raw.match(/deviceId=([^&\s]+).*pairToken=([^&\s]+)/i);
    if (!fallbackMatch) {
      return null;
    }
    return {
      deviceId: decodeURIComponent(fallbackMatch[1]).trim(),
      pairToken: decodeURIComponent(fallbackMatch[2]).trim().toUpperCase(),
      raw
    };
  }
}

function barcodeDetectorApi(): BarcodeDetectorConstructorShape | undefined {
  return (window as Window & { BarcodeDetector?: BarcodeDetectorConstructorShape }).BarcodeDetector;
}

export default function CoachScreensPage({
  authSession,
  onBusyTextChange,
  onNotice,
  onAuthExpired
}: CoachScreensPageProps) {
  const [payload, setPayload] = useState<TvScreensPayload | null>(null);
  const [packagePayload, setPackagePayload] = useState<AppPackageListPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyDeviceId, setBusyDeviceId] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [expandedScreenNumbers, setExpandedScreenNumbers] = useState<Record<number, boolean>>({});
  const [pairRawInput, setPairRawInput] = useState(DEFAULT_PAIR_INPUT);
  const [pairDeviceId, setPairDeviceId] = useState("");
  const [pairToken, setPairToken] = useState("");
  const [pairScreenNumber, setPairScreenNumber] = useState(DEFAULT_PAIR_SCREEN);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const authHeaders = useMemo(
    () => ({
      Authorization: `${authSession.token_type} ${authSession.access_token}`
    }),
    [authSession.access_token, authSession.token_type]
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorShape | null>(null);
  const frameRef = useRef<number | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scannerStartingRef = useRef(false);

  function handleRequestError(error: unknown, fallbackMessage: string) {
    const message = error instanceof Error ? error.message : fallbackMessage;
    if (isAuthExpiredMessage(message)) {
      onAuthExpired(message);
      return;
    }
    onNotice(message, "error");
  }

  async function loadScreens(showBusy = false) {
    if (showBusy) {
      onBusyTextChange("正在刷新屏幕状态...");
    }

    try {
      const nextPayload = await requestJson<TvScreensPayload>("/api/tv/screens", { headers: authHeaders });
      setPayload(nextPayload);
    } catch (error) {
      handleRequestError(error, "加载屏幕状态失败。");
    } finally {
      setLoading(false);
      if (showBusy) {
        onBusyTextChange("");
      }
    }
  }

  async function loadPackages(showBusy = false) {
    if (showBusy) {
      onBusyTextChange("正在刷新 TV 版本列表...");
    }

    try {
      const response = await requestJson<AppPackageEnvelope>("/api/app-packages?platform=tv", { headers: authHeaders });
      setPackagePayload(response.data);
    } catch (error) {
      handleRequestError(error, "加载 TV 版本失败。");
    } finally {
      if (showBusy) {
        onBusyTextChange("");
      }
    }
  }

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    async function loop(initial = false) {
      if (cancelled) {
        return;
      }

      if (initial) {
        setLoading(true);
      }

      try {
        const nextPayload = await requestJson<TvScreensPayload>("/api/tv/screens", { headers: authHeaders });
        if (!cancelled) {
          setPayload(nextPayload);
          setLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          setLoading(false);
          handleRequestError(error, "加载屏幕状态失败。");
        }
      } finally {
        if (!cancelled) {
          timer = window.setTimeout(
            () => void loop(false),
            document.visibilityState === "visible" ? POLL_INTERVAL_MS : HIDDEN_POLL_INTERVAL_MS
          );
        }
      }
    }

    void loop(true);
    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [authHeaders, onAuthExpired, onNotice]);

  useEffect(() => {
    void loadPackages(false);
  }, [authHeaders]);

  useEffect(() => {
    if (!selectedPackageId && packagePayload?.packages?.length) {
      setSelectedPackageId(String(packagePayload.packages[0].id));
    }
  }, [packagePayload, selectedPackageId]);

  function resetPairDraft(nextScreenNumber = pairScreenNumber) {
    setPairRawInput(DEFAULT_PAIR_INPUT);
    setPairDeviceId("");
    setPairToken("");
    setPairScreenNumber(nextScreenNumber);
  }

  function applyPairPayload(rawValue: string) {
    const parsed = parsePairPayload(rawValue);
    if (!parsed) {
      setScannerError("没有识别到有效的 TV 配对二维码。");
      return false;
    }

    setPairRawInput(parsed.raw);
    setPairDeviceId(parsed.deviceId);
    setPairToken(parsed.pairToken);
    setScannerError("");
    onNotice(`已识别设备 ${parsed.deviceId}，现在选择屏幕编号即可绑定。`);
    return true;
  }

  function stopScanner() {
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    detectorRef.current = null;
    setScannerOpen(false);
  }

  function getScanCanvasContext(width: number, height: number): CanvasRenderingContext2D | null {
    const canvas = scanCanvasRef.current || document.createElement("canvas");
    scanCanvasRef.current = canvas;
    canvas.width = width;
    canvas.height = height;
    return canvas.getContext("2d", { willReadFrequently: true });
  }

  async function detectRawValueWithBarcodeDetector(source: CanvasImageSource): Promise<string> {
    const Detector = barcodeDetectorApi();
    if (!Detector) {
      return "";
    }

    try {
      const detector = detectorRef.current || new Detector({ formats: ["qr_code"] });
      detectorRef.current = detector;
      const detected = await detector.detect(source);
      return detected.find((item) => item?.rawValue)?.rawValue || "";
    } catch {
      return "";
    }
  }

  function detectRawValueWithJsQr(source: CanvasImageSource, width: number, height: number): string {
    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));
    const context = getScanCanvasContext(safeWidth, safeHeight);
    if (!context) {
      return "";
    }

    context.clearRect(0, 0, safeWidth, safeHeight);
    context.drawImage(source, 0, 0, safeWidth, safeHeight);
    const imageData = context.getImageData(0, 0, safeWidth, safeHeight);
    return (
      jsQR(imageData.data, safeWidth, safeHeight, {
        inversionAttempts: "attemptBoth"
      })?.data || ""
    );
  }

  async function detectPairPayloadFromSource(
    source: CanvasImageSource,
    width: number,
    height: number
  ): Promise<string> {
    const detectorResult = await detectRawValueWithBarcodeDetector(source);
    if (detectorResult) {
      return detectorResult;
    }
    return detectRawValueWithJsQr(source, width, height);
  }

  async function startScanner() {
    if (scannerStartingRef.current || scannerOpen) {
      return;
    }

    if (!window.isSecureContext) {
      setScannerError("当前页面不是安全地址（HTTPS），浏览器会拦截摄像头。请改用 HTTPS 打开 coach 页面，或先上传二维码照片。");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerError("当前浏览器没有开放摄像头接口，请改用上传二维码照片或手动粘贴配对字符串。");
      return;
    }

    scannerStartingRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" }
        },
        audio: false
      });
      streamRef.current = stream;
      setScannerError("");
      setScannerOpen(true);

      let video: HTMLVideoElement | null = null;
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise((resolve) => {
          window.setTimeout(resolve, 50);
        });
        if (videoRef.current) {
          video = videoRef.current;
          break;
        }
      }

      if (!video) {
        throw new Error("扫码预览初始化失败。");
      }

      video.srcObject = stream;
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute("playsinline", "true");
      video.setAttribute("webkit-playsinline", "true");

      if (video.readyState < 1) {
        await new Promise<void>((resolve) => {
          const handleLoaded = () => {
            video.removeEventListener("loadedmetadata", handleLoaded);
            resolve();
          };

          video.addEventListener("loadedmetadata", handleLoaded, { once: true });
          window.setTimeout(() => {
            video.removeEventListener("loadedmetadata", handleLoaded);
            resolve();
          }, 1200);
        });
      }

      await video.play().catch(() => undefined);

      const scanLoop = async () => {
        const currentVideo = videoRef.current;
        if (!currentVideo) {
          return;
        }

        try {
          if (currentVideo.readyState >= 2) {
            const firstRawValue = await detectPairPayloadFromSource(
              currentVideo,
              currentVideo.videoWidth || currentVideo.clientWidth || 1280,
              currentVideo.videoHeight || currentVideo.clientHeight || 720
            );
            if (firstRawValue && applyPairPayload(firstRawValue)) {
              stopScanner();
              return;
            }
          }
        } catch {
          // Ignore individual detector frame failures.
        }

        frameRef.current = window.requestAnimationFrame(() => {
          void scanLoop();
        });
      };

      void scanLoop();
    } catch (error) {
      stopScanner();
      const message = error instanceof Error ? error.message : "打开摄像头失败。";
      setScannerError(
        /secure|https|permission|denied|notallowed/i.test(message)
          ? `摄像头权限未成功打开：${message}`
          : message
      );
    } finally {
      scannerStartingRef.current = false;
    }
  }

  async function handleQrImageSelected(file: File | null) {
    if (!file) {
      return;
    }

    try {
      const imageUrl = URL.createObjectURL(file);
      const image = new Image();
      image.src = imageUrl;
      await image.decode();
      URL.revokeObjectURL(imageUrl);
      const firstRawValue = await detectPairPayloadFromSource(
        image,
        image.naturalWidth || image.width || 1,
        image.naturalHeight || image.height || 1
      );
      if (!firstRawValue || !applyPairPayload(firstRawValue)) {
        setScannerError("这张图片里没有识别到有效的 TV 配对二维码。");
        return;
      }
    } catch (error) {
      setScannerError(error instanceof Error ? error.message : "识别二维码图片失败。");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const screens = useMemo(() => {
    const next = [...(payload?.screens || [])];
    next.sort((left, right) => left.screenNumber - right.screenNumber);
    return next;
  }, [payload]);

  const managedScreens = useMemo(
    () => screens.filter((screen) => Boolean(String(screen.deviceId || "").trim())),
    [screens]
  );

  const tvPackages = useMemo(() => packagePayload?.packages || [], [packagePayload]);

  function toggleExpanded(screenNumber: number) {
    setExpandedScreenNumbers((current) => ({
      ...current,
      [screenNumber]: !current[screenNumber]
    }));
  }

  function canClearCache(screen: TvScreenItem): boolean {
    return Boolean(screen.deviceId) && screen.online && String(screen.playbackState || "").toUpperCase() === "IDLE";
  }

  async function bindScannedDevice() {
    if (!pairDeviceId || !pairToken) {
      onNotice("请先扫码，或粘贴 TV 上的配对字符串。", "error");
      return;
    }

    const targetScreenNumber = Number(pairScreenNumber);
    if (!Number.isFinite(targetScreenNumber) || targetScreenNumber < 1 || targetScreenNumber > 5) {
      onNotice("请选择有效的屏幕编号。", "error");
      return;
    }

    const occupied = screens.find((item) => item.screenNumber === targetScreenNumber && item.deviceId && item.deviceId !== pairDeviceId);
    if (
      occupied
      && !window.confirm(`屏幕 ${targetScreenNumber} 当前已绑定 ${occupied.deviceId}，继续会覆盖原绑定，确定继续吗？`)
    ) {
      return;
    }

    setBusyDeviceId(pairDeviceId);
    onBusyTextChange(`正在把 ${pairDeviceId} 绑定到屏幕 ${targetScreenNumber}...`);

    try {
      await requestJson<TvScreenMutationPayload>("/api/tv/screens/pair-bind", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          deviceId: pairDeviceId,
          pairToken,
          screenNumber: targetScreenNumber
        })
      });
      await loadScreens(false);
      onNotice(`已把 ${pairDeviceId} 绑定到屏幕 ${targetScreenNumber}。`);
      resetPairDraft(String(targetScreenNumber));
    } catch (error) {
      handleRequestError(error, "绑定屏幕失败。");
    } finally {
      setBusyDeviceId("");
      onBusyTextChange("");
    }
  }

  async function unbindScreen(screen: TvScreenItem) {
    if (!screen.deviceId) {
      return;
    }
    if (!window.confirm(`确定解绑 ${screen.deviceId} 吗？解绑后 TV 会回到二维码待绑定页面。`)) {
      return;
    }

    setBusyDeviceId(screen.deviceId);
    onBusyTextChange(`正在解绑 ${screen.deviceId}...`);

    try {
      await requestJson<TvScreenMutationPayload>("/api/tv/screens/unbind", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          deviceId: screen.deviceId
        })
      });
      await loadScreens(false);
      onNotice(`已解绑 ${screen.deviceId}。`);
    } catch (error) {
      handleRequestError(error, "解绑屏幕失败。");
    } finally {
      setBusyDeviceId("");
      onBusyTextChange("");
    }
  }

  async function clearDeviceCache(screen: TvScreenItem) {
    if (!screen.deviceId) {
      return;
    }
    if (!canClearCache(screen)) {
      onNotice("请先确保屏幕在线且处于待机状态，再执行清缓存。", "error");
      return;
    }
    if (!window.confirm(`确定清除 ${screen.deviceId} 的本地课程缓存吗？`)) {
      return;
    }

    setBusyDeviceId(screen.deviceId);
    onBusyTextChange(`正在通知 ${screen.deviceId} 清理本地缓存...`);

    try {
      await requestJson<TvScreenMutationPayload>("/api/tv/screens/clear-cache", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          deviceId: screen.deviceId
        })
      });
      await loadScreens(false);
      onNotice(`已通知 ${screen.deviceId} 清理缓存。`);
    } catch (error) {
      handleRequestError(error, "清理缓存失败。");
    } finally {
      setBusyDeviceId("");
      onBusyTextChange("");
    }
  }

  async function installPackageToDevice(screen: TvScreenItem) {
    if (!screen.deviceId) {
      return;
    }
    if (!selectedPackageId) {
      onNotice("请先选择一个 TV 版本。", "error");
      return;
    }
    if (!screen.online) {
      onNotice("屏幕当前离线，暂时无法更新。", "error");
      return;
    }
    if (String(screen.playbackState || "").toUpperCase() !== "IDLE") {
      onNotice("请先确保屏幕处于待机状态，再执行更新。", "error");
      return;
    }

    const selectedPackage = tvPackages.find((item) => String(item.id) === String(selectedPackageId)) || null;
    if (!selectedPackage) {
      onNotice("没有找到所选 TV 版本。", "error");
      return;
    }
    if (!window.confirm(`确定把 ${screen.deviceId} 更新到 ${selectedPackage.version} 吗？`)) {
      return;
    }

    setBusyDeviceId(screen.deviceId);
    onBusyTextChange(`正在通知 ${screen.deviceId} 安装 ${selectedPackage.version}...`);

    try {
      await requestJson<TvScreenMutationPayload>("/api/tv/screens/install-package", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          deviceId: screen.deviceId,
          packageId: selectedPackage.id
        })
      });
      await loadScreens(false);
      onNotice(`已通知 ${screen.deviceId} 安装 ${selectedPackage.version}。`);
    } catch (error) {
      handleRequestError(error, "下发更新失败。");
    } finally {
      setBusyDeviceId("");
      onBusyTextChange("");
    }
  }

  return (
    <section className="coach-screens-page">
      <div className="coach-console-toolbar">
        <div className="coach-toolbar-copy">
          <p>Screen Manager</p>
          <strong>屏幕管理</strong>
        </div>
        <div className="coach-toolbar-actions">
          <button type="button" className="ghost-button" onClick={() => void loadPackages(true)}>
            刷新版本
          </button>
          <button type="button" className="ghost-button" onClick={() => void loadScreens(true)}>
            刷新状态
          </button>
        </div>
      </div>

      <div className="coach-screen-update-bar">
        <label className="coach-screen-select">
          <span>TV 版本</span>
          <select value={selectedPackageId} onChange={(event) => setSelectedPackageId(event.target.value)}>
            {tvPackages.length ? null : <option value="">暂无可用 TV 版本</option>}
            {tvPackages.map((appPackage) => (
              <option key={appPackage.id} value={appPackage.id}>
                {appPackage.version} · {appPackage.label}
              </option>
            ))}
          </select>
        </label>

        <div className="coach-screen-update-copy">
          <span>版本目录</span>
          <strong>{packagePayload?.storageDirectory || "--"}</strong>
        </div>
      </div>

      <div className="coach-screen-section">
        <div className="coach-screen-section-head">
          <div>
            <p>Pair TV</p>
            <strong>扫码绑定屏幕</strong>
          </div>
        </div>

        <div className="coach-pair-panel">
          <div className="coach-pair-fields">
            <label className="coach-screen-select">
              <span>配对字符串</span>
              <textarea
                value={pairRawInput}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setPairRawInput(nextValue);
                  if (!nextValue.trim()) {
                    setPairDeviceId("");
                    setPairToken("");
                    setScannerError("");
                    return;
                  }
                  applyPairPayload(nextValue);
                }}
                placeholder="扫码后会自动填入，也可以手动粘贴 infini-tv://pair?... 这段字符串"
                rows={4}
              />
            </label>

            <div className="coach-pair-inline">
              <label className="coach-screen-select">
                <span>设备 ID</span>
                <input value={pairDeviceId} readOnly placeholder="等待扫码识别" />
              </label>

              <label className="coach-screen-select">
                <span>屏幕编号</span>
                <select value={pairScreenNumber} onChange={(event) => setPairScreenNumber(event.target.value)}>
                  {[1, 2, 3, 4, 5].map((screenNumber) => (
                    <option key={screenNumber} value={String(screenNumber)}>
                      屏幕 {screenNumber}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="coach-pair-actions">
              <button type="button" className="ghost-button" onClick={() => void startScanner()}>
                打开扫码
              </button>
              <button type="button" className="ghost-button" onClick={() => fileInputRef.current?.click()}>
                上传二维码照片
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={!pairDeviceId || !pairToken || busyDeviceId === pairDeviceId}
                onClick={() => void bindScannedDevice()}
              >
                绑定到屏幕
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(event) => {
                void handleQrImageSelected(event.target.files?.[0] || null);
              }}
            />

            <div className="coach-pair-meta">
              <span>配对码</span>
              <strong>{pairToken || "--"}</strong>
            </div>
            {scannerError ? <p className="coach-pair-error">{scannerError}</p> : null}
          </div>
        </div>
      </div>

      <div className="coach-screen-section">
        <div className="coach-screen-section-head">
          <div>
            <p>Managed Screens</p>
            <strong>已管理屏幕</strong>
          </div>
        </div>

        <div className="coach-screen-grid">
          {managedScreens.length ? managedScreens.map((screen) => {
            const expanded = Boolean(expandedScreenNumbers[screen.screenNumber]);
            return (
              <article key={screen.screenNumber} className="coach-screen-card">
                <div className="coach-screen-head">
                  <div>
                    <p>{screen.orientation === "HORIZONTAL" ? "横屏信息屏" : "竖屏课程屏"}</p>
                    <strong>屏幕 {screen.screenNumber}</strong>
                  </div>
                  <span className={`coach-screen-status ${screen.online ? "is-online" : "is-offline"}`}>
                    {screen.online ? "在线" : "离线"}
                  </span>
                </div>

                <div className="coach-screen-summary">
                  <div className="coach-screen-summary-line">
                    <span>设备</span>
                    <strong>{screen.deviceId || "未绑定"}</strong>
                  </div>
                  <div className="coach-screen-summary-line">
                    <span>绑定状态</span>
                    <strong>{screen.deviceId ? "已绑定" : "未绑定"}</strong>
                  </div>
                  <div className="coach-screen-summary-line">
                    <span>播放状态</span>
                    <strong>{screen.deviceId ? stateLabel(screen.playbackState) : "--"}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="ghost-button coach-screen-collapse"
                  onClick={() => toggleExpanded(screen.screenNumber)}
                >
                  {expanded ? "收起详情" : "展开详情"}
                </button>

                {expanded ? (
                  <>
                    <div className="coach-screen-body">
                      <div className="coach-screen-item">
                        <span>设备 ID</span>
                        <strong>{screen.deviceId || "--"}</strong>
                      </div>
                      <div className="coach-screen-item">
                        <span>最近心跳</span>
                        <strong>{screen.deviceId ? formatDateTime(screen.lastSeenAt) : "--"}</strong>
                      </div>
                      <div className="coach-screen-item">
                        <span>课程状态</span>
                        <em className={`coach-screen-state is-${stateTone(screen.playbackState)}`}>
                          {screen.deviceId ? stateLabel(screen.playbackState) : "--"}
                        </em>
                      </div>
                      <div className="coach-screen-item">
                        <span>更新状态</span>
                        <em className={`coach-screen-state is-${updateStateTone(screen.updateState)}`}>
                          {screen.deviceId ? updateStateLabel(screen.updateState) : "--"}
                        </em>
                      </div>
                      <div className="coach-screen-item">
                        <span>安装版本</span>
                        <strong>{screen.deviceId ? screen.appVersion || "--" : "--"}</strong>
                      </div>
                      <div className="coach-screen-item">
                        <span>缓存占用</span>
                        <strong>{screen.deviceId ? formatStorageBytes(screen.cacheBytes) : "--"}</strong>
                      </div>
                      <div className="coach-screen-item">
                        <span>缓存文件数</span>
                        <strong>{screen.deviceId ? String(screen.cacheFileCount || 0) : "--"}</strong>
                      </div>
                    </div>

                    <div className="coach-screen-actions">
                      <button
                        type="button"
                        className="ghost-button coach-screen-action-button"
                        disabled={!screen.deviceId || busyDeviceId === screen.deviceId || !canClearCache(screen)}
                        onClick={() => void clearDeviceCache(screen)}
                      >
                        清除缓存
                      </button>
                      <button
                        type="button"
                        className="ghost-button coach-screen-action-button"
                        disabled={!screen.deviceId || busyDeviceId === screen.deviceId || !selectedPackageId || !screen.online}
                        onClick={() => void installPackageToDevice(screen)}
                      >
                        更新 TV
                      </button>
                      <button
                        type="button"
                        className="ghost-button coach-screen-action-button danger"
                        disabled={!screen.deviceId || busyDeviceId === screen.deviceId}
                        onClick={() => void unbindScreen(screen)}
                      >
                        解绑
                      </button>
                    </div>
                  </>
                ) : null}
              </article>
            );
          }) : (
            <div className="coach-empty-block is-large coach-screen-empty-block">
              当前还没有已绑定的屏幕。先用上面的扫码功能把 TV 绑定进来，这里只会显示实际已绑定的设备。
            </div>
          )}
        </div>
      </div>

      {loading ? <div className="coach-busy-mask is-inline">正在刷新屏幕状态...</div> : null}

      {scannerOpen ? (
        <div className="coach-scanner-sheet">
          <div className="coach-scanner-card">
            <div className="coach-scanner-head">
              <div>
                <p>QR Scanner</p>
                <strong>对准 TV 上的二维码</strong>
              </div>
              <button type="button" className="ghost-button" onClick={stopScanner}>
                关闭
              </button>
            </div>
            <video ref={videoRef} className="coach-scanner-video" muted playsInline autoPlay />
          </div>
        </div>
      ) : null}
    </section>
  );
}
