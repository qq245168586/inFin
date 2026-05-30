import { useMemo, useState } from "react";
import type { AppPackageRecord, NoticeFn, TvScreenSnapshot, VenueRecord } from "../../pages/venues/types.ts";
import { publishAdminTvCommand, setUserCoursePackages } from "../../pages/venues/api.ts";
import { useVenueAccountsVm } from "./useVenueAccountsVm.ts";
import { useVenueDetailVm } from "./useVenueDetailVm.ts";
import { useVenueTvPackagesVm } from "./useVenueTvPackagesVm.ts";
import { useVenuesListVm } from "./useVenuesListVm.ts";

export function useVenueManagementVm({
  authHeader,
  onNotice,
  onVenuesChange
}: {
  authHeader: string;
  onNotice: NoticeFn;
  onVenuesChange?: (venues: VenueRecord[]) => void;
}) {
  const venuesVm = useVenuesListVm({ authHeader, onNotice, onVenuesChange });
  const detailVm = useVenueDetailVm({ authHeader, onNotice, activeVenueId: venuesVm.activeVenueId });
  const tvVm = useVenueTvPackagesVm({ authHeader, onNotice });
  const [actionLoading, setActionLoading] = useState("");
  const [installingDeviceId, setInstallingDeviceId] = useState("");
  const batchInstallingKey = "__all__";

  const accountsVm = useVenueAccountsVm({
    authHeader,
    onNotice,
    activeVenueId: venuesVm.activeVenueId,
    setLoading: setActionLoading,
    onAfterChange: refreshAll
  });

  async function refreshAll() {
    setActionLoading("正在刷新...");
    try {
      await Promise.all([venuesVm.reloadVenues(), detailVm.reloadDetail(venuesVm.activeVenueId), accountsVm.reloadUsers()]);
      onNotice("已刷新。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "刷新失败。", "error");
    } finally {
      setActionLoading("");
    }
  }

  const loading = venuesVm.loading || detailVm.loading || actionLoading;
  const onlineCount = (detailVm.venueScreens?.screens || []).filter((item) => item.online && item.deviceId).length;
  const boundCount = (detailVm.venueScreens?.screens || []).filter((item) => item.deviceId).length;

  function selectedTvPackage(): AppPackageRecord | null {
    return tvVm.tvPackages.find((item) => String(item.id) === String(tvVm.selectedTvPackageId)) || null;
  }

  function screenUpdateInProgress(screen: TvScreenSnapshot): boolean {
    return ["DOWNLOADING", "DOWNLOADED", "INSTALLING", "INSTALLED"].includes(
      String(screen.updateState || "").toUpperCase()
    );
  }

  function screenCanReceiveInstall(screen: TvScreenSnapshot): boolean {
    return Boolean(
      screen.deviceId &&
        screen.online &&
        tvVm.selectedTvPackageId &&
        String(screen.playbackState || "").toUpperCase() === "IDLE" &&
        !screenUpdateInProgress(screen)
    );
  }

  async function publishInstallTvPackage(
    screen: TvScreenSnapshot,
    selectedPackage: AppPackageRecord,
    namespace: string
  ) {
    const deviceId = String(screen.deviceId || "").trim();
    await publishAdminTvCommand(authHeader, namespace, {
      type: "install_app_update",
      source: "admin-web",
      deviceId,
      screenNumber: Number(screen.screenNumber) || 0,
      accountNamespace: namespace,
      venueId: namespace,
      packageId: selectedPackage.id,
      platform: selectedPackage.platform,
      version: selectedPackage.version,
      label: selectedPackage.label,
      filename: selectedPackage.filename,
      checksum: selectedPackage.checksum,
      sizeBytes: Number(selectedPackage.sizeBytes) || 0,
      downloadUrl: selectedPackage.downloadPath,
      requestedAt: Date.now()
    });
  }

  async function handleInstallTvPackage(screen: TvScreenSnapshot) {
    const deviceId = String(screen.deviceId || "").trim();
    if (!venuesVm.activeVenueId || !venuesVm.activeVenue) return;
    if (!deviceId) return onNotice("该屏幕还没有绑定设备。", "error");
    if (!tvVm.selectedTvPackageId) return onNotice("请先选择一个 TV 版本。", "error");
    if (!screen.online) return onNotice("屏幕当前离线，暂时无法更新。", "error");
    if (screenUpdateInProgress(screen)) {
      return onNotice("屏幕正在更新中，请等待当前更新完成。", "error");
    }
    if (String(screen.playbackState || "").toUpperCase() !== "IDLE") {
      return onNotice("请先确保屏幕处于待机状态，再执行更新。", "error");
    }

    const selectedPackage = selectedTvPackage();
    if (!selectedPackage) return onNotice("没有找到所选 TV 版本。", "error");

    const namespace = String(venuesVm.activeVenue.accountNamespace || "").trim().toLowerCase();
    const confirmLines = [
      "确定下发 TV 更新吗？",
      "",
      `场馆：${venuesVm.activeVenue.name}`,
      `namespace：${namespace}`,
      `设备：${deviceId}`,
      `屏幕：${screen.screenNumber}`,
      `版本：${selectedPackage.version}`
    ];
    if (!window.confirm(confirmLines.join("\n"))) return;

    setInstallingDeviceId(deviceId);
    setActionLoading(`正在通知 ${deviceId} 安装 ${selectedPackage.version}...`);
    try {
      await publishInstallTvPackage(screen, selectedPackage, namespace);
      await refreshAll();
      onNotice(`已通知 ${deviceId} 安装 ${selectedPackage.version}。`);
    } catch (error) {
      onNotice(error instanceof Error ? `更新指令下发失败：${error.message}` : "更新指令下发失败。", "error");
    } finally {
      setInstallingDeviceId("");
      setActionLoading("");
    }
  }

  async function handleInstallAllTvPackages() {
    if (!venuesVm.activeVenueId || !venuesVm.activeVenue) return;
    if (!tvVm.selectedTvPackageId) return onNotice("请先选择一个 TV 版本。", "error");
    const selectedPackage = selectedTvPackage();
    if (!selectedPackage) return onNotice("没有找到所选 TV 版本。", "error");

    const namespace = String(venuesVm.activeVenue.accountNamespace || "").trim().toLowerCase();
    const installableScreens = (detailVm.venueScreens?.screens || []).filter(screenCanReceiveInstall);
    if (!installableScreens.length) {
      return onNotice("当前场馆没有可更新的在线待机设备，或设备正在更新中。", "error");
    }

    const confirmLines = [
      "确定一键更新当前场馆所有在线待机 TV 吗？",
      "",
      `场馆：${venuesVm.activeVenue.name}`,
      `namespace：${namespace}`,
      `数量：${installableScreens.length} 台`,
      `版本：${selectedPackage.version}`
    ];
    if (!window.confirm(confirmLines.join("\n"))) return;

    setInstallingDeviceId(batchInstallingKey);
    setActionLoading(`正在批量下发 ${selectedPackage.version}...`);
    const failures: string[] = [];
    try {
      for (const screen of installableScreens) {
        try {
          await publishInstallTvPackage(screen, selectedPackage, namespace);
        } catch (error) {
          failures.push(`${screen.deviceId || `屏幕 ${screen.screenNumber}`}：${error instanceof Error ? error.message : "下发失败"}`);
        }
      }
      await refreshAll();
      if (failures.length) {
        onNotice(`已下发 ${installableScreens.length - failures.length} 台，失败 ${failures.length} 台：${failures.join("；")}`, "error");
      } else {
        onNotice(`已通知 ${installableScreens.length} 台 TV 安装 ${selectedPackage.version}。`);
      }
    } finally {
      setInstallingDeviceId("");
      setActionLoading("");
    }
  }

  async function handleSetAccountCoursePackages(userId: number, coursePackageIds: number[]) {
    setActionLoading("正在更新账号课程包权限...");
    try {
      await setUserCoursePackages(authHeader, userId, coursePackageIds);
      await accountsVm.reloadUsers();
      await detailVm.reloadDetail(venuesVm.activeVenueId);
      onNotice("账号课程包权限已更新。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "更新账号课程包权限失败。", "error");
    } finally {
      setActionLoading("");
    }
  }

  const canInstall = useMemo(() => {
    const selected = Boolean(tvVm.selectedTvPackageId);
    return (screen: TvScreenSnapshot) =>
      Boolean(
        selected &&
          screenCanReceiveInstall(screen) &&
          installingDeviceId !== batchInstallingKey &&
          installingDeviceId !== screen.deviceId
      );
  }, [tvVm.selectedTvPackageId, installingDeviceId]);

  const canInstallAll = useMemo(() => {
    if (!tvVm.selectedTvPackageId || installingDeviceId) {
      return false;
    }
    return (detailVm.venueScreens?.screens || []).some(screenCanReceiveInstall);
  }, [detailVm.venueScreens?.screens, installingDeviceId, tvVm.selectedTvPackageId]);

  return {
    venues: venuesVm.venues,
    activeVenueId: venuesVm.activeVenueId,
    setActiveVenueId: venuesVm.setActiveVenueId,
    activeVenue: venuesVm.activeVenue,
    venueUsers: detailVm.venueUsers,
    venueScreens: detailVm.venueScreens,
    loading,
    onlineCount,
    boundCount,
    refreshAll,
    createVenueOpen: venuesVm.createVenueOpen,
    setCreateVenueOpen: venuesVm.setCreateVenueOpen,
    newVenueName: venuesVm.newVenueName,
    setNewVenueName: venuesVm.setNewVenueName,
    handleCreateVenue: venuesVm.handleCreateVenue,
    handleDeleteVenue: venuesVm.handleDeleteVenue,
    createAccountOpen: accountsVm.createAccountOpen,
    setCreateAccountOpen: accountsVm.setCreateAccountOpen,
    accountUsername: accountsVm.accountUsername,
    setAccountUsername: accountsVm.setAccountUsername,
    accountPassword: accountsVm.accountPassword,
    setAccountPassword: accountsVm.setAccountPassword,
    handleCreateAccount: accountsVm.handleCreateAccount,
    bindAccountOpen: accountsVm.bindAccountOpen,
    setBindAccountOpen: accountsVm.setBindAccountOpen,
    bindQuery: accountsVm.bindQuery,
    setBindQuery: accountsVm.setBindQuery,
    bindCandidates: accountsVm.bindCandidates,
    bindSelectedUserId: accountsVm.bindSelectedUserId,
    setBindSelectedUserId: accountsVm.setBindSelectedUserId,
    loadBindCandidates: accountsVm.loadBindCandidates,
    handleBindAccount: accountsVm.handleBindAccount,
    closeBindModal: accountsVm.closeBindModal,
    handleUnbindAccount: accountsVm.handleUnbindAccount,
    allUsers: accountsVm.allUsers,
    accountsQuery: accountsVm.accountsQuery,
    setAccountsQuery: accountsVm.setAccountsQuery,
    filteredAccounts: accountsVm.filteredAccounts,
    venueById: venuesVm.venueById,
    tvPackages: tvVm.tvPackages,
    selectedTvPackageId: tvVm.selectedTvPackageId,
    setSelectedTvPackageId: tvVm.setSelectedTvPackageId,
    reloadTvPackages: tvVm.reloadTvPackages,
    installingDeviceId,
    canInstall,
    canInstallAll,
    handleInstallTvPackage,
    handleInstallAllTvPackages,
    handleSetAccountCoursePackages
  };
}
