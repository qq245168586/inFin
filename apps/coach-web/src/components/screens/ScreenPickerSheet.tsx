type ScreenPickerMode = "scan" | "upload" | "select";

interface ScreenPickerSheetProps {
  mode: ScreenPickerMode | null;
  selectedScreenNumber: string;
  onClose: () => void;
  onSelect: (screenNumber: number) => void;
}

const modeCopy: Record<ScreenPickerMode, { eyebrow: string; title: string; hint: string }> = {
  scan: {
    eyebrow: "SCAN TARGET",
    title: "先选择要绑定的屏幕",
    hint: "选好屏幕后会立刻打开相机扫码。"
  },
  upload: {
    eyebrow: "UPLOAD TARGET",
    title: "先选择要绑定的屏幕",
    hint: "选好屏幕后会打开相册选择二维码照片。"
  },
  select: {
    eyebrow: "SCREEN TARGET",
    title: "选择绑定屏幕",
    hint: "手动粘贴配对字符串时，也会绑定到这里选择的屏幕。"
  }
};

export function ScreenPickerSheet(props: ScreenPickerSheetProps) {
  if (!props.mode) return null;
  const copy = modeCopy[props.mode];

  return (
    <div className="coach-screen-picker-sheet">
      <div className="coach-screen-picker-card">
        <div className="coach-scanner-head">
          <div>
            <p>{copy.eyebrow}</p>
            <strong>{copy.title}</strong>
          </div>
          <button type="button" className="ghost-button" onClick={props.onClose}>关闭</button>
        </div>
        <p className="coach-screen-picker-hint">{copy.hint}</p>
        <div className="coach-screen-picker-grid">
          {[1, 2, 3, 4, 5].map((screenNumber) => {
            const selected = String(screenNumber) === props.selectedScreenNumber;
            return (
              <button
                key={screenNumber}
                type="button"
                className={`coach-screen-picker-option${selected ? " active" : ""}`}
                onClick={() => props.onSelect(screenNumber)}
              >
                <span>屏幕</span>
                <strong>{screenNumber}</strong>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
