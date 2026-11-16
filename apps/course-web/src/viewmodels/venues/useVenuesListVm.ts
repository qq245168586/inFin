import { useEffect, useMemo, useRef, useState } from "react";
import type { NoticeFn, VenueRecord } from "../../pages/venues/types.ts";
import { createVenue, deleteVenue, fetchVenues } from "../../pages/venues/api.ts";
import { persistActiveVenueId, readActiveVenueId } from "../../pages/venues/storage.ts";

type VenuesChangeFn = (venues: VenueRecord[]) => void;

export function useVenuesListVm({
  authHeader,
  onNotice,
  onVenuesChange
}: {
  authHeader: string;
  onNotice: NoticeFn;
  onVenuesChange?: VenuesChangeFn;
}) {
  const [venues, setVenues] = useState<VenueRecord[]>([]);
  const [activeVenueId, setActiveVenueId] = useState<string>(() => readActiveVenueId());
  const [loading, setLoading] = useState("");
  const [createVenueOpen, setCreateVenueOpen] = useState(false);
  const [newVenueName, setNewVenueName] = useState("");
  const lastActiveVenueIdRef = useRef(activeVenueId);

  const activeVenue = useMemo(
    () => venues.find((item) => String(item.id) === String(activeVenueId)) ?? null,
    [venues, activeVenueId]
  );

  const venueById = useMemo(() => {
    const map = new Map<string, VenueRecord>();
    for (const venue of venues) map.set(String(venue.id), venue);
    return map;
  }, [venues]);

  useEffect(() => {
    lastActiveVenueIdRef.current = activeVenueId;
    persistActiveVenueId(activeVenueId);
  }, [activeVenueId]);

  async function reloadVenues(signal?: AbortSignal) {
    const nextVenues = await fetchVenues(authHeader, signal);
    setVenues(nextVenues);
    onVenuesChange?.(nextVenues);
    const savedStillExists =
      lastActiveVenueIdRef.current && nextVenues.some((venue) => String(venue.id) === String(lastActiveVenueIdRef.current));
    if (!savedStillExists && nextVenues.length) {
      setActiveVenueId(String(nextVenues[0].id));
    }
    return nextVenues;
  }

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setLoading("正在加载场馆...");
    reloadVenues(controller.signal)
      .catch((error) => {
        if (!alive) return;
        onNotice(error instanceof Error ? error.message : "加载场馆失败。", "error");
      })
      .finally(() => setLoading(""));
    return () => {
      alive = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authHeader]);

  async function handleCreateVenue() {
    if (!newVenueName.trim()) {
      onNotice("请填写场馆名称。", "error");
      return;
    }
    setLoading("正在创建场馆...");
    try {
      const venue = await createVenue(authHeader, newVenueName.trim());
      setVenues((current) => {
        const next = [venue, ...current];
        onVenuesChange?.(next);
        return next;
      });
      setActiveVenueId(String(venue.id));
      setCreateVenueOpen(false);
      setNewVenueName("");
      onNotice("场馆已创建。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "创建场馆失败。", "error");
    } finally {
      setLoading("");
    }
  }

  async function handleDeleteVenue() {
    if (!activeVenueId || !activeVenue) return;
    if (!window.confirm(`确认删除场馆「${activeVenue.name}」吗？该操作会解绑该场馆下的账号与设备。`)) return;
    setLoading("正在删除场馆...");
    try {
      await deleteVenue(authHeader, activeVenueId);
      setVenues((current) => {
        const next = current.filter((item) => String(item.id) !== String(activeVenueId));
        onVenuesChange?.(next);
        return next;
      });
      setActiveVenueId("");
      onNotice("场馆已删除。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "删除场馆失败。", "error");
    } finally {
      setLoading("");
    }
  }

  return {
    venues,
    activeVenueId,
    setActiveVenueId,
    activeVenue,
    venueById,
    loading,
    setLoading,
    reloadVenues,
    createVenueOpen,
    setCreateVenueOpen,
    newVenueName,
    setNewVenueName,
    handleCreateVenue,
    handleDeleteVenue
  };
}
