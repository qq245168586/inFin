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
        pendingAction={vm.pendingAction}
        schedules={vm.filteredSchedules}
        selectedScheduleId={vm.selectedScheduleId}
        onEnterPreview={(schedule) => void vm.enterPreview(schedule)}
        onPause={() => void vm.pauseSelectedCourse()}
        onResume={() => void vm.resumeSelectedCourse()}
        onSelect={vm.selectSchedule}
        onStart={(schedule) => void vm.startCourse(schedule)}
        onTerminate={() => void vm.terminateSelectedCourse()}
        sessionStateForSchedule={vm.sessionStateForSchedule}
      />
      <PreviewPanel
        activePreviewItem={vm.activePreviewItem}
        displayElapsedMs={vm.displayElapsedMs}
        onPrimaryAction={vm.primaryAction}
        onSetPreviewIndex={vm.setPreviewIndex}
        onTerminate={() => void vm.terminateSelectedCourse()}
        onTouchEnd={vm.handleTouchEnd}
        onTouchStart={vm.handleTouchStart}
        pendingAction={vm.pendingAction}
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
