import { formatStorageBytes } from "../../utils/bytes.ts";
import { formatDateTime } from "../../utils/datetime.ts";

export interface AppPackageRecord {
  id: number;
  platform: "tv" | "coach";
  version: string;
  label: string;
  filename: string;
  originalName: string;
  sizeBytes: number;
  source: string;
  updateTime: string;
}

export default function AppPackageTable({ packages }: { packages: AppPackageRecord[] }) {
  return (
    <div className="table-card">
      <table>
        <thead>
          <tr>
            <th>版本号</th>
            <th>名称</th>
            <th>文件名</th>
            <th>大小</th>
            <th>来源</th>
            <th>更新时间</th>
          </tr>
        </thead>
        <tbody>
          {packages.length ? (
            packages.map((appPackage) => (
              <tr key={appPackage.id}>
                <td>{appPackage.version}</td>
                <td>{appPackage.label}</td>
                <td>{appPackage.filename}</td>
                <td>{formatStorageBytes(appPackage.sizeBytes)}</td>
                <td>{appPackage.source === "upload" ? "网页上传" : "目录扫描"}</td>
                <td>{formatDateTime(appPackage.updateTime)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="table-empty">
                暂无可用安装包版本。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
