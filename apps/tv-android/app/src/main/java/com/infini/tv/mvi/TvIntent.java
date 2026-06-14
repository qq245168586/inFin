package com.infini.tv.mvi;

public interface TvIntent {
  final class SelectScreen implements TvIntent {
    public final int screenNumber;

    public SelectScreen(int screenNumber) {
      this.screenNumber = screenNumber;
    }
  }

  final class ShowSurface implements TvIntent {
    public final TvSurface surface;

    public ShowSurface(TvSurface surface) {
      this.surface = surface;
    }
  }

  final class StartPlayback implements TvIntent {
    public final String scheduleId;
    public final int courseId;
    public final boolean preview;

    public StartPlayback(String scheduleId, int courseId, boolean preview) {
      this.scheduleId = scheduleId == null ? "" : scheduleId;
      this.courseId = courseId;
      this.preview = preview;
    }
  }

  final class PausePlayback implements TvIntent {}

  final class ResumePlayback implements TvIntent {}

  final class FinishPlayback implements TvIntent {}

  final class UpdateSyncState implements TvIntent {
    public final boolean inProgress;
    public final boolean failed;

    public UpdateSyncState(boolean inProgress, boolean failed) {
      this.inProgress = inProgress;
      this.failed = failed;
    }
  }
}
