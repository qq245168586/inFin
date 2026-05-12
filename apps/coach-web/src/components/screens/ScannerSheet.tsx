import type { RefObject } from "react";

export function ScannerSheet({ open, videoRef, onClose }: { open: boolean; videoRef: RefObject<HTMLVideoElement>; onClose: () => void }) {
  if (!open) {
    return null;
  }
  return (
    <div className="coach-scanner-sheet">
      <div className="coach-scanner-card">
        <div className="coach-scanner-head">
          <div>
            <p>QR Scanner</p>
            <strong>对准 TV 上的二维码</strong>
          </div>
          <button type="button" className="ghost-button" onClick={onClose}>
            关闭
          </button>
        </div>
        <video ref={videoRef} className="coach-scanner-video" muted playsInline autoPlay />
      </div>
    </div>
  );
}

