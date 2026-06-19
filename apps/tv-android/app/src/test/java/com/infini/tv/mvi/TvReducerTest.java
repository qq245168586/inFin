package com.infini.tv.mvi;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertSame;

import org.junit.Test;

public class TvReducerTest {
  @Test
  public void reduce_unknownIntentKeepsNoActionScreenStateUnchanged() {
    TvViewState state = TvViewState.initial();

    TvViewState reduced = TvReducer.reduce(state, new TvIntent() {});

    assertSame(state, reduced);
    assertEquals(TvSurface.SELECTOR, reduced.surface);
    assertEquals(TvPlaybackStatus.IDLE, reduced.playbackStatus);
    assertFalse(reduced.syncInProgress);
    assertFalse(reduced.syncFailed);
  }

  @Test
  public void reduce_startPreviewMovesToPlaybackWithoutLosingScreenNumber() {
    TvViewState state = TvReducer.reduce(TvViewState.initial(), new TvIntent.SelectScreen(3));

    TvViewState reduced = TvReducer.reduce(state, new TvIntent.StartPlayback("schedule-1", 42, true));

    assertEquals(3, reduced.screenNumber);
    assertEquals(TvSurface.PLAYBACK, reduced.surface);
    assertEquals(TvPlaybackStatus.PREVIEW, reduced.playbackStatus);
    assertEquals("schedule-1", reduced.scheduleId);
    assertEquals(42, reduced.courseId);
  }

  @Test
  public void reduce_finishPlaybackClearsActiveCourseAndShowsFinishSurface() {
    TvViewState running =
        TvReducer.reduce(TvViewState.initial(), new TvIntent.StartPlayback("schedule-1", 42, false));

    TvViewState reduced = TvReducer.reduce(running, new TvIntent.FinishPlayback());

    assertEquals(TvSurface.FINISH, reduced.surface);
    assertEquals(TvPlaybackStatus.FINISHED, reduced.playbackStatus);
    assertEquals("", reduced.scheduleId);
    assertEquals(0, reduced.courseId);
  }
}
