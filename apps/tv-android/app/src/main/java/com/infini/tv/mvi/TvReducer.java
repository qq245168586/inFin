package com.infini.tv.mvi;

public final class TvReducer {
  private TvReducer() {}

  public static TvViewState reduce(TvViewState state, TvIntent intent) {
    TvViewState current = state == null ? TvViewState.initial() : state;
    if (intent instanceof TvIntent.SelectScreen) {
      TvIntent.SelectScreen selectScreen = (TvIntent.SelectScreen) intent;
      return current.withScreenNumber(selectScreen.screenNumber);
    }
    if (intent instanceof TvIntent.ShowSurface) {
      TvIntent.ShowSurface showSurface = (TvIntent.ShowSurface) intent;
      return current.withSurface(showSurface.surface);
    }
    if (intent instanceof TvIntent.StartPlayback) {
      TvIntent.StartPlayback startPlayback = (TvIntent.StartPlayback) intent;
      return current.withPlayback(
          startPlayback.preview ? TvPlaybackStatus.PREVIEW : TvPlaybackStatus.RUNNING,
          startPlayback.scheduleId,
          startPlayback.courseId,
          TvSurface.PLAYBACK);
    }
    if (intent instanceof TvIntent.PausePlayback) {
      return current.withPlayback(
          TvPlaybackStatus.PAUSED, current.scheduleId, current.courseId, TvSurface.PLAYBACK);
    }
    if (intent instanceof TvIntent.ResumePlayback) {
      return current.withPlayback(
          TvPlaybackStatus.RUNNING, current.scheduleId, current.courseId, TvSurface.PLAYBACK);
    }
    if (intent instanceof TvIntent.FinishPlayback) {
      return current.withPlayback(TvPlaybackStatus.FINISHED, "", 0, TvSurface.FINISH);
    }
    if (intent instanceof TvIntent.UpdateSyncState) {
      TvIntent.UpdateSyncState syncState = (TvIntent.UpdateSyncState) intent;
      return current.withSync(syncState.inProgress, syncState.failed);
    }
    return current;
  }
}
