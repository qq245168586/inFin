import useHomeScheduleVm from "../../viewmodels/home/useHomeScheduleVm.ts";
import HomePage from "../HomePage.tsx";
import CopyWeekSchedulesDialog from "../schedules/CopyWeekSchedulesDialog.tsx";
import ScheduleDialog from "../schedules/ScheduleDialog.tsx";
import { useMeta } from "../../providers/MetaProvider.tsx";
import { useAuth } from "../../providers/AuthProvider.tsx";
import { useBusy } from "../../providers/BusyProvider.tsx";
import { useNotice } from "../../providers/NoticeProvider.tsx";
import type { CoursePackageRecord } from "../venues/types.ts";
import { filterCoursesByCoursePackage } from "../../utils/coursePackageScope.ts";

export default function HomeRoute({
  selectedCoursePackage,
  onOpenScheduleCourseEditor
}: {
  selectedCoursePackage: CoursePackageRecord | null;
  onOpenScheduleCourseEditor: (courseId: number) => void;
}) {
  const { appData } = useMeta();
  const { authHeader } = useAuth();
  const { setBusyText } = useBusy();
  const { pushNotice } = useNotice();

  const courses = filterCoursesByCoursePackage(appData?.courses || [], selectedCoursePackage);
  const coursePackages = selectedCoursePackage ? [selectedCoursePackage] : [];

  const vm = useHomeScheduleVm({
    courses,
    coursePackages,
    authHeader,
    onBusyText: setBusyText,
    onNotice: pushNotice
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
        onGoToday={vm.goToday}
        schedules={vm.visibleSchedules}
        scheduleLoading={vm.scheduleLoading}
        onAddSchedule={vm.openScheduleDialog}
        onCopyWeekSchedules={vm.openCopyWeekDialog}
        onOpenScheduleCourseEditor={onOpenScheduleCourseEditor}
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
