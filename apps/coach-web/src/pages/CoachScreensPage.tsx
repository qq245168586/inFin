import type { AuthSession, NoticeTone } from "../models/common";
import { useState } from "react";
import { BusyMask } from "../components/app/BusyMask";
import { PackageSelector } from "../components/screens/PackageSelector";
import { PairPanel } from "../components/screens/PairPanel";
import { ScannerSheet } from "../components/screens/ScannerSheet";
import { ScreenGrid } from "../components/screens/ScreenGrid";
import { ScreenPickerSheet } from "../components/screens/ScreenPickerSheet";
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
  const [screenPickerMode, setScreenPickerMode] = useState<"scan" | "upload" | "select" | null>(null);

  function handleScreenPicked(screenNumber: number) {
    vm.setPairScreenNumber(String(screenNumber));
    const mode = screenPickerMode;
    setScreenPickerMode(null);
    if (mode === "scan") {
      window.setTimeout(() => void vm.scanner.startScanner(), 0);
    } else if (mode === "upload") {
      window.setTimeout(() => vm.scanner.fileInputRef.current?.click(), 0);
    }
  }

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
        onChooseScreen={() => setScreenPickerMode("select")}
        onOpenScanner={() => setScreenPickerMode("scan")}
        onOpenPhotoPicker={() => setScreenPickerMode("upload")}
        onPhotoSelected={(file) => void vm.scanner.handleQrImageSelected(file)}
        onRawInputChange={vm.updatePairRawInput}
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
      <ScreenPickerSheet mode={screenPickerMode} selectedScreenNumber={vm.pairScreenNumber} onClose={() => setScreenPickerMode(null)} onSelect={handleScreenPicked} />
      <ScannerSheet open={vm.scanner.scannerOpen} videoRef={vm.scanner.videoRef} onClose={vm.scanner.stopScanner} />
    </section>
  );
}
