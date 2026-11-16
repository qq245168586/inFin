package com.infini.tv.mvi;

public final class TvViewState {
  public final int screenNumber;
  public final TvSurface surface;
  public final TvPlaybackStatus playbackStatus;
  public final String scheduleId;
  public final int courseId;
  public final boolean syncInProgress;
  public final boolean syncFailed;

  private TvViewState(
      int screenNumber,
      TvSurface surface,
      TvPlaybackStatus playbackStatus,
      String scheduleId,
      int courseId,
      boolean syncInProgress,
      boolean syncFailed) {
    this.screenNumber = screenNumber;
    this.surface = surface;
    this.playbackStatus = playbackStatus;
    this.scheduleId = scheduleId == null ? "" : scheduleId;
    this.courseId = courseId;
    this.syncInProgress = syncInProgress;
    this.syncFailed = syncFailed;
  }

  public static TvViewState initial() {
    return new TvViewState(0, TvSurface.SELECTOR, TvPlaybackStatus.IDLE, "", 0, false, false);
  }

  public TvViewState withScreenNumber(int nextScreenNumber) {
    return new TvViewState(
        nextScreenNumber, surface, playbackStatus, scheduleId, courseId, syncInProgress, syncFailed);
  }

  public TvViewState withSurface(TvSurface nextSurface) {
    return new TvViewState(
        screenNumber, nextSurface, playbackStatus, scheduleId, courseId, syncInProgress, syncFailed);
  }

  public TvViewState withPlayback(
      TvPlaybackStatus nextPlaybackStatus, String nextScheduleId, int nextCourseId, TvSurface nextSurface) {
    return new TvViewState(
        screenNumber,
        nextSurface,
        nextPlaybackStatus,
        nextScheduleId,
        nextCourseId,
        syncInProgress,
        syncFailed);
  }

  public TvViewState withSync(boolean nextSyncInProgress, boolean nextSyncFailed) {
    return new TvViewState(
        screenNumber, surface, playbackStatus, scheduleId, courseId, nextSyncInProgress, nextSyncFailed);
  }
}
