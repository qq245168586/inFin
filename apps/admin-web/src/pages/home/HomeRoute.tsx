import useHomeScheduleVm from "../../viewmodels/home/useHomeScheduleVm.ts";
import HomePage from "../HomePage.tsx";
import ScheduleDialog from "../schedules/ScheduleDialog.tsx";
import { useMeta } from "../../providers/MetaProvider.tsx";
import { useBusy } from "../../providers/BusyProvider.tsx";
import { useNotice } from "../../providers/NoticeProvider.tsx";

export default function HomeRoute() {
  const { appData, reloadMeta } = useMeta();
  const { setBusyText } = useBusy();
  const { pushNotice } = useNotice();

  const courses = appData?.courses || [];
  const schedules = appData?.schedules || { currentWeek: [], lastWeek: [], history: [] };

  const vm = useHomeScheduleVm({
    courses,
    schedules,
    onBusyText: setBusyText,
    onNotice: pushNotice,
    onReloadMeta: reloadMeta
  });

  return (
    <>
      <HomePage
        weekDays={vm.weekDays}
        homeTab={vm.homeTab}
        onHomeTabChange={vm.setHomeTab}
        selectedScheduleDate={vm.selectedScheduleDate}
        onSelectedScheduleDateChange={vm.setSelectedScheduleDate}
        schedules={vm.visibleSchedules}
        onAddSchedule={vm.openScheduleDialog}
        onCopyLastWeek={vm.copyLastWeek}
        onDeleteSchedule={vm.removeSchedule}
      />

      {vm.scheduleDraft ? (
        <ScheduleDialog
          draft={vm.scheduleDraft}
          courseGroups={vm.courseGroups}
          onDraftChange={vm.updateScheduleDraft}
          onClose={vm.closeScheduleDialog}
          onConfirm={vm.saveSchedule}
        />
      ) : null}
    </>
  );
}
