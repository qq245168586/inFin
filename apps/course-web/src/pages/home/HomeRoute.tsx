import useHomeScheduleVm from "../../viewmodels/home/useHomeScheduleVm.ts";
import HomePage from "../HomePage.tsx";
import CopyWeekSchedulesDialog from "../schedules/CopyWeekSchedulesDialog.tsx";
import ScheduleDialog from "../schedules/ScheduleDialog.tsx";
import { useMeta } from "../../providers/MetaProvider.tsx";
import { useAuth } from "../../providers/AuthProvider.tsx";
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
  const { authHeader } = useAuth();
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
    authHeader,
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
        scheduleAnchorDate={vm.scheduleAnchorDate}
        onScheduleAnchorDateChange={vm.setScheduleAnchorDate}
        onMoveScheduleWeek={vm.moveScheduleWeek}
        schedules={vm.visibleSchedules}
        onAddSchedule={vm.openScheduleDialog}
        onCopyWeekSchedules={vm.openCopyWeekDialog}
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

      {vm.copyWeekDraft ? (
        <CopyWeekSchedulesDialog
          draft={vm.copyWeekDraft}
          onDraftChange={vm.updateCopyWeekDraft}
          onClose={vm.closeCopyWeekDialog}
          onConfirm={() => void vm.copyWeek()}
        />
      ) : null}
    </>
  );
}
