import { useEffect, useMemo, useState } from "react";
import VenueAccountsCard from "./VenueAccountsCard.tsx";
import VenueAccountsListPanel from "./VenueAccountsListPanel.tsx";
import VenueListPanel from "./VenueListPanel.tsx";
import VenueScreensCard from "./VenueScreensCard.tsx";
import BindAccountModal from "./modals/BindAccountModal.tsx";
import CreateAccountModal from "./modals/CreateAccountModal.tsx";
import CreateVenueModal from "./modals/CreateVenueModal.tsx";
import type { CoursePackageRecord, NoticeFn, TvScreenSnapshot, VenueCoursePackagesPayload, VenueRecord } from "./types.ts";
import {
  bindCoursePackageToVenue,
  fetchCoursePackages,
  fetchVenueCoursePackages,
  setVenueActiveCoursePackage,
  unbindCoursePackageFromVenue
} from "./api.ts";
import { useVenueManagementVm } from "../../viewmodels/venues/useVenueManagementVm.ts";

export default function VenueManagementPage({
  tokenType,
  accessToken,
  onNotice,
  onVenuesChange
}: {
  tokenType: string;
  accessToken: string;
  onNotice: NoticeFn;
  onVenuesChange?: (venues: VenueRecord[]) => void;
}) {
  const authHeader = useMemo(() => `${tokenType} ${accessToken}`, [tokenType, accessToken]);
  const vm = useVenueManagementVm({ authHeader, onNotice, onVenuesChange });
  const [allCoursePackages, setAllCoursePackages] = useState<CoursePackageRecord[]>([]);
  const [venueCoursePackages, setVenueCoursePackages] = useState<VenueCoursePackagesPayload | null>(null);
  const [packageActionLoading, setPackageActionLoading] = useState("");
  const [packageToBind, setPackageToBind] = useState("");

  async function reloadCoursePackageBindings(venueId = vm.activeVenueId) {
    if (!venueId) {
      setVenueCoursePackages(null);
      return;
    }
    setPackageActionLoading("正在加载课程包绑定...");
    try {
      const [packages, bindings] = await Promise.all([
        fetchCoursePackages(authHeader),
        fetchVenueCoursePackages(authHeader, venueId)
      ]);
      setAllCoursePackages(packages);
      setVenueCoursePackages(bindings);
      const boundIds = new Set((bindings?.items || []).map((item) => Number(item.id)));
      const firstUnbound = packages.find((item) => !boundIds.has(Number(item.id)));
      setPackageToBind(firstUnbound ? String(firstUnbound.id) : "");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "加载课程包绑定失败。", "error");
    } finally {
      setPackageActionLoading("");
    }
  }

  useEffect(() => {
    void reloadCoursePackageBindings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authHeader, vm.activeVenueId]);

  async function handleBindCoursePackage() {
    if (!vm.activeVenueId || !packageToBind) {
      onNotice("请选择要绑定的课程包。", "error");
      return;
    }
    setPackageActionLoading("正在绑定课程包...");
    try {
      const next = await bindCoursePackageToVenue(authHeader, vm.activeVenueId, Number(packageToBind));
      setVenueCoursePackages(next);
      await reloadCoursePackageBindings(vm.activeVenueId);
      onNotice("课程包已绑定。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "绑定课程包失败。", "error");
    } finally {
      setPackageActionLoading("");
    }
  }

  async function handleUnbindCoursePackage(coursePackageId: number) {
    if (!vm.activeVenueId) return;
    if (!window.confirm("确认从当前场馆解绑这个课程包吗？")) return;
    setPackageActionLoading("正在解绑课程包...");
    try {
      const next = await unbindCoursePackageFromVenue(authHeader, vm.activeVenueId, coursePackageId);
      setVenueCoursePackages(next);
      await reloadCoursePackageBindings(vm.activeVenueId);
      onNotice("课程包已解绑。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "解绑课程包失败。", "error");
    } finally {
      setPackageActionLoading("");
    }
  }

  async function handleSetActiveCoursePackage(coursePackageId: number) {
    if (!vm.activeVenueId) return;
    setPackageActionLoading("正在切换课程包...");
    try {
      const next = await setVenueActiveCoursePackage(authHeader, vm.activeVenueId, coursePackageId);
      setVenueCoursePackages(next);
      onNotice("当前课程包已切换。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "切换课程包失败。", "error");
    } finally {
      setPackageActionLoading("");
    }
  }

  const boundPackageIds = useMemo(
    () => new Set((venueCoursePackages?.items || []).map((item) => Number(item.id))),
    [venueCoursePackages?.items]
  );
  const bindableCoursePackages = allCoursePackages.filter((item) => !boundPackageIds.has(Number(item.id)));

  async function handleRefresh() {
    await Promise.all([vm.refreshAll(), reloadCoursePackageBindings(vm.activeVenueId)]);
  }

  function handleRenameVenueClick() {
    if (!vm.activeVenue) return;
    const nextName = window.prompt("请输入新的场馆名称", vm.activeVenue.name);
    if (nextName == null) return;
    void vm.handleRenameVenue(nextName);
  }

  return (
    <div className="venue-shell">
      <div className="venue-top">
        <div className="venue-top-title">
          <h2>场馆管理</h2>
          <p>创建场馆与账号，查看设备在线状态并执行版本更新。</p>
        </div>
        <div className="venue-top-actions">
          <button type="button" className="ghost-button" onClick={() => void handleRefresh()}>
            刷新
          </button>
          <button type="button" className="ghost-button" onClick={() => vm.setCreateAccountOpen(true)}>
            + 新建账号
          </button>
          <button type="button" className="primary-button" onClick={() => vm.setCreateVenueOpen(true)}>
            + 新建场馆
          </button>
        </div>
      </div>

      <section className="venue-grid">
        <VenueListPanel venues={vm.venues} activeVenueId={vm.activeVenueId} onSelectVenue={vm.setActiveVenueId} />

        <div className="venue-panel venue-detail">
          <div className="venue-panel-head">
            <div>
              <strong>{vm.activeVenue ? vm.activeVenue.name : "未选择场馆"}</strong>
              {vm.activeVenue ? <span className="venue-muted">namespace: {vm.activeVenue.accountNamespace}</span> : null}
            </div>
            {vm.activeVenue ? (
              <div className="venue-badges">
                <span className="venue-badge">
                  设备 {vm.boundCount}/{vm.venueScreens?.screens?.length || 0}
                </span>
                <span className={`venue-badge ${vm.onlineCount ? "is-online" : ""}`}>在线 {vm.onlineCount}</span>
                <button type="button" className="ghost-button" onClick={handleRenameVenueClick}>
                  改名
                </button>
                <button type="button" className="danger-button" onClick={vm.handleDeleteVenue}>
                  删除场馆
                </button>
              </div>
            ) : null}
          </div>

          {!vm.activeVenue ? (
            <div className="venue-empty">请选择一个场馆。</div>
          ) : (
            <div className="venue-detail-body">
              <VenueAccountsCard
                venueUsers={vm.venueUsers}
                onOpenBind={async () => {
                  vm.setBindAccountOpen(true);
                  vm.setBindQuery("");
                  vm.setBindSelectedUserId(null);
                  await vm.loadBindCandidates("");
                }}
                onUnbind={(userId) => vm.handleUnbindAccount(userId)}
              />

              <div className="venue-card">
                <div className="venue-card-head">
                  <div>
                    <strong>场馆课程包</strong>
                    <p className="venue-muted">Coach 端只能在这里绑定的课程包之间切换。</p>
                  </div>
                  <span className={`venue-badge ${venueCoursePackages?.running ? "" : "is-online"}`}>
                    {venueCoursePackages?.running ? "上课中" : "可调整"}
                  </span>
                </div>

                <div className="venue-course-packages">
                  {(venueCoursePackages?.items || []).length ? (
                    (venueCoursePackages?.items || []).map((pkg) => {
                      const active = Number(pkg.id) === Number(venueCoursePackages?.activeCoursePackageId);
                      return (
                        <div key={pkg.id} className={`venue-course-package ${active ? "is-active" : ""}`}>
                          <div>
                            <strong>{pkg.name}</strong>
                            <p className="venue-muted">
                              {pkg.courseCount || pkg.courseIds?.length || 0} 节课 {pkg.isDefault ? "· 默认课程包" : ""}
                            </p>
                          </div>
                          <div className="venue-user-actions">
                            {active ? <span className="venue-pill">当前</span> : null}
                            {!active ? (
                              <button
                                type="button"
                                className="ghost-button"
                                disabled={Boolean(venueCoursePackages?.running)}
                                onClick={() => void handleSetActiveCoursePackage(Number(pkg.id))}
                              >
                                设为当前
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="ghost-button"
                              disabled={Boolean(venueCoursePackages?.running) || (venueCoursePackages?.items || []).length <= 1}
                              onClick={() => void handleUnbindCoursePackage(Number(pkg.id))}
                            >
                              解绑
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="venue-empty">当前场馆还没有绑定课程包。</div>
                  )}
                </div>

                <div className="venue-bind-package">
                  <select value={packageToBind} onChange={(event) => setPackageToBind(event.target.value)}>
                    <option value="">选择要绑定的课程包</option>
                    {bindableCoursePackages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={!packageToBind || Boolean(venueCoursePackages?.running)}
                    onClick={() => void handleBindCoursePackage()}
                  >
                    + 绑定课程包
                  </button>
                </div>
              </div>

              <VenueScreensCard
                tvPackages={vm.tvPackages}
                selectedTvPackageId={vm.selectedTvPackageId}
                onSelectedTvPackageIdChange={vm.setSelectedTvPackageId}
                onRefreshPackages={() => void vm.reloadTvPackages(true)}
                generatedAtLabel={vm.venueScreens?.generatedAt ? `更新于 ${vm.venueScreens.generatedAt}` : ""}
                screens={vm.venueScreens?.screens || []}
                installingDeviceId={vm.installingDeviceId}
                canInstall={vm.canInstall}
                canInstallAll={vm.canInstallAll}
                onInstall={(screen) => void vm.handleInstallTvPackage(screen as TvScreenSnapshot)}
                onInstallAll={() => void vm.handleInstallAllTvPackages()}
              />
            </div>
          )}
        </div>
      </section>

      <VenueAccountsListPanel
        filteredAccounts={vm.filteredAccounts}
        accountsQuery={vm.accountsQuery}
        onAccountsQueryChange={vm.setAccountsQuery}
        venueById={vm.venueById}
        coursePackages={allCoursePackages}
        onSetCoursePackages={(userId, coursePackageIds) => void vm.handleSetAccountCoursePackages(userId, coursePackageIds)}
        onUnbind={(userId) => vm.handleUnbindAccount(userId)}
        onUpdatePassword={(user) => void vm.handleUpdateAccountPassword(user)}
      />

      <CreateVenueModal
        open={vm.createVenueOpen}
        newVenueName={vm.newVenueName}
        onNewVenueNameChange={vm.setNewVenueName}
        onClose={() => vm.setCreateVenueOpen(false)}
        onCreate={vm.handleCreateVenue}
      />

      <CreateAccountModal
        open={vm.createAccountOpen}
        accountUsername={vm.accountUsername}
        accountPassword={vm.accountPassword}
        onAccountUsernameChange={vm.setAccountUsername}
        onAccountPasswordChange={vm.setAccountPassword}
        onClose={() => vm.setCreateAccountOpen(false)}
        onCreate={vm.handleCreateAccount}
      />

      <BindAccountModal
        open={vm.bindAccountOpen}
        bindQuery={vm.bindQuery}
        onBindQueryChange={(next) => {
          vm.setBindQuery(next);
          vm.setBindSelectedUserId(null);
          vm.loadBindCandidates(next);
        }}
        bindCandidates={vm.bindCandidates}
        selectedUserId={vm.bindSelectedUserId}
        onSelectUser={vm.setBindSelectedUserId}
        onClose={vm.closeBindModal}
        onConfirm={vm.handleBindAccount}
      />

      {vm.loading || packageActionLoading ? <div className="busy-mask">{vm.loading || packageActionLoading}</div> : null}
    </div>
  );
}
