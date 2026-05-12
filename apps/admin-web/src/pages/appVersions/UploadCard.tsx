export type AppPlatform = "tv" | "coach";

export interface UploadFormState {
  platform: AppPlatform;
  version: string;
  label: string;
  notes: string;
  file: File | null;
}

export default function UploadCard({
  form,
  onFormChange,
  uploading,
  onUpload
}: {
  form: UploadFormState;
  onFormChange: (next: UploadFormState) => void;
  uploading: boolean;
  onUpload: () => void;
}) {
  return (
    <div className="versions-upload-card">
      <h3>上传新版本</h3>

      <div className="versions-upload-grid">
        <label>
          <span>平台</span>
          <select value={form.platform} onChange={(event) => onFormChange({ ...form, platform: event.target.value as AppPlatform })}>
            <option value="tv">TV</option>
            <option value="coach">Coach</option>
          </select>
        </label>

        <label>
          <span>版本号</span>
          <input value={form.version} onChange={(event) => onFormChange({ ...form, version: event.target.value })} placeholder="例如 1.0.3" />
        </label>

        <label>
          <span>显示名称</span>
          <input value={form.label} onChange={(event) => onFormChange({ ...form, label: event.target.value })} placeholder="例如 HYROX TV 正式版" />
        </label>

        <label className="versions-upload-file">
          <span>APK 文件</span>
          <input
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            onChange={(event) => onFormChange({ ...form, file: event.target.files?.[0] || null })}
          />
        </label>

        <label className="versions-upload-notes">
          <span>备注</span>
          <textarea value={form.notes} onChange={(event) => onFormChange({ ...form, notes: event.target.value })} placeholder="可选：更新说明、适用场地、回滚说明" />
        </label>
      </div>

      <div className="versions-upload-actions">
        <button type="button" className="primary-button" onClick={onUpload} disabled={uploading}>
          上传安装包
        </button>
        <span>以后通过 SSH 直接把 APK 放到上面的服务器目录里，再点“扫描目录”也会识别出来。</span>
      </div>
    </div>
  );
}
