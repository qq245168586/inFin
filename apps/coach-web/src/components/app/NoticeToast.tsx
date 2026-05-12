import type { NoticeState } from "../../models/common";

export function NoticeToast({ notice }: { notice: NoticeState | null }) {
  if (!notice) {
    return null;
  }
  return <div className={`coach-notice ${notice.tone === "error" ? "is-error" : ""}`}>{notice.message}</div>;
}

