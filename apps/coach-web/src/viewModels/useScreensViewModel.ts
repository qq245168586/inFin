import { useEffect, useMemo, useState } from "react";
import type { AuthSession, NoticeTone } from "../models/common";
import type { AppPackageListPayload, ParsedPairPayload, TvScreenItem, TvScreensPayload } from "../models/screens";
import { bindTvScreen, clearTvCache, fetchScreens, fetchTvPackages, installTvPackage, unbindTvScreen } from "../services/screensService";
import { getErrorMessage, isAuthExpiredMessage } from "../utils/format";
import { updateInProgress } from "../utils/screens";
import { usePairScannerViewModel } from "./usePairScannerViewModel";

const POLL_INTERVAL_MS = 5000;
const HIDDEN_POLL_INTERVAL_MS = 15000;

interface ScreensVmProps {
  authSession: AuthSession;
  onBusyTextChange: (text: string) => void;
  onNotice: (message: string, tone?: NoticeTone) => void;
  onAuthExpired: (message?: string) => void;
}

export function useScreensViewModel({ authSession, onBusyTextChange, onNotice, onAuthExpired }: ScreensVmProps) {
  const [payload, setPayload] = useState<TvScreensPayload | null>(null);
  const [packagePayload, setPackagePayload] = useState<AppPackageListPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyDeviceId, setBusyDeviceId] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [expandedScreenNumbers, setExpandedScreenNumbers] = useState<Record<number, boolean>>({});
  const [pairRawInput, setPairRawInput] = useState("");
  const [pairDeviceId, setPairDeviceId] = useState("");
  const [pairToken, setPairToken] = useState("");
  const [pairScreenNumber, setPairScreenNumber] = useState("1");
  const scanner = usePairScannerViewModel(handleParsedPair);

  function handleRequestError(error: unknown, fallbackMessage: string) {
    const message = getErrorMessage(error) || fallbackMessage;
    if (isAuthExpiredMessage(message)) {
      onAuthExpired(message);
      return;
    }
    onNotice(message, "error");
  }

  async function loadScreens(showBusy = false) {
    if (showBusy) onBusyTextChange("正在刷新屏幕状态...");
    try {
      setPayload(await fetchScreens(authSession));
    } catch (error) {
      handleRequestError(error, "加载屏幕状态失败。");
    } finally {
      setLoading(false);
      if (showBusy) onBusyTextChange("");
    }
  }

  async function loadPackages(showBusy = false) {
    if (showBusy) onBusyTextChange("正在刷新 TV 版本列表...");
    try {
      setPackagePayload(await fetchTvPackages(authSession));
    } catch (error) {
      handleRequestError(error, "加载 TV 版本失败。");
    } finally {
      if (showBusy) onBusyTextChange("");
    }
  }

  function handleParsedPair(parsed: ParsedPairPayload) {
    setPairRawInput(parsed.raw);
    setPairDeviceId(parsed.deviceId);
    setPairToken(parsed.pairToken);
    scanner.setScannerError("");
    onNotice(`已识别设备 ${parsed.deviceId}，现在选择屏幕编号即可绑定。`);
  }

  function updatePairRawInput(value: string) {
    setPairRawInput(value);
    if (!value.trim()) {
      setPairDeviceId("");
      setPairToken("");
      scanner.setScannerError("");
      return;
    }
    scanner.applyPairPayload(value);
  }

  function resetPairDraft(nextScreenNumber = pairScreenNumber) {
    setPairRawInput("");
    setPairDeviceId("");
    setPairToken("");
    setPairScreenNumber(nextScreenNumber);
  }

  const screens = useMemo(() => [...(payload?.screens || [])].sort((left, right) => left.screenNumber - right.screenNumber), [payload]);
  const managedScreens = useMemo(() => screens.filter((screen) => Boolean(String(screen.deviceId || "").trim())), [screens]);
  const tvPackages = useMemo(() => packagePayload?.packages || [], [packagePayload]);

  function toggleExpanded(screenNumber: number) {
    setExpandedScreenNumbers((current) => ({ ...current, [screenNumber]: !current[screenNumber] }));
  }

  function canClearCache(screen: TvScreenItem): boolean {
    return Boolean(screen.deviceId) && screen.online && String(screen.playbackState || "").toUpperCase() === "IDLE";
  }

  async function bindScannedDevice() {
    if (!pairDeviceId || !pairToken) {
      onNotice("请先扫码，或粘贴 TV 上的配对字符串。", "error");
      return;
    }
    const screenNumber = Number(pairScreenNumber);
    if (!Number.isFinite(screenNumber) || screenNumber < 1 || screenNumber > 5) {
      onNotice("请选择有效的屏幕编号。", "error");
      return;
    }
    const occupied = screens.find((item) => item.screenNumber === screenNumber && item.deviceId && item.deviceId !== pairDeviceId);
    if (occupied && !window.confirm(`屏幕 ${screenNumber} 当前已绑定 ${occupied.deviceId}，继续会覆盖原绑定，确定继续吗？`)) return;
    await runDeviceMutation(pairDeviceId, `正在把 ${pairDeviceId} 绑定到屏幕 ${screenNumber}...`, async () => {
      await bindTvScreen(authSession, { deviceId: pairDeviceId, pairToken, screenNumber });
      await loadScreens(false);
      onNotice(`已把 ${pairDeviceId} 绑定到屏幕 ${screenNumber}。`);
      resetPairDraft(String(screenNumber));
    }, "绑定屏幕失败。");
  }

  async function unbindScreen(screen: TvScreenItem) {
    if (!screen.deviceId || !window.confirm(`确定解绑 ${screen.deviceId} 吗？解绑后 TV 会回到二维码待绑定页面。`)) return;
    await runDeviceMutation(screen.deviceId, `正在解绑 ${screen.deviceId}...`, async () => {
      await unbindTvScreen(authSession, screen.deviceId);
      await loadScreens(false);
      onNotice(`已解绑 ${screen.deviceId}。`);
    }, "解绑屏幕失败。");
  }

  async function clearDeviceCache(screen: TvScreenItem) {
    if (!screen.deviceId) return;
    if (!canClearCache(screen)) {
      onNotice("请先确保屏幕在线且处于待机状态，再执行清缓存。", "error");
      return;
    }
    if (!window.confirm(`确定清除 ${screen.deviceId} 的本地课程缓存吗？`)) return;
    await runDeviceMutation(screen.deviceId, `正在通知 ${screen.deviceId} 清理本地缓存...`, async () => {
      await clearTvCache(authSession, screen.deviceId);
      await loadScreens(false);
      onNotice(`已通知 ${screen.deviceId} 清理缓存。`);
    }, "清理缓存失败。");
  }

  async function installPackageToDevice(screen: TvScreenItem) {
    if (!screen.deviceId) return;
    const selectedPackage = tvPackages.find((item) => String(item.id) === String(selectedPackageId)) || null;
    if (!selectedPackageId) onNotice("请先选择一个 TV 版本。", "error");
    else if (!screen.online) onNotice("屏幕当前离线，暂时无法更新。", "error");
    else if (updateInProgress(screen.updateState)) onNotice("屏幕正在更新中，请等待当前更新完成。", "error");
    else if (String(screen.playbackState || "").toUpperCase() !== "IDLE") onNotice("请先确保屏幕处于待机状态，再执行更新。", "error");
    else if (!selectedPackage) onNotice("没有找到所选 TV 版本。", "error");
    else if (window.confirm(`确定把 ${screen.deviceId} 更新到 ${selectedPackage.version} 吗？`)) {
      await runDeviceMutation(screen.deviceId, `正在通知 ${screen.deviceId} 安装 ${selectedPackage.version}...`, async () => {
        await installTvPackage(authSession, screen.deviceId, selectedPackage.id);
        await loadScreens(false);
        onNotice(`已通知 ${screen.deviceId} 安装 ${selectedPackage.version}。`);
      }, "下发更新失败。");
    }
  }

  async function runDeviceMutation(deviceId: string, busyText: string, action: () => Promise<void>, fallback: string) {
    setBusyDeviceId(deviceId);
    onBusyTextChange(busyText);
    try {
      await action();
    } catch (error) {
      handleRequestError(error, fallback);
    } finally {
      setBusyDeviceId("");
      onBusyTextChange("");
    }
  }

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    async function loop(initial = false) {
      if (cancelled) return;
      if (initial) setLoading(true);
      try {
        const nextPayload = await fetchScreens(authSession);
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
        if (!cancelled) timer = window.setTimeout(() => void loop(false), document.visibilityState === "visible" ? POLL_INTERVAL_MS : HIDDEN_POLL_INTERVAL_MS);
      }
    }
    void loop(true);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [authSession.access_token, authSession.token_type]);

  useEffect(() => {
    void loadPackages(false);
  }, [authSession.access_token, authSession.token_type]);

  useEffect(() => {
    if (!selectedPackageId && packagePayload?.packages?.length) setSelectedPackageId(String(packagePayload.packages[0].id));
  }, [packagePayload, selectedPackageId]);

  return {
    bindScannedDevice,
    busyDeviceId,
    canClearCache,
    clearDeviceCache,
    expandedScreenNumbers,
    installPackageToDevice,
    loadPackages,
    loadScreens,
    loading,
    managedScreens,
    packagePayload,
    pairDeviceId,
    pairRawInput,
    pairScreenNumber,
    pairToken,
    scanner,
    selectedPackageId,
    setPairScreenNumber,
    setSelectedPackageId,
    toggleExpanded,
    tvPackages,
    unbindScreen,
    updatePairRawInput
  };
}
