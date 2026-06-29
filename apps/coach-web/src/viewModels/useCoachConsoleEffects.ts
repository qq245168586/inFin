import { useEffect, type RefObject } from "react";
import type { AuthSession } from "../models/common";
import type { CoachWeekDay, TvDailyBundle } from "../models/schedule";
import { useI18n } from "../providers/I18nProvider";
import { fetchDailyBundle } from "../services/consoleService";
import { todayValue } from "../utils/time";

interface ConsoleEffectsParams {
  activePreviewId?: string;
  activePreviewMediaUrl?: string;
  authSession: AuthSession;
  fetchCurrentPlaybackSession: (showError?: boolean) => Promise<unknown>;
  handleRequestError: (error: unknown, fallbackMessage: string) => void;
  onBusyTextChange: (text: string) => void;
  previewIndex: number;
  previewItemsLength: number;
  previewVideoRef: RefObject<HTMLVideoElement>;
  selectedDate: string;
  setBundle: (bundle: TvDailyBundle) => void;
  setPreviewIndex: (value: number | ((current: number) => number)) => void;
  setSelectedDate: (date: string) => void;
  weekDays: CoachWeekDay[];
}

export function useCoachConsoleEffects(params: ConsoleEffectsParams) {
  const { t } = useI18n();
  useEffect(() => {
    if (!params.weekDays.some((day) => day.key === params.selectedDate)) {
      params.setSelectedDate(todayValue());
    }
  }, [params.selectedDate, params.weekDays]);

  useEffect(() => {
    let cancelled = false;
    params.onBusyTextChange(t("正在加载教练端课表..."));
    fetchDailyBundle(params.selectedDate, params.authSession)
      .then((payload) => {
        if (!cancelled) params.setBundle(payload);
      })
      .catch((error) => !cancelled && params.handleRequestError(error, t("加载教练端课表失败。")))
      .finally(() => !cancelled && params.onBusyTextChange(""));
    return () => {
      cancelled = true;
    };
  }, [params.selectedDate]);

  useEffect(() => {
    if (!params.previewItemsLength || params.previewIndex > params.previewItemsLength - 1) {
      params.setPreviewIndex(0);
    }
  }, [params.previewIndex, params.previewItemsLength]);

  useEffect(() => {
    if (!params.activePreviewMediaUrl) return;
    const timer = window.setTimeout(() => {
      const video = params.previewVideoRef.current;
      if (!video) return;
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.playsInline = true;
      void video.play().catch(() => undefined);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [params.activePreviewId, params.activePreviewMediaUrl]);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const poll = () => {
      timer = window.setTimeout(async () => {
        if (!cancelled) {
          await params.fetchCurrentPlaybackSession(false);
          poll();
        }
      }, document.visibilityState === "visible" ? 2000 : 15000);
    };
    void params.fetchCurrentPlaybackSession(false).finally(() => !cancelled && poll());
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [params.authSession.access_token, params.authSession.token_type]);
}
