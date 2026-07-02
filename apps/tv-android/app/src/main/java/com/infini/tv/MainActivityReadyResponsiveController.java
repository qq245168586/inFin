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
import com.infini.tv.component.horizontal.HorizontalProgressBarComponent;
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

abstract class MainActivityReadyResponsiveController extends MainActivityHorizontalProgressController {
  protected void showWarmupReadyState(CourseScript course, int remainingSeconds) {
    if (isHorizontalInfoScreen(activeScreenNumber)) {
      showHorizontalMainState(
          course,
          Math.max(remainingSeconds, 0),
          "READY FOR\nWARM UP",
          "",
          0,
          0);
      lastWaterfallAudioMode = "WARMUP_READY";
      lastWaterfallAudioIndex = -1;
      return;
    }

    applyResponsiveLayout();
    updateWaterfallPlayback(
        course == null ? null : course.warmup,
        0,
        "",
        "WARMUP_READY",
        "热身即将开始");
    applyPlaybackTheme(PlaybackTheme.READY);
    playbackCountdownText.setText(formatCountdownSeconds(remainingSeconds));
    playbackStageLabel.setText("");
    playbackStageProgress.setText("READY FOR\nWARM UP");
    renderStageMeta("", 0, 0);
  }

  protected void showWorkoutReadyState(CourseScript course, int remainingSeconds) {
    if (isHorizontalInfoScreen(activeScreenNumber)) {
      showHorizontalMainState(
          course,
          Math.max(remainingSeconds, 0),
          "READY FOR\nWORKOUT",
          "",
          0,
          0);
      rememberTrainingCuePhase("workout-ready", "READY");
      return;
    }

    applyResponsiveLayout();
    suppressTrainingCuePlayback = true;
    try {
      updateTrainingPlayback(course, 0);
    } finally {
      suppressTrainingCuePlayback = false;
    }
    rememberTrainingCuePhase("workout-ready", "READY");
    applyPlaybackTheme(PlaybackTheme.READY);
    playbackCountdownText.setText(formatCountdownSeconds(remainingSeconds));
    playbackStageLabel.setText("");
    playbackStageProgress.setText("READY FOR\nWORKOUT");
    renderStageMeta("", 0, 0);
  }

  protected void showCooldownReadyState(CourseScript course, int remainingSeconds) {
    showFullScreenTransitionState(
        new TrainingPlaybackState(
            "cooldown-ready-finish",
            "",
            "FINISH",
            "",
            Math.max(remainingSeconds, 0),
            new ArrayList<>(),
            -1,
            false,
            false,
            true,
            true,
            "FINISH"));
  }

  protected void showFullScreenTransitionState(TrainingPlaybackState state) {
    if (state == null) {
      return;
    }

    if (isHorizontalInfoScreen(activeScreenNumber)) {
      showHorizontalTransitionState(state);
      return;
    }

    showTransitionDesignState(state, false);
    lastWaterfallIndex = -1;
    lastWaterfallWindowStart = -1;
  }

  protected int getWarmupReadySeconds(CourseScript course) {
    if (course == null || course.warmup == null || course.warmup.items == null || course.warmup.items.isEmpty()) {
      return 0;
    }
    if (course.metadata != null && course.metadata.readyWarmupSeconds >= 0) {
      return course.metadata.readyWarmupSeconds;
    }
    return WARMUP_READY_SECONDS;
  }

  protected int getTrainingReadySeconds(CourseScript course) {
    if (course == null || course.pods == null || course.pods.isEmpty()) {
      return 0;
    }
    if (course.metadata != null && course.metadata.readyWorkoutSeconds >= 0) {
      return course.metadata.readyWorkoutSeconds;
    }
    return TRAINING_READY_SECONDS;
  }

  protected int getCooldownReadySeconds(CourseScript course) {
    if (course == null || course.cooldown == null || course.cooldown.items == null || course.cooldown.items.isEmpty()) {
      return 0;
    }
    if (course.metadata != null && course.metadata.readyCooldownSeconds >= 0) {
      return course.metadata.readyCooldownSeconds;
    }
    return COOLDOWN_READY_SECONDS;
  }

  protected void applyResponsiveLayout() {
    int screenWidth = getResources().getDisplayMetrics().widthPixels;
    int screenHeight = getResources().getDisplayMetrics().heightPixels;
    int shortSide = Math.min(screenWidth, screenHeight);
    int horizontalPadding = clamp(Math.round(shortSide * 0.052f), dp(18), dp(46));
    int verticalPadding = clamp(Math.round(shortSide * 0.042f), dp(14), dp(36));

    if (contentPanel != null) {
      contentPanel.setPadding(horizontalPadding, verticalPadding, horizontalPadding, verticalPadding);
    }
    if (pageTitle != null) {
      pageTitle.setTextSize(TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.115f, sp(30), sp(62)));
    }
    if (pageSubtitle != null) {
      pageSubtitle.setTextSize(TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.038f, sp(14), sp(24)));
    }
    if (screenTag != null) {
      screenTag.setTextSize(TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.03f, sp(12), sp(18)));
    }

    // Keep the vertical workout header at two thirds of the original tall status area.
    boolean previewHeader =
        playbackStatusGroup != null
            && playbackStatusGroup.getVisibility() == View.VISIBLE
            && playbackTimerCard != null
            && playbackTimerCard.getVisibility() == View.GONE;
    int statusHeight =
        clamp(Math.round(shortSide * 0.213f), dp(100), dp(226));
    if (playbackStatusGroup != null) {
      ViewGroup.LayoutParams params = playbackStatusGroup.getLayoutParams();
      if (params != null) {
        params.height = statusHeight;
        playbackStatusGroup.setLayoutParams(params);
      }
    }
    if (playbackTimerCard != null) {
      LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) playbackTimerCard.getLayoutParams();
      if (params != null) {
        params.height = statusHeight;
        params.width = 0;
        params.weight = previewHeader ? 0f : 0.28f;
        playbackTimerCard.setLayoutParams(params);
      }
    }
    if (playbackStageCard != null) {
      LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) playbackStageCard.getLayoutParams();
      if (params != null) {
        params.height = statusHeight;
        params.width = previewHeader ? LinearLayout.LayoutParams.MATCH_PARENT : 0;
        params.weight = previewHeader ? 0f : 0.72f;
        params.leftMargin = previewHeader ? 0 : clamp(Math.round(shortSide * 0.02f), dp(8), dp(16));
        playbackStageCard.setLayoutParams(params);
      }
      playbackStageCard.setPadding(
          dp(previewHeader ? 16 : 18),
          dp(8),
          dp(previewHeader ? 16 : 18),
          dp(8));
    }

    if (playbackCountdownText != null) {
      playbackCountdownText.setTextSize(
          TypedValue.COMPLEX_UNIT_PX, clampPx(statusHeight * 0.82f, sp(84), sp(156)));
    }
    if (playbackStageProgress != null) {
      playbackStageProgress.setGravity(android.view.Gravity.CENTER);
      playbackStageProgress.setTextSize(
          TypedValue.COMPLEX_UNIT_PX,
          previewHeader ? clampPx(statusHeight * 0.30f, sp(34), sp(58)) : clampPx(statusHeight * 0.38f, sp(44), sp(72)));
    }
    if (playbackStageSecondary != null) {
      playbackStageSecondary.setGravity(android.view.Gravity.CENTER);
      playbackStageSecondary.setTextSize(
          TypedValue.COMPLEX_UNIT_PX, previewHeader ? sp(20) : clampPx(statusHeight * 0.20f, sp(22), sp(34)));
    }
    if (playbackHint != null) {
      playbackHint.setTextSize(TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.034f, sp(16), sp(28)));
    }
    if (getReadyCountdownText != null) {
      getReadyCountdownText.setTextSize(
          TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.46f, sp(120), sp(260)));
    }
    if (getReadyLabelText != null) {
      getReadyLabelText.setTextSize(TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.105f, sp(34), sp(64)));
    }
    if (getReadySubtext != null) {
      getReadySubtext.setTextSize(TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.048f, sp(18), sp(30)));
    }
    if (getReadyCircle != null) {
      ViewGroup.LayoutParams params = getReadyCircle.getLayoutParams();
      if (params != null) {
        int size = clamp(Math.round(shortSide * 0.44f), dp(220), dp(460));
        params.width = size;
        params.height = size;
        getReadyCircle.setLayoutParams(params);
      }
    }
    if (finishFallbackText != null) {
      finishFallbackText.setTextSize(TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.085f, sp(30), sp(52)));
    }
    if (finishLogoImage != null) {
      finishLogoImage.setMaxWidth(clamp(Math.round(shortSide * 0.7f), dp(220), dp(560)));
      finishLogoImage.setMaxHeight(clamp(Math.round(shortSide * 0.38f), dp(120), dp(320)));
    }
    if (horizontalRingContainer != null) {
      ViewGroup.LayoutParams rawParams = horizontalRingContainer.getLayoutParams();
      if (rawParams instanceof FrameLayout.LayoutParams) {
        FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) rawParams;
        int ringSize = clamp(Math.round(shortSide * 0.64f), dp(500), dp(780));
        params.width = ringSize;
        params.height = ringSize;
        params.gravity = android.view.Gravity.TOP | android.view.Gravity.LEFT;
        params.leftMargin = clamp(Math.round(screenWidth * 0.07f), dp(72), dp(150));
        params.topMargin = clamp(Math.round(shortSide * 0.10f), dp(48), dp(116));
        horizontalRingContainer.setLayoutParams(params);
      }
    }
    if (horizontalRingProgress != null) {
      horizontalRingProgress.setStrokeWidthPx(clampPx(shortSide * 0.047f, dp(34), dp(60)));
      horizontalRingProgress.setColors(
          getColor(R.color.tv_horizontal_progress_inactive),
          getColor(R.color.tv_horizontal_progress_active),
          getColor(R.color.tv_accent_gold_bright));
      horizontalRingProgress.setDrawThumb(false);
    }
    if (horizontalCountdownText != null) {
      horizontalCountdownText.setTextSize(
          TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.22f, sp(150), sp(260)));
    }
    if (horizontalStateColumn != null) {
      ViewGroup.LayoutParams rawParams = horizontalStateColumn.getLayoutParams();
      if (rawParams instanceof FrameLayout.LayoutParams) {
        FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) rawParams;
        int ringSize = clamp(Math.round(shortSide * 0.64f), dp(500), dp(780));
        int ringTop = clamp(Math.round(shortSide * 0.10f), dp(48), dp(116));
        int stateTop = ringTop + Math.round(ringSize * 0.25f);
        int ringLeft = clamp(Math.round(screenWidth * 0.07f), dp(72), dp(150));
        int left = ringLeft + ringSize + clamp(Math.round(screenWidth * 0.035f), dp(42), dp(92));
        int right = clamp(Math.round(screenWidth * 0.045f), dp(42), dp(90));
        params.width = Math.max(screenWidth - left - right, dp(520));
        params.height = FrameLayout.LayoutParams.WRAP_CONTENT;
        params.gravity = android.view.Gravity.TOP | android.view.Gravity.LEFT;
        params.topMargin = stateTop;
        params.leftMargin = left;
        params.rightMargin = right;
        params.bottomMargin = 0;
        horizontalStateColumn.setLayoutParams(params);
      }
    }
    if (horizontalStateIcon != null) {
      ViewGroup.LayoutParams params = horizontalStateIcon.getLayoutParams();
      if (params != null) {
        int iconSize = clamp(Math.round(shortSide * 0.078f), dp(62), dp(92));
        params.width = iconSize;
        params.height = iconSize;
        horizontalStateIcon.setLayoutParams(params);
      }
    }
    if (horizontalStateText != null) {
      horizontalStateText.setTextSize(
          TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.126f, sp(86), sp(142)));
    }
    if (horizontalStateSecondary != null) {
      horizontalStateSecondary.setTextSize(
          TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.064f, sp(24), sp(42)));
    }
    if (horizontalStateDotsRow != null) {
      horizontalStateDotsRow.removeAllViews();
      horizontalStateDotsRow.setVisibility(View.GONE);
    }
    if (horizontalTransitionCountdownText != null) {
      horizontalTransitionCountdownText.setTextSize(
          TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.40f, sp(150), sp(300)));
    }
    if (horizontalTransitionTitle != null) {
      horizontalTransitionTitle.setTextSize(
          TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.15f, sp(48), sp(96)));
    }
    if (horizontalTransitionHint != null) {
      horizontalTransitionHint.setTextSize(
          TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.055f, sp(22), sp(36)));
    }
    if (horizontalTransitionCircle != null) {
      ViewGroup.LayoutParams params = horizontalTransitionCircle.getLayoutParams();
      if (params != null) {
        int size = clamp(Math.round(shortSide * 0.40f), dp(320), dp(560));
        params.width = size;
        params.height = size;
        horizontalTransitionCircle.setLayoutParams(params);
      }
    }
    int horizontalProgressBottomMargin = clamp(Math.round(shortSide * 0.055f), dp(42), dp(76));
    int horizontalProgressWidth =
        clamp(Math.round(screenWidth * 0.86f), dp(760), Math.max(screenWidth - dp(80), dp(760)));
    if (horizontalProgressRow != null) {
      ViewGroup.LayoutParams rawParams = horizontalProgressRow.getLayoutParams();
      if (rawParams instanceof FrameLayout.LayoutParams) {
        FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) rawParams;
        params.width = horizontalProgressWidth;
        params.height = FrameLayout.LayoutParams.WRAP_CONTENT;
        params.gravity = android.view.Gravity.BOTTOM | android.view.Gravity.CENTER_HORIZONTAL;
        params.leftMargin = 0;
        params.rightMargin = 0;
        params.bottomMargin = horizontalProgressBottomMargin;
        horizontalProgressRow.setLayoutParams(params);
      }
    }
    if (horizontalWorkTimeText != null) {
      horizontalWorkTimeText.setTextSize(
          TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.026f, sp(16), sp(26)));
      ViewGroup.LayoutParams rawParams = horizontalWorkTimeText.getLayoutParams();
      if (rawParams instanceof FrameLayout.LayoutParams) {
        FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) rawParams;
        params.width = horizontalProgressWidth;
        params.height = FrameLayout.LayoutParams.WRAP_CONTENT;
        params.gravity = android.view.Gravity.BOTTOM | android.view.Gravity.CENTER_HORIZONTAL;
        params.leftMargin = 0;
        params.rightMargin = 0;
        params.bottomMargin = Math.max(dp(4), horizontalProgressBottomMargin - dp(42));
        horizontalWorkTimeText.setLayoutParams(params);
      }
    }
    if (horizontalLogoText != null) {
      horizontalLogoText.setTextSize(TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.035f, sp(24), sp(38)));
      ViewGroup.LayoutParams rawParams = horizontalLogoText.getLayoutParams();
      if (rawParams instanceof FrameLayout.LayoutParams) {
        FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) rawParams;
        params.bottomMargin = clamp(Math.round(shortSide * 0.025f), dp(18), dp(34));
        horizontalLogoText.setLayoutParams(params);
      }
    }
    if (horizontalScheduleTitle != null) {
      horizontalScheduleTitle.setTextSize(
          TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.085f, sp(24), sp(52)));
    }
    if (horizontalScheduleSubtitle != null) {
      horizontalScheduleSubtitle.setTextSize(
          TypedValue.COMPLEX_UNIT_PX, clampPx(shortSide * 0.035f, sp(13), sp(22)));
    }

    updateScheduleLayoutBounds(screenWidth, screenHeight, shortSide);
  }

  protected void updateScheduleLayoutBounds(int screenWidth, int screenHeight, int shortSide) {
    if (scheduleList != null) {
      ViewGroup.LayoutParams rawParams = scheduleList.getLayoutParams();
      if (rawParams instanceof LinearLayout.LayoutParams) {
        LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) rawParams;
        params.width =
            isVerticalCourseScreen(activeScreenNumber)
                ? Math.min(Math.round(screenWidth * 0.88f), dp(936))
                : LinearLayout.LayoutParams.MATCH_PARENT;
        scheduleList.setLayoutParams(params);
      }
    }

    if (scheduleStateText != null) {
      ViewGroup.LayoutParams rawParams = scheduleStateText.getLayoutParams();
      if (rawParams instanceof LinearLayout.LayoutParams) {
        LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) rawParams;
        params.width =
            isVerticalCourseScreen(activeScreenNumber)
                ? Math.min(Math.round(screenWidth * 0.88f), dp(936))
                : LinearLayout.LayoutParams.MATCH_PARENT;
        scheduleStateText.setLayoutParams(params);
      }
    }

    if (horizontalScheduleList != null) {
      ViewGroup.LayoutParams rawParams = horizontalScheduleList.getLayoutParams();
      if (rawParams instanceof LinearLayout.LayoutParams) {
        LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) rawParams;
        params.width =
            isPortraitViewport()
                ? Math.min(Math.round(screenWidth * 0.88f), dp(936))
                : LinearLayout.LayoutParams.MATCH_PARENT;
        horizontalScheduleList.setLayoutParams(params);
      }
    }
  }

  protected int clamp(int value, int min, int max) {
    return Math.max(min, Math.min(max, value));
  }

  protected float clampPx(float value, float min, float max) {
    return Math.max(min, Math.min(max, value));
  }

  protected float sp(int value) {
    return TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_SP, value, getResources().getDisplayMetrics());
  }

  protected void applyPlaybackTheme(PlaybackTheme theme) {
    if (playbackTimerCard == null || playbackStageCard == null) {
      return;
    }

    PlaybackTheme safeTheme = theme == null ? PlaybackTheme.NORMAL : theme;
    switch (safeTheme) {
      case READY:
        playbackTimerCard.setBackgroundResource(R.drawable.bg_playback_timer_card_ready);
        playbackStageCard.setBackgroundResource(R.drawable.bg_playback_stage_card);
        break;
      case MOVE_STATION:
        playbackTimerCard.setBackgroundResource(R.drawable.bg_playback_timer_card_move_station);
        playbackStageCard.setBackgroundResource(R.drawable.bg_playback_stage_card);
        break;
      case MOVE_ZONE:
        playbackTimerCard.setBackgroundResource(R.drawable.bg_playback_timer_card_move_station);
        playbackStageCard.setBackgroundResource(R.drawable.bg_playback_stage_card);
        break;
      case HYDRATE:
        playbackTimerCard.setBackgroundResource(R.drawable.bg_playback_timer_card_hydrate);
        playbackStageCard.setBackgroundResource(R.drawable.bg_playback_stage_card);
        break;
      case NORMAL:
      default:
        playbackTimerCard.setBackgroundResource(R.drawable.bg_playback_timer_card);
        playbackStageCard.setBackgroundResource(R.drawable.bg_playback_stage_card);
        break;
    }
  }
}
