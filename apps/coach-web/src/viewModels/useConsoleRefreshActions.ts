import type { AuthSession, NoticeTone } from "../models/common";
import type { TvDailyBundle } from "../models/schedule";
import { useI18n } from "../providers/I18nProvider";
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
  const { t } = useI18n();
  async function refreshBundle(manualNotice = true) {
    params.onBusyTextChange(t("正在刷新教练端课表..."));
    try {
      params.setBundle(await fetchDailyBundle(params.selectedDate, params.authSession));
      if (manualNotice) {
        params.onNotice(t("教练端课表已刷新。"));
      }
    } catch (error) {
      params.handleRequestError(error, t("刷新课表失败。"));
    } finally {
      params.onBusyTextChange("");
    }
  }

  async function handleRefreshTv() {
    params.onBusyTextChange(t("正在通知 TV 端刷新课程校验..."));
    try {
      await publishTvControl(params.authSession, { type: "refresh_checksum", source: "coach-web", requestedAt: Date.now() });
      params.onNotice(t("已通知 TV 端刷新课程校验。"));
    } catch (error) {
      params.handleRequestError(error, t("TV 控制指令发送失败。"));
    } finally {
      params.onBusyTextChange("");
    }
  }

  return { handleRefreshTv, refreshBundle };
}
