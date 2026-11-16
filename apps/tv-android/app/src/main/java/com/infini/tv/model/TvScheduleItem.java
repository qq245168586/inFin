package com.infini.tv.model;

import java.time.LocalDateTime;

public class TvScheduleItem {
  public final String id;
  public final CourseScript course;
  public final int courseId;
  public final String courseName;
  public final String version;
  public final String contentChecksum;
  public final LocalDateTime startTime;
  public final LocalDateTime endTime;
  public final boolean isLive;
  public final String logoText;
  public final String logoSource;
  public final ScheduleDisplayFields displayFields;

  public TvScheduleItem(
      String id,
      CourseScript course,
      int courseId,
      String courseName,
      String version,
      String contentChecksum,
      LocalDateTime startTime,
      LocalDateTime endTime,
      boolean isLive,
      String logoText,
      String logoSource,
      ScheduleDisplayFields displayFields) {
    this.id = id;
    this.course = course;
    this.courseId = courseId;
    this.courseName = courseName;
    this.version = version;
    this.contentChecksum = contentChecksum;
    this.startTime = startTime;
    this.endTime = endTime;
    this.isLive = isLive;
    this.logoText = logoText;
    this.logoSource = logoSource;
    this.displayFields = displayFields == null ? ScheduleDisplayFields.EMPTY : displayFields;
  }

  public static class ScheduleDisplayFields {
    public static final ScheduleDisplayFields EMPTY = new ScheduleDisplayFields("", "", "", "", "", "");

    public final String setText;
    public final String workText;
    public final String restText;
    public final String switchText;
    public final String portText;
    public final String leaderText;

    public ScheduleDisplayFields(
        String setText,
        String workText,
        String restText,
        String switchText,
        String portText,
        String leaderText) {
      this.setText = setText == null ? "" : setText.trim();
      this.workText = workText == null ? "" : workText.trim();
      this.restText = restText == null ? "" : restText.trim();
      this.switchText = switchText == null ? "" : switchText.trim();
      this.portText = portText == null ? "" : portText.trim();
      this.leaderText = leaderText == null ? "" : leaderText.trim();
    }
  }
}
