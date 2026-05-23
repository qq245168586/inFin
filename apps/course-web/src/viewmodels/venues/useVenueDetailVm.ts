import { useEffect, useRef, useState } from "react";
import type { ConsoleUser, NoticeFn, TvScreensPayload } from "../../pages/venues/types.ts";
import { fetchVenueScreens, fetchVenueUsers } from "../../pages/venues/api.ts";

export function useVenueDetailVm({
  authHeader,
  onNotice,
  activeVenueId
}: {
  authHeader: string;
  onNotice: NoticeFn;
  activeVenueId: string;
}) {
  const [venueUsers, setVenueUsers] = useState<ConsoleUser[]>([]);
  const [venueScreens, setVenueScreens] = useState<TvScreensPayload | null>(null);
  const [loading, setLoading] = useState("");
  const activeVenueIdRef = useRef(activeVenueId);

  useEffect(() => {
    activeVenueIdRef.current = activeVenueId;
  }, [activeVenueId]);

  async function reloadDetail(venueId: string, signal?: AbortSignal) {
    if (!venueId) {
      setVenueUsers([]);
      setVenueScreens(null);
      return { users: [], screens: null as TvScreensPayload | null };
    }

    const [users, screens] = await Promise.all([
      fetchVenueUsers(authHeader, venueId, signal),
      fetchVenueScreens(authHeader, venueId, signal)
    ]);
    setVenueUsers(users);
    setVenueScreens(screens);
    return { users, screens };
  }

  useEffect(() => {
    if (!activeVenueId) {
      setVenueUsers([]);
      setVenueScreens(null);
      return;
    }

    let alive = true;
    const venueId = activeVenueId;
    const controller = new AbortController();
    setLoading("正在加载场馆账号与设备...");
    reloadDetail(activeVenueId, controller.signal)
      .catch((error) => {
        if (!alive) return;
        if (venueId !== activeVenueIdRef.current && String((error as Error)?.message || "").includes("场馆不存在")) {
          return;
        }
        onNotice(error instanceof Error ? error.message : "加载场馆数据失败。", "error");
      })
      .finally(() => setLoading(""));

    return () => {
      alive = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVenueId, authHeader]);

  return {
    venueUsers,
    venueScreens,
    loading,
    setLoading,
    reloadDetail
  };
}
