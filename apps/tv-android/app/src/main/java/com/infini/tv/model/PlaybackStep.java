package com.infini.tv.model;

public class PlaybackStep {
  public final String stage;
  public final String label;
  public final int startOffsetSeconds;
  public final int durationSeconds;
  public final int screenIndex;
  public final String stationNumber;
  public final String actionName;
  public final String overlayText;

  public PlaybackStep(
      String stage,
      String label,
      int startOffsetSeconds,
      int durationSeconds,
      int screenIndex,
      String stationNumber,
      String actionName,
      String overlayText) {
    this.stage = stage;
    this.label = label;
    this.startOffsetSeconds = startOffsetSeconds;
    this.durationSeconds = durationSeconds;
    this.screenIndex = screenIndex;
    this.stationNumber = stationNumber;
    this.actionName = actionName;
    this.overlayText = overlayText;
  }
}
