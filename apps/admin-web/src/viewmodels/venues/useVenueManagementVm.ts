import { useMemo, useState } from "react";
import type { NoticeFn, TvScreenSnapshot, VenueRecord } from "../../pages/venues/types.ts";
import { publishAdminTvCommand } from "../../pages/venues/api.ts";
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
      await venuesVm.reloadVenues();
      await detailVm.reloadDetail(venuesVm.activeVenueId);
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

  async function handleInstallTvPackage(screen: TvScreenSnapshot) {
    const deviceId = String(screen.deviceId || "").trim();
    if (!venuesVm.activeVenueId || !venuesVm.activeVenue) return;
    if (!deviceId) return onNotice("该屏幕还没有绑定设备。", "error");
    if (!tvVm.selectedTvPackageId) return onNotice("请先选择一个 TV 版本。", "error");
    if (!screen.online) return onNotice("屏幕当前离线，暂时无法更新。", "error");
    if (String(screen.playbackState || "").toUpperCase() !== "IDLE") {
      return onNotice("请先确保屏幕处于待机状态，再执行更新。", "error");
    }

    const selectedPackage =
      tvVm.tvPackages.find((item) => String(item.id) === String(tvVm.selectedTvPackageId)) || null;
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
      await refreshAll();
      onNotice(`已通知 ${deviceId} 安装 ${selectedPackage.version}。`);
    } catch (error) {
      onNotice(error instanceof Error ? `更新指令下发失败：${error.message}` : "更新指令下发失败。", "error");
    } finally {
      setInstallingDeviceId("");
      setActionLoading("");
    }
  }

  const canInstall = useMemo(() => {
    const selected = Boolean(tvVm.selectedTvPackageId);
    return (screen: TvScreenSnapshot) =>
      Boolean(
        screen.deviceId &&
          screen.online &&
          selected &&
          String(screen.playbackState || "").toUpperCase() === "IDLE" &&
          installingDeviceId !== screen.deviceId
      );
  }, [tvVm.selectedTvPackageId, installingDeviceId]);

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
    handleInstallTvPackage
  };
}
