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
      String logoSource) {
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
  }
}
