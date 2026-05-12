import type { AuthSession, NoticeTone } from "../models/common";
import type { TvDailyBundle } from "../models/schedule";
import { fetchDailyBundle, publishTvControl } from "../services/consoleService";

interface ConsoleRefreshParams {
  authSession: AuthSession;
  handleRequestError: (error: unknown, fallbackMessage: string) => void;
  onBusyTextChange: (text: string) => void;
  onNotice: (message: string, tone?: NoticeTone) => void;
  selectedDate: string;
  setBundle: (bundle: TvDailyBundle) => void;
}

export function useConsoleRefreshActions(params: ConsoleRefreshParams) {
  async function refreshBundle(manualNotice = true) {
    params.onBusyTextChange("正在刷新教练端课表...");
    try {
      params.setBundle(await fetchDailyBundle(params.selectedDate));
      if (manualNotice) {
        params.onNotice("教练端课表已刷新。");
      }
    } catch (error) {
      params.handleRequestError(error, "刷新课表失败。");
    } finally {
      params.onBusyTextChange("");
    }
  }

  async function handleRefreshTv() {
    params.onBusyTextChange("正在通知 TV 端刷新课程校验...");
    try {
      await publishTvControl(params.authSession, { type: "refresh_checksum", source: "coach-web", requestedAt: Date.now() });
      params.onNotice("已通知 TV 端刷新课程校验。");
    } catch (error) {
      params.handleRequestError(error, "TV 控制指令发送失败。");
    } finally {
      params.onBusyTextChange("");
    }
  }

  return { handleRefreshTv, refreshBundle };
}

