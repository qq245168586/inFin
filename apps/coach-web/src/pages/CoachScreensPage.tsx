import type { AuthSession, NoticeTone } from "../models/common";
import { BusyMask } from "../components/app/BusyMask";
import { PackageSelector } from "../components/screens/PackageSelector";
import { PairPanel } from "../components/screens/PairPanel";
import { ScannerSheet } from "../components/screens/ScannerSheet";
import { ScreenGrid } from "../components/screens/ScreenGrid";
import { ScreensToolbar } from "../components/screens/ScreensToolbar";
import { useScreensViewModel } from "../viewModels/useScreensViewModel";

interface CoachScreensPageProps {
  authSession: AuthSession;
  onBusyTextChange: (text: string) => void;
  onNotice: (message: string, tone?: NoticeTone) => void;
  onAuthExpired: (message?: string) => void;
}

export default function CoachScreensPage(props: CoachScreensPageProps) {
  const vm = useScreensViewModel(props);

  return (
    <section className="coach-screens-page">
      <ScreensToolbar onRefreshPackages={() => void vm.loadPackages(true)} onRefreshScreens={() => void vm.loadScreens(true)} />
      <PackageSelector packagePayload={vm.packagePayload} selectedPackageId={vm.selectedPackageId} tvPackages={vm.tvPackages} onSelectPackage={vm.setSelectedPackageId} />
      <PairPanel
        busyDeviceId={vm.busyDeviceId}
        fileInputRef={vm.scanner.fileInputRef}
        pairDeviceId={vm.pairDeviceId}
        pairRawInput={vm.pairRawInput}
        pairScreenNumber={vm.pairScreenNumber}
        pairToken={vm.pairToken}
        scannerError={vm.scanner.scannerError}
        onBind={() => void vm.bindScannedDevice()}
        onOpenScanner={() => void vm.scanner.startScanner()}
        onPhotoSelected={(file) => void vm.scanner.handleQrImageSelected(file)}
        onRawInputChange={vm.updatePairRawInput}
        onScreenNumberChange={vm.setPairScreenNumber}
      />
      <ScreenGrid
        busyDeviceId={vm.busyDeviceId}
        canClearCache={vm.canClearCache}
        expandedScreenNumbers={vm.expandedScreenNumbers}
        managedScreens={vm.managedScreens}
        selectedPackageId={vm.selectedPackageId}
        onClearCache={(screen) => void vm.clearDeviceCache(screen)}
        onInstallPackage={(screen) => void vm.installPackageToDevice(screen)}
        onToggle={vm.toggleExpanded}
        onUnbind={(screen) => void vm.unbindScreen(screen)}
      />
      <BusyMask text={vm.loading ? "正在刷新屏幕状态..." : ""} inline />
      <ScannerSheet open={vm.scanner.scannerOpen} videoRef={vm.scanner.videoRef} onClose={vm.scanner.stopScanner} />
    </section>
  );
}

