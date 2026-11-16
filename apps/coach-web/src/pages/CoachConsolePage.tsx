import type { CoachConsoleViewModelProps } from "../models/consoleVm";
import { ConsoleToolbar } from "../components/console/ConsoleToolbar";
import { PreviewPanel } from "../components/console/PreviewPanel";
import { ScheduleList } from "../components/console/ScheduleList";
import { WeekStrip } from "../components/console/WeekStrip";
import { useCoachConsoleViewModel } from "../viewModels/useCoachConsoleViewModel";
import { formatDateLabel } from "../utils/time";

export default function CoachConsolePage(props: CoachConsoleViewModelProps) {
  const vm = useCoachConsoleViewModel(props);

  return (
    <section className="coach-console-page">
      <ConsoleToolbar
        dateLabel={formatDateLabel(vm.selectedDate)}
        onRefreshBundle={() => void vm.refreshBundle()}
        onRefreshTv={() => void vm.handleRefreshTv()}
      />
      <WeekStrip days={vm.weekDays} selectedDate={vm.selectedDate} onSelectDate={vm.setSelectedDate} />
      <ScheduleList
        controlButtonsLocked={vm.controlButtonsLocked}
        pendingAction={vm.pendingAction}
        schedules={vm.filteredSchedules}
        selectedScheduleId={vm.selectedScheduleId}
        onEnterPreview={(schedule) => void vm.enterPreview(schedule)}
        onExitPreview={(schedule) => void vm.exitPreview(schedule)}
        onPause={() => void vm.pauseSelectedCourse()}
        onResume={() => void vm.resumeSelectedCourse()}
        onSelect={vm.selectSchedule}
        onShowPlan={(schedule) => void vm.showSelectedCoursePlan(schedule)}
        onStart={(schedule) => void vm.startCourse(schedule)}
        onTerminate={() => void vm.terminateSelectedCourse()}
        sessionStateForSchedule={vm.sessionStateForSchedule}
      />
      <PreviewPanel
        activePreviewItem={vm.activePreviewItem}
        displayElapsedMs={vm.displayElapsedMs}
        onSetPreviewIndex={vm.setPreviewIndex}
        onTouchEnd={vm.handleTouchEnd}
        onTouchStart={vm.handleTouchStart}
        playbackSession={vm.playbackSession}
        previewIndex={vm.previewIndex}
        previewItems={vm.previewItems}
        previewVideoRef={vm.previewVideoRef}
        selectedSchedule={vm.selectedSchedule}
        selectedScheduleId={vm.selectedScheduleId}
        selectedScheduleSessionState={vm.selectedScheduleSessionState}
      />
    </section>
  );
}
