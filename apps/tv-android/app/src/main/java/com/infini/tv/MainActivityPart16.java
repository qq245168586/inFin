package com.infini.tv;

import android.content.ComponentName;
import android.content.ClipData;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.SoundPool;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.security.NetworkSecurityPolicy;
import android.text.TextUtils;
import android.util.Log;
import android.util.TypedValue;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.VideoView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
import com.infini.tv.component.HorizontalProgressBarComponent;
import com.infini.tv.model.CourseScript;
import com.infini.tv.model.TvScheduleItem;
import com.infini.tv.mqtt.TvMqttManager;
import com.infini.tv.repository.ServerConfig;
import com.infini.tv.repository.TvScriptRepository;
import com.infini.tv.service.ImageLoader;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

abstract class MainActivityPart16 extends MainActivityPart15 {
  protected void prepareFinishContentLayout() {
    int screenWidth = getResources().getDisplayMetrics().widthPixels;
    int screenHeight = getResources().getDisplayMetrics().heightPixels;
    int shortSide = Math.min(screenWidth, screenHeight);
    if (finishPanel != null) {
      ViewGroup.LayoutParams rawParams = finishPanel.getLayoutParams();
      if (isHorizontalInfoScreen(activeScreenNumber)) {
        rawParams.width = ViewGroup.LayoutParams.MATCH_PARENT;
        rawParams.height = ViewGroup.LayoutParams.MATCH_PARENT;
        finishPanel.setLayoutParams(rawParams);
        finishPanel.setPadding(dp(48), dp(48), dp(48), dp(48));
      }
    }
    if (finishLogoImage != null) {
      finishLogoImage.setMaxWidth(
          isHorizontalInfoScreen(activeScreenNumber)
              ? clamp(Math.round(screenWidth * 0.46f), dp(360), dp(900))
              : clamp(Math.round(shortSide * 0.7f), dp(220), dp(560)));
      finishLogoImage.setMaxHeight(
          isHorizontalInfoScreen(activeScreenNumber)
              ? clamp(Math.round(screenHeight * 0.38f), dp(220), dp(460))
              : clamp(Math.round(shortSide * 0.38f), dp(120), dp(320)));
    }
    if (finishFallbackText != null) {
      finishFallbackText.setTextSize(
          TypedValue.COMPLEX_UNIT_PX,
          isHorizontalInfoScreen(activeScreenNumber)
              ? clampPx(shortSide * 0.09f, sp(46), sp(92))
              : clampPx(shortSide * 0.085f, sp(30), sp(52)));
      finishFallbackText.setGravity(android.view.Gravity.CENTER);
      finishFallbackText.setSingleLine(true);
      finishFallbackText.setMaxLines(1);
    }
  }

  protected int resolveFinishLogoTargetWidth() {
    int screenWidth = getResources().getDisplayMetrics().widthPixels;
    int screenHeight = getResources().getDisplayMetrics().heightPixels;
    int shortSide = Math.min(screenWidth, screenHeight);
    return isHorizontalInfoScreen(activeScreenNumber)
        ? clamp(Math.round(screenWidth * 0.46f), dp(360), dp(900))
        : clamp(Math.round(shortSide * 0.7f), dp(220), dp(560));
  }

  protected int resolveFinishLogoTargetHeight() {
    int screenWidth = getResources().getDisplayMetrics().widthPixels;
    int screenHeight = getResources().getDisplayMetrics().heightPixels;
    int shortSide = Math.min(screenWidth, screenHeight);
    return isHorizontalInfoScreen(activeScreenNumber)
        ? clamp(Math.round(screenHeight * 0.38f), dp(220), dp(460))
        : clamp(Math.round(shortSide * 0.38f), dp(120), dp(320));
  }

  protected void clearWaterfallRows() {
    for (WaterfallRowView row : waterfallRows) {
      stopWaterfallVideo(row);
    }
    waterfallRows.clear();
    warmupRowsContainer.removeAllViews();
    playbackScrollView.scrollTo(0, 0);
  }

  protected void stopPlaybackLoop() {
    playbackLoopRunning = false;
    playbackHandler.removeCallbacks(playbackTicker);
    resetPlaybackStateCaches();
  }

  protected void stopPlayback() {
    hideCoursePlanPanel();
    cancelFinishReturn();
    stopPlaybackLoop();
    resetAudioCueTracking();
    previewMode = false;
    playbackPaused = false;
    activePlaybackItem = null;
    playbackStartElapsedRealtimeMs = 0L;
    accumulatedPauseElapsedRealtimeMs = 0L;
    pauseStartedElapsedRealtimeMs = 0L;
    frozenElapsedMs = 0L;
    activePlaybackSessionId = "";
    activePlaybackSessionVersion = 0;
    activePlaybackSessionState = "";
    sessionDrivenPlayback = false;
    clearPlaybackSessionTiming();
    activeBundleChecksum = "";
    currentCourseElapsedSeconds = 0;
    currentCourseTotalSeconds = 0;
    currentTrainingElapsedSeconds = 0;
    currentTrainingTotalSeconds = 0;
    scheduleScrollView.setVisibility(View.VISIBLE);
    if (getReadyPanel != null) {
      getReadyPanel.setVisibility(View.GONE);
    }
    hideFinishPanel();
    playbackScrollView.setVisibility(View.VISIBLE);
    clearWaterfallRows();
    trainingCardsContainer.removeAllViews();
    trainingCardsContainer.setVisibility(View.GONE);
    warmupRowsContainer.setVisibility(View.VISIBLE);
    if (horizontalPlaybackPanel != null) {
      horizontalPlaybackPanel.setVisibility(View.GONE);
    }
    if (horizontalLoadingText != null) {
      horizontalLoadingText.setVisibility(View.GONE);
    }
    if (horizontalScheduleScroll != null) {
      horizontalScheduleScroll.setVisibility(View.GONE);
    }
    if (horizontalContentPanel != null) {
      horizontalContentPanel.setVisibility(View.GONE);
    }
    if (horizontalTransitionPanel != null) {
      horizontalTransitionPanel.setVisibility(View.GONE);
    }
    hideTransitionDesign();
    if (horizontalProgressRow != null) {
      horizontalProgressRow.removeAllViews();
    }
    configureVerticalPlaybackHeader(false);
    dispatchScreenHeartbeat(false);
  }

  protected void hideCoursePlanPanel() {
    if (coursePlanPanel == null) {
      return;
    }
    coursePlanPanel.removeAllViews();
    coursePlanPanel.setVisibility(View.GONE);
    coursePlanPanel.setClickable(false);
    coursePlanPanel.setFocusable(false);
  }

  protected void showCoursePlanFromRemote(
      String scheduleId,
      int courseId,
      String courseName,
      String playbackSessionId,
      org.json.JSONObject coursePlanJson) {
    bringPlaybackUiToFront();
    CourseScript.Plan plan = parseCoursePlanFromJson(coursePlanJson);
    TvScheduleItem schedule = findScheduleForCoursePlan(scheduleId, courseId);
    if (!hasCoursePlanContent(plan) && schedule != null && schedule.course != null) {
      plan = schedule.course.plan;
    }

    String resolvedName = courseName == null ? "" : courseName.trim();
    if (resolvedName.isEmpty() && schedule != null) {
      resolvedName = schedule.courseName;
    }
    if (resolvedName == null || resolvedName.trim().isEmpty()) {
      resolvedName = "课程计划";
    }
    String resolvedVersion = "";
    if (schedule != null) {
      resolvedVersion =
          firstScheduleText(
              schedule.course != null && schedule.course.metadata != null ? schedule.course.metadata.version : "",
              schedule.version);
    }
    renderCoursePlanPanel(resolvedName, resolvedVersion, plan);
  }

  protected TvScheduleItem findScheduleForCoursePlan(String scheduleId, int courseId) {
    for (TvScheduleItem schedule : syncedTodaySchedules) {
      if (schedule == null) {
        continue;
      }
      if (!TextUtils.isEmpty(scheduleId) && TextUtils.equals(schedule.id, scheduleId)) {
        return schedule;
      }
      if (courseId > 0 && schedule.courseId == courseId) {
        return schedule;
      }
    }
    if (activePlaybackItem != null) {
      if (!TextUtils.isEmpty(scheduleId) && TextUtils.equals(activePlaybackItem.id, scheduleId)) {
        return activePlaybackItem;
      }
      if (courseId > 0 && activePlaybackItem.courseId == courseId) {
        return activePlaybackItem;
      }
    }
    return null;
  }

  protected CourseScript.Plan parseCoursePlanFromJson(org.json.JSONObject planJson) {
    List<CourseScript.PlanSection> sections = new ArrayList<>();
    if (planJson == null) {
      return new CourseScript.Plan(sections);
    }
    org.json.JSONArray rawSections = planJson.optJSONArray("sections");
    if (rawSections == null) {
      return new CourseScript.Plan(sections);
    }

    for (int index = 0; index < rawSections.length(); index++) {
      org.json.JSONObject sectionJson = rawSections.optJSONObject(index);
      if (sectionJson == null) {
        continue;
      }
      String title = sectionJson.optString("title", "").trim();
      List<CourseScript.PlanItem> items = new ArrayList<>();
      org.json.JSONArray rawItems = sectionJson.optJSONArray("items");
      if (rawItems != null) {
        for (int itemIndex = 0; itemIndex < rawItems.length(); itemIndex++) {
          org.json.JSONObject itemJson = rawItems.optJSONObject(itemIndex);
          String text =
              itemJson == null
                  ? rawItems.optString(itemIndex, "").trim()
                  : itemJson.optString("text", "").trim();
          if (!text.isEmpty()) {
            items.add(new CourseScript.PlanItem(text));
          }
        }
      }
      if (!title.isEmpty() || !items.isEmpty()) {
        sections.add(new CourseScript.PlanSection(title, items));
      }
    }
    return new CourseScript.Plan(sections);
  }

  protected boolean hasCoursePlanContent(CourseScript.Plan plan) {
    if (plan == null || plan.sections == null) {
      return false;
    }
    for (CourseScript.PlanSection section : plan.sections) {
      if (section == null) {
        continue;
      }
      if (!TextUtils.isEmpty(section.title)) {
        return true;
      }
      if (section.items != null && !section.items.isEmpty()) {
        return true;
      }
    }
    return false;
  }

  protected void renderCoursePlanPanel(String courseName, String courseVersion, CourseScript.Plan plan) {
    if (coursePlanPanel == null) {
      return;
    }
    coursePlanPanel.removeAllViews();
    coursePlanPanel.setClickable(true);
    coursePlanPanel.setFocusable(true);

    int screenWidth = getResources().getDisplayMetrics().widthPixels;
    int screenHeight = getResources().getDisplayMetrics().heightPixels;
    int shortSide = Math.min(screenWidth, screenHeight);
    boolean landscape = screenWidth > screenHeight;
    int pagePadding = landscape ? clamp(Math.round(shortSide * 0.045f), dp(28), dp(58))
        : clamp(Math.round(shortSide * 0.055f), dp(24), dp(46));

    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setPadding(pagePadding, pagePadding, pagePadding, pagePadding);
    root.setBackgroundColor(Color.TRANSPARENT);
    coursePlanPanel.addView(
        root,
        new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

    TextView eyebrow = createCoursePlanText("COURSE PLAN", 0x99f5d56e, true);
    eyebrow.setLetterSpacing(0.20f);
    eyebrow.setTextSize(
        TypedValue.COMPLEX_UNIT_PX,
        landscape ? clampPx(shortSide * 0.036f, sp(18), sp(30)) : clampPx(shortSide * 0.038f, sp(16), sp(28)));
    root.addView(eyebrow, new LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

    TextView title = createCoursePlanText(courseName, getColor(R.color.tv_text_main), true);
    title.setGravity(landscape ? android.view.Gravity.LEFT : android.view.Gravity.CENTER);
    title.setTextSize(
        TypedValue.COMPLEX_UNIT_PX,
        landscape ? clampPx(shortSide * 0.066f, sp(34), sp(58)) : clampPx(shortSide * 0.075f, sp(30), sp(54)));
    title.setMaxLines(2);
    title.setEllipsize(TextUtils.TruncateAt.END);
    LinearLayout.LayoutParams titleParams =
        new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
    titleParams.topMargin = landscape ? dp(4) : dp(8);
    root.addView(title, titleParams);

    if (!TextUtils.isEmpty(courseVersion)) {
      TextView version = createCoursePlanText("Version " + courseVersion, Color.rgb(24, 18, 32), true);
      version.setGravity(android.view.Gravity.CENTER);
      version.setBackgroundResource(R.drawable.bg_schedule_version_chip);
      version.setPadding(dp(landscape ? 16 : 14), 0, dp(landscape ? 16 : 14), 0);
      version.setTextSize(
          TypedValue.COMPLEX_UNIT_PX,
          landscape ? clampPx(shortSide * 0.026f, sp(16), sp(24)) : clampPx(shortSide * 0.03f, sp(15), sp(22)));
      version.setSingleLine(true);
      version.setEllipsize(TextUtils.TruncateAt.END);
      LinearLayout.LayoutParams versionParams =
          new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, landscape ? dp(34) : dp(32));
      versionParams.topMargin = landscape ? dp(8) : dp(10);
      if (!landscape) {
        versionParams.gravity = android.view.Gravity.CENTER_HORIZONTAL;
      }
      root.addView(version, versionParams);
    }

    ScrollView scrollView = new ScrollView(this);
    scrollView.setFillViewport(landscape);
    scrollView.setScrollBarStyle(View.SCROLLBARS_INSIDE_INSET);
    LinearLayout.LayoutParams scrollParams =
        new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0);
    scrollParams.weight = 1f;
    scrollParams.topMargin = landscape ? dp(16) : dp(20);
    root.addView(scrollView, scrollParams);

    LinearLayout columns = new LinearLayout(this);
    columns.setOrientation(landscape ? LinearLayout.HORIZONTAL : LinearLayout.VERTICAL);
    columns.setGravity(android.view.Gravity.TOP);
    scrollView.addView(
        columns,
        new ScrollView.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            landscape ? ViewGroup.LayoutParams.MATCH_PARENT : ViewGroup.LayoutParams.WRAP_CONTENT));

    List<CourseScript.PlanSection> sections =
        plan == null || plan.sections == null ? new ArrayList<>() : plan.sections;
    if (sections.isEmpty()) {
      columns.addView(createCoursePlanEmptyView(landscape), columnParams(false, 0));
    } else if (landscape) {
      LinearLayout leftColumn = createCoursePlanColumn();
      LinearLayout rightColumn = createCoursePlanColumn();
      columns.addView(leftColumn, columnParams(true, 0));
      columns.addView(rightColumn, columnParams(true, dp(18)));
      int leftCount = (sections.size() + 1) / 2;
      int rightCount = sections.size() / 2;
      for (int index = 0; index < sections.size(); index++) {
        LinearLayout target = index % 2 == 0 ? leftColumn : rightColumn;
        int sectionsInColumn = index % 2 == 0 ? leftCount : rightCount;
        target.addView(createCoursePlanSectionView(sections.get(index), index, true, sectionsInColumn));
      }
    } else {
      LinearLayout singleColumn = createCoursePlanColumn();
      columns.addView(singleColumn, columnParams(false, 0));
      for (int index = 0; index < sections.size(); index++) {
        singleColumn.addView(createCoursePlanSectionView(sections.get(index), index, false, sections.size()));
      }
    }

    coursePlanPanel.setVisibility(View.VISIBLE);
    coursePlanPanel.bringToFront();
    if (updatePanel != null && updatePanel.getVisibility() == View.VISIBLE) {
      updatePanel.bringToFront();
    }
  }

  protected LinearLayout createCoursePlanColumn() {
    LinearLayout column = new LinearLayout(this);
    column.setOrientation(LinearLayout.VERTICAL);
    column.setGravity(android.view.Gravity.TOP);
    return column;
  }

  protected LinearLayout.LayoutParams columnParams(boolean weighted, int leftMargin) {
    LinearLayout.LayoutParams params =
        new LinearLayout.LayoutParams(
            weighted ? 0 : ViewGroup.LayoutParams.MATCH_PARENT,
            weighted ? ViewGroup.LayoutParams.MATCH_PARENT : ViewGroup.LayoutParams.WRAP_CONTENT);
    if (weighted) {
      params.weight = 1f;
    }
    params.leftMargin = leftMargin;
    return params;
  }

  protected View createCoursePlanEmptyView(boolean landscape) {
    TextView empty = createCoursePlanText("暂无课程计划", getColor(R.color.tv_text_subtle), true);
    empty.setGravity(android.view.Gravity.CENTER);
    empty.setTextSize(
        TypedValue.COMPLEX_UNIT_PX,
        landscape ? clampPx(getResources().getDisplayMetrics().heightPixels * 0.07f, sp(30), sp(52))
            : clampPx(getResources().getDisplayMetrics().widthPixels * 0.065f, sp(22), sp(36)));
    empty.setBackground(createCoursePlanCardBackground(0x5513091f, 0x664b1f7c));
    empty.setPadding(dp(24), dp(42), dp(24), dp(42));
    return empty;
  }

  protected View createCoursePlanSectionView(
      CourseScript.PlanSection section, int sectionIndex, boolean landscape, int sectionsInColumn) {
    LinearLayout card = new LinearLayout(this);
    card.setOrientation(LinearLayout.VERTICAL);
    int denseLevel = landscape ? Math.max(sectionsInColumn, 1) : 1;
    card.setPadding(
        landscape ? dp(16) : dp(20),
        landscape ? dp(12) : dp(18),
        landscape ? dp(16) : dp(20),
        landscape ? dp(12) : dp(20));
    card.setBackground(createCoursePlanCardBackground(0xaa13091f, 0x884b1f7c));
    LinearLayout.LayoutParams cardParams =
        new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            landscape ? 0 : ViewGroup.LayoutParams.WRAP_CONTENT);
    if (landscape) {
      cardParams.weight = 1f;
    }
    cardParams.bottomMargin = landscape ? dp(10) : dp(16);
    card.setLayoutParams(cardParams);

    String title = section == null ? "" : (section.title == null ? "" : section.title.trim());
    if (title.isEmpty()) {
      title = "小节 " + (sectionIndex + 1);
    }
    TextView titleView = createCoursePlanText(title, getColor(R.color.tv_accent_gold_bright), true);
    titleView.setTextSize(
        TypedValue.COMPLEX_UNIT_PX,
        landscape ? clampPx(getResources().getDisplayMetrics().heightPixels * 0.04f, sp(18), sp(denseLevel >= 4 ? 32 : 38))
            : clampPx(getResources().getDisplayMetrics().widthPixels * 0.054f, sp(20), sp(34)));
    titleView.setMaxLines(landscape && denseLevel >= 4 ? 1 : 2);
    titleView.setEllipsize(null);
    configureCoursePlanAutoSize(titleView, landscape ? 14 : 18, landscape && denseLevel >= 4 ? 32 : 38);
    card.addView(
        titleView,
        new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

    List<CourseScript.PlanItem> items =
        section == null || section.items == null ? new ArrayList<>() : section.items;
    for (CourseScript.PlanItem item : items) {
      if (item == null || TextUtils.isEmpty(item.text)) {
        continue;
      }
      TextView itemView = createCoursePlanText("• " + item.text.trim(), getColor(R.color.tv_text_main), false);
      itemView.setLineSpacing(landscape ? dp(2) : dp(4), 1.0f);
      itemView.setTextSize(
          TypedValue.COMPLEX_UNIT_PX,
          landscape ? clampPx(getResources().getDisplayMetrics().heightPixels * 0.032f, sp(13), sp(denseLevel >= 4 ? 24 : 30))
              : clampPx(getResources().getDisplayMetrics().widthPixels * 0.044f, sp(17), sp(28)));
      if (landscape) {
        itemView.setMaxLines(denseLevel >= 4 ? 4 : 5);
        itemView.setEllipsize(null);
        configureCoursePlanAutoSize(itemView, 11, denseLevel >= 4 ? 24 : 30);
      }
      LinearLayout.LayoutParams itemParams =
          new LinearLayout.LayoutParams(
              ViewGroup.LayoutParams.MATCH_PARENT,
              landscape ? 0 : ViewGroup.LayoutParams.WRAP_CONTENT);
      if (landscape) {
        itemParams.weight = 1f;
      }
      itemParams.topMargin = landscape ? dp(6) : dp(10);
      card.addView(itemView, itemParams);
    }
    return card;
  }

  protected void configureCoursePlanAutoSize(TextView view, int minSp, int maxSp) {
    if (view == null) {
      return;
    }
    view.setAutoSizeTextTypeUniformWithConfiguration(minSp, maxSp, 1, TypedValue.COMPLEX_UNIT_SP);
    view.setBreakStrategy(android.text.Layout.BREAK_STRATEGY_BALANCED);
    view.setHyphenationFrequency(android.text.Layout.HYPHENATION_FREQUENCY_NONE);
  }

  protected TextView createCoursePlanText(String text, int color, boolean bold) {
    TextView view = new TextView(this);
    view.setText(text);
    view.setTextColor(color);
    view.setIncludeFontPadding(false);
    if (bold) {
      view.setTypeface(view.getTypeface(), android.graphics.Typeface.BOLD);
    }
    return view;
  }

  protected android.graphics.drawable.GradientDrawable createCoursePlanCardBackground(
      int fillColor, int strokeColor) {
    android.graphics.drawable.GradientDrawable drawable =
        new android.graphics.drawable.GradientDrawable();
    drawable.setShape(android.graphics.drawable.GradientDrawable.RECTANGLE);
    drawable.setColor(fillColor);
    drawable.setCornerRadius(dp(22));
    drawable.setStroke(dp(2), strokeColor);
    return drawable;
  }

  protected int getWaterfallTotalSeconds(CourseScript.WaterfallSection section) {
    if (section == null || section.items == null) {
      return 0;
    }

    int total = 0;
    for (CourseScript.WaterfallItem item : section.items) {
      total += Math.max(item.seconds, 0);
    }
    return total;
  }

  @Override

  protected void onDestroy() {
    stopChecksumPolling();
    stopScreenHeartbeat();
    stopPairingPresence();
    stopPlayback();
    unregisterNetworkMonitoring();
    if (mqttManager != null) {
      mqttManager.disconnect();
    }
    releaseCueSounds();
    super.onDestroy();
  }

  protected int dp(int value) {
    return Math.round(value * getResources().getDisplayMetrics().density);
  }
}
