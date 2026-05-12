import { useEffect, useState } from "react";
import type { AppPackageRecord, NoticeFn } from "../../pages/venues/types.ts";
import { fetchTvPackages } from "../../pages/venues/api.ts";

function sortByUpdateTimeDesc(items: AppPackageRecord[]): AppPackageRecord[] {
  return [...items].sort(
    (a, b) => new Date(b.updateTime || b.createTime).getTime() - new Date(a.updateTime || a.createTime).getTime()
  );
}

export function useVenueTvPackagesVm({
  authHeader,
  onNotice
}: {
  authHeader: string;
  onNotice: NoticeFn;
}) {
  const [tvPackages, setTvPackages] = useState<AppPackageRecord[]>([]);
  const [selectedTvPackageId, setSelectedTvPackageId] = useState("");

  async function reloadTvPackages(showNotice = false) {
    try {
      const nextPackages = sortByUpdateTimeDesc(await fetchTvPackages(authHeader));
      setTvPackages(nextPackages);
      if (nextPackages.length && !nextPackages.some((item) => String(item.id) === String(selectedTvPackageId))) {
        setSelectedTvPackageId(String(nextPackages[0].id));
      }
      if (showNotice) onNotice("TV 版本列表已刷新。");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "加载 TV 版本失败。", "error");
    }
  }

  useEffect(() => {
    void reloadTvPackages(false);
    // Intentionally only depends on authHeader: selecting a package should not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authHeader]);

  return {
    tvPackages,
    selectedTvPackageId,
    setSelectedTvPackageId,
    reloadTvPackages
  };
}
