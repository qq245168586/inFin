import useHomeScheduleVm from "../../viewmodels/home/useHomeScheduleVm.ts";
import HomePage from "../HomePage.tsx";
import ScheduleDialog from "../schedules/ScheduleDialog.tsx";
import { useMeta } from "../../providers/MetaProvider.tsx";
import { useBusy } from "../../providers/BusyProvider.tsx";
import { useNotice } from "../../providers/NoticeProvider.tsx";
import type { CoursePackageRecord } from "../venues/types.ts";
import { filterCoursesByCoursePackage, filterSchedulesByCoursePackage } from "../../utils/coursePackageScope.ts";

export default function HomeRoute({
  selectedCoursePackage
}: {
  selectedCoursePackage: CoursePackageRecord | null;
}) {
  const { appData, reloadMeta } = useMeta();
  const { setBusyText } = useBusy();
  const { pushNotice } = useNotice();

  const courses = filterCoursesByCoursePackage(appData?.courses || [], selectedCoursePackage);
  const coursePackages = selectedCoursePackage ? [selectedCoursePackage] : [];
  const rawSchedules = appData?.schedules || { currentWeek: [], lastWeek: [], history: [] };
  const schedules = {
    currentWeek: filterSchedulesByCoursePackage(rawSchedules.currentWeek, selectedCoursePackage),
    lastWeek: filterSchedulesByCoursePackage(rawSchedules.lastWeek, selectedCoursePackage),
    history: filterSchedulesByCoursePackage(rawSchedules.history, selectedCoursePackage)
  };

  const vm = useHomeScheduleVm({
    courses,
    coursePackages,
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
          coursePackage={selectedCoursePackage}
          courseGroups={vm.courseGroups}
          onDraftChange={vm.updateScheduleDraft}
          onClose={vm.closeScheduleDialog}
          onConfirm={vm.saveSchedule}
        />
      ) : null}
    </>
  );
}
