import { useMemo } from "react";
import VenueAccountsCard from "./VenueAccountsCard.tsx";
import VenueAccountsListPanel from "./VenueAccountsListPanel.tsx";
import VenueListPanel from "./VenueListPanel.tsx";
import VenueScreensCard from "./VenueScreensCard.tsx";
import BindAccountModal from "./modals/BindAccountModal.tsx";
import CreateAccountModal from "./modals/CreateAccountModal.tsx";
import CreateVenueModal from "./modals/CreateVenueModal.tsx";
import type { NoticeFn, TvScreenSnapshot, VenueRecord } from "./types.ts";
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

  return (
    <div className="venue-shell">
      <div className="venue-top">
        <div className="venue-top-title">
          <h2>场馆管理</h2>
          <p>创建场馆与账号，查看设备在线状态并执行版本更新。</p>
        </div>
        <div className="venue-top-actions">
          <button type="button" className="ghost-button" onClick={vm.refreshAll}>
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
        onUnbind={(userId) => vm.handleUnbindAccount(userId)}
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

      {vm.loading ? <div className="busy-mask">{vm.loading}</div> : null}
    </div>
  );
}
