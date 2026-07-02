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

abstract class MainActivityHorizontalProgressController extends MainActivityHorizontalWorkTimelineController {
  protected void bindTransitionDesignTitle(
      String transitionType, boolean horizontal, int screenWidth, int screenHeight, int shortSide) {
    if (transitionDesignTitle == null) {
      return;
    }
    String title =
        "HYDRATE".equals(transitionType)
            ? "HYDRATE"
            : ("REST".equals(transitionType)
                ? "REST"
                : ("WORK".equals(transitionType)
                    ? "WORK"
                    : ("FINISH".equals(transitionType)
                        ? "FINISH"
                        : ("SWITCH".equals(transitionType)
                            ? "SWITCH"
                            : ("MOVE_ZONE".equals(transitionType) ? "MOVE\nZONE" : "MOVE\nSTATION")))));
    transitionDesignTitle.setText(title);
    boolean hydrate = "HYDRATE".equals(transitionType);
    boolean rest = "REST".equals(transitionType);
    boolean work = "WORK".equals(transitionType);
    boolean finish = "FINISH".equals(transitionType);
    boolean moveStation = !"HYDRATE".equals(transitionType) && !"REST".equals(transitionType) && !work && !finish;
    transitionDesignTitle.setTextSize(
        TypedValue.COMPLEX_UNIT_PX,
        horizontal
            ? clampPx(shortSide * (rest ? 0.15f : 0.13f), sp(92), sp(150))
            : clampPx(
                shortSide * (moveStation ? 0.105f : (rest ? 0.12f : 0.105f)),
                shortSide * 0.075f,
                shortSide * (hydrate ? 0.13f : 0.14f)));
    int width = horizontal ? clamp(Math.round(screenWidth * 0.44f), dp(560), dp(860))
        : FrameLayout.LayoutParams.MATCH_PARENT;
    int height = FrameLayout.LayoutParams.WRAP_CONTENT;
    FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(width, height);
    if (horizontal) {
      params.leftMargin = Math.round(screenWidth * 0.51f);
      params.topMargin =
          Math.round(
              screenHeight
                  * (hydrate || finish ? 0.52f : (rest ? 0.56f : 0.48f)));
      transitionDesignTitle.setGravity(android.view.Gravity.CENTER);
    } else {
      params.leftMargin = 0;
      params.rightMargin = 0;
      params.topMargin =
          Math.round(screenHeight * (hydrate || finish ? 0.74f : (rest ? 0.69f : 0.72f)));
      transitionDesignTitle.setGravity(android.view.Gravity.CENTER);
    }
    transitionDesignTitle.setLayoutParams(params);
    transitionDesignTitle.setVisibility(View.VISIBLE);
    transitionDesignTitle.bringToFront();
  }

  protected void bindTransitionDesignSubtitle(
      String subtitle, String transitionType, boolean horizontal, int screenWidth, int screenHeight, int shortSide) {
    if (transitionDesignSubtitle == null) {
      return;
    }
    transitionDesignSubtitle.setVisibility(View.GONE);
    transitionDesignSubtitle.setText("");
  }

  protected void hideTransitionDesign() {
    if (transitionDesignPanel != null) {
      transitionDesignPanel.setVisibility(View.GONE);
    }
    if (transitionDesignCountdown != null) {
      transitionDesignCountdown.setText("");
    }
    if (transitionDesignRingContainer != null) {
      transitionDesignRingContainer.setVisibility(View.GONE);
    }
    if (transitionDesignIcon != null) {
      transitionDesignIcon.setVisibility(View.GONE);
      transitionDesignIcon.setImageDrawable(null);
    }
    if (transitionDesignTitle != null) {
      transitionDesignTitle.setVisibility(View.GONE);
      transitionDesignTitle.setText("");
    }
    if (transitionDesignSubtitle != null) {
      transitionDesignSubtitle.setVisibility(View.GONE);
      transitionDesignSubtitle.setText("");
    }
    if (transitionDesignLogo != null) {
      transitionDesignLogo.setVisibility(View.GONE);
    }
    hideSwitchTransitionDiagram();
    transitionDesignProgressKey = "";
    transitionDesignTotalSeconds = 0;
  }

  protected boolean isSupportedTransitionDesign(String transitionType) {
    return "HYDRATE".equals(transitionType)
        || "REST".equals(transitionType)
        || "WORK".equals(transitionType)
        || "FINISH".equals(transitionType)
        || "MOVE_STATION".equals(transitionType)
        || "SWITCH".equals(transitionType)
        || "MOVE_ZONE".equals(transitionType);
  }

  protected void showHorizontalFinishState() {
    hideTransitionDesign();
    contentPanel.setBackgroundColor(getColor(R.color.tv_black));
    contentPanel.setPadding(0, 0, 0, 0);
    scheduleScrollView.setVisibility(View.GONE);
    verticalSchedulePanel.setVisibility(View.GONE);
    verticalPlaybackPanel.setVisibility(View.VISIBLE);
    if (playbackStatusGroup != null) {
      playbackStatusGroup.setVisibility(View.GONE);
    }
    if (playbackHint != null) {
      playbackHint.setVisibility(View.GONE);
    }
    if (playbackScrollView != null) {
      playbackScrollView.setVisibility(View.GONE);
    }
    if (getReadyPanel != null) {
      getReadyPanel.setVisibility(View.GONE);
    }
    horizontalPlaceholderPanel.setVisibility(View.GONE);
    if (horizontalScheduleScroll != null) {
      horizontalScheduleScroll.setVisibility(View.GONE);
    }
    if (horizontalLoadingText != null) {
      horizontalLoadingText.setVisibility(View.GONE);
    }
    if (horizontalTransitionPanel != null) {
      horizontalTransitionPanel.setVisibility(View.GONE);
    }
    if (horizontalPlaybackPanel != null) {
      horizontalPlaybackPanel.setVisibility(View.GONE);
    }
    if (horizontalContentPanel != null) {
      horizontalContentPanel.setVisibility(View.GONE);
    }
    if (finishPanel != null) {
      finishPanel.setVisibility(View.VISIBLE);
    }
    bindFinishContent(activePlaybackItem == null ? "" : activePlaybackItem.logoSource);
    lastTrainingSignature = "";
  }

  protected void renderHorizontalDots(int completedDots, int totalDots) {
    if (horizontalStateDotsRow == null) {
      return;
    }
    horizontalStateDotsRow.removeAllViews();
    horizontalStateDotsRow.setVisibility(View.GONE);
  }

  protected void renderHorizontalProgressBar(CourseScript course, int elapsedSeconds, int totalSeconds) {
    int shortSide =
        Math.min(
            getResources().getDisplayMetrics().widthPixels,
            getResources().getDisplayMetrics().heightPixels);
    List<HorizontalProgressBarComponent.WorkSegment> workTimeline =
        buildHorizontalWorkTimeline(course);
    int workElapsedSeconds = resolveHorizontalWorkElapsedSeconds(course, elapsedSeconds);
    int totalWorkSeconds = getHorizontalWorkTotalSeconds(workTimeline);
    HorizontalProgressBarComponent.render(
        horizontalProgressRow,
        workTimeline,
        workElapsedSeconds,
        totalWorkSeconds,
        shortSide);
    renderHorizontalWorkTimeText(workElapsedSeconds, totalWorkSeconds);
  }

  protected void renderHorizontalWorkTimeText(int elapsedSeconds, int totalSeconds) {
    if (horizontalWorkTimeText == null) {
      return;
    }
    if (totalSeconds <= 0 || !shouldShowHorizontalWorkTimeText()) {
      horizontalWorkTimeText.setText("");
      horizontalWorkTimeText.setVisibility(View.GONE);
      return;
    }
    int safeElapsedSeconds = clamp(Math.max(elapsedSeconds, 0), 0, totalSeconds);
    horizontalWorkTimeText.setText(
        formatHorizontalWorkTime(safeElapsedSeconds) + "/" + formatHorizontalWorkTime(totalSeconds));
    horizontalWorkTimeText.setVisibility(View.VISIBLE);
    horizontalWorkTimeText.bringToFront();
  }

  protected boolean shouldShowHorizontalWorkTimeText() {
    return HORIZONTAL_WORK_TIME_VENUE_NAMESPACE.equals(activeAccountNamespace);
  }

  protected String formatHorizontalWorkTime(int seconds) {
    int safeSeconds = Math.max(seconds, 0);
    int minutes = safeSeconds / 60;
    int remainderSeconds = safeSeconds % 60;
    return String.format(Locale.US, "%02d:%02d", minutes, remainderSeconds);
  }

  protected void configureVerticalPlaybackHeader(boolean previewHeader) {
    if (playbackTimerCard == null || playbackStageCard == null) {
      return;
    }

    int shortSide =
        Math.min(
            getResources().getDisplayMetrics().widthPixels,
            getResources().getDisplayMetrics().heightPixels);
    int statusHeight =
        clamp(Math.round(shortSide * 0.213f), dp(100), dp(226));
    if (playbackStatusGroup != null) {
      ViewGroup.LayoutParams statusParams = playbackStatusGroup.getLayoutParams();
      if (statusParams != null) {
        statusParams.height = statusHeight;
        playbackStatusGroup.setLayoutParams(statusParams);
      }
    }

    LinearLayout.LayoutParams timerParams =
        (LinearLayout.LayoutParams) playbackTimerCard.getLayoutParams();
    LinearLayout.LayoutParams stageParams =
        (LinearLayout.LayoutParams) playbackStageCard.getLayoutParams();
    if (previewHeader) {
      playbackTimerCard.setVisibility(View.GONE);
      if (timerParams != null) {
        timerParams.width = 0;
        timerParams.weight = 0f;
        playbackTimerCard.setLayoutParams(timerParams);
      }
      if (stageParams != null) {
        stageParams.width = LinearLayout.LayoutParams.MATCH_PARENT;
        stageParams.weight = 0f;
        stageParams.leftMargin = 0;
        playbackStageCard.setLayoutParams(stageParams);
      }
      playbackStageCard.setPadding(dp(16), dp(8), dp(16), dp(8));
    } else {
      playbackTimerCard.setVisibility(View.VISIBLE);
      if (timerParams != null) {
        timerParams.width = 0;
        timerParams.weight = 0.28f;
        playbackTimerCard.setLayoutParams(timerParams);
      }
      if (stageParams != null) {
        stageParams.width = 0;
        stageParams.weight = 0.72f;
        stageParams.leftMargin = clamp(Math.round(
            Math.min(
                    getResources().getDisplayMetrics().widthPixels,
                    getResources().getDisplayMetrics().heightPixels)
                * 0.02f), dp(8), dp(16));
        playbackStageCard.setLayoutParams(stageParams);
      }
      playbackStageCard.setPadding(dp(18), dp(8), dp(18), dp(8));
    }
    if (playbackCountdownText != null) {
      playbackCountdownText.setTextSize(
          TypedValue.COMPLEX_UNIT_PX,
          previewHeader ? clampPx(statusHeight * 0.30f, sp(34), sp(58)) : clampPx(statusHeight * 0.82f, sp(84), sp(156)));
    }
    if (playbackStageProgress != null) {
      playbackStageProgress.setTextSize(
          TypedValue.COMPLEX_UNIT_PX,
          previewHeader ? clampPx(statusHeight * 0.30f, sp(34), sp(58)) : clampPx(statusHeight * 0.38f, sp(44), sp(72)));
    }
    if (playbackStageSecondary != null) {
      playbackStageSecondary.setTextSize(
          TypedValue.COMPLEX_UNIT_PX,
          previewHeader ? sp(20) : clampPx(statusHeight * 0.20f, sp(22), sp(34)));
    }
    if (playbackStageCard instanceof LinearLayout) {
      ((LinearLayout) playbackStageCard).setGravity(android.view.Gravity.CENTER);
    }
    if (playbackStageLabel != null) {
      playbackStageLabel.setGravity(android.view.Gravity.CENTER);
    }
    if (playbackStageProgress != null) {
      playbackStageProgress.setGravity(android.view.Gravity.CENTER);
    }
    if (playbackStageSecondary != null) {
      playbackStageSecondary.setGravity(android.view.Gravity.CENTER);
    }
    if (playbackStageDotsRow != null) {
      playbackStageDotsRow.setGravity(android.view.Gravity.CENTER);
    }
  }

  protected void configureHorizontalMainLayout(boolean finishMode) {
    if (horizontalCountdownText == null || horizontalStateText == null) {
      return;
    }

    View countdownColumn =
        horizontalRingContainer != null ? horizontalRingContainer : horizontalCountdownText;
    View stateColumn =
        horizontalStateColumn != null
            ? horizontalStateColumn
            : (horizontalStateText.getParent() instanceof View ? (View) horizontalStateText.getParent() : null);
    if (finishMode) {
      countdownColumn.setVisibility(View.GONE);
      if (horizontalLogoText != null) {
        horizontalLogoText.setVisibility(View.GONE);
      }
      if (horizontalWorkTimeText != null) {
        horizontalWorkTimeText.setVisibility(View.GONE);
      }
      if (stateColumn instanceof LinearLayout) {
        ((LinearLayout) stateColumn).setGravity(android.view.Gravity.CENTER);
        ((LinearLayout) stateColumn).setPadding(0, 0, 0, 0);
      }
      ViewGroup.LayoutParams rawStateParams = stateColumn == null ? null : stateColumn.getLayoutParams();
      if (rawStateParams instanceof FrameLayout.LayoutParams) {
        FrameLayout.LayoutParams stateParams = (FrameLayout.LayoutParams) rawStateParams;
        stateParams.width = FrameLayout.LayoutParams.MATCH_PARENT;
        stateParams.height = FrameLayout.LayoutParams.MATCH_PARENT;
        stateParams.gravity = android.view.Gravity.CENTER;
        stateParams.leftMargin = dp(48);
        stateParams.topMargin = 0;
        stateParams.rightMargin = dp(48);
        stateParams.bottomMargin = 0;
        stateColumn.setLayoutParams(stateParams);
      }
      horizontalStateText.setGravity(android.view.Gravity.CENTER);
      horizontalStateText.setSingleLine(false);
      horizontalStateText.setMaxLines(1);
    } else {
      countdownColumn.setVisibility(View.VISIBLE);
      horizontalCountdownText.setVisibility(View.VISIBLE);
      if (horizontalLogoText != null) {
        horizontalLogoText.setVisibility(View.GONE);
      }
      if (stateColumn instanceof LinearLayout) {
        LinearLayout column = (LinearLayout) stateColumn;
        column.setGravity(android.view.Gravity.CENTER);
        column.setPadding(0, 0, 0, 0);
        if (column.getChildCount() > 0 && column.getChildAt(0) instanceof LinearLayout) {
          ((LinearLayout) column.getChildAt(0)).setGravity(android.view.Gravity.CENTER);
        }
      }
      horizontalStateText.setGravity(android.view.Gravity.CENTER);
      horizontalStateText.setSingleLine(false);
      horizontalStateText.setMaxLines(3);
      if (horizontalStateDotsRow != null) {
        horizontalStateDotsRow.removeAllViews();
        horizontalStateDotsRow.setVisibility(View.GONE);
      }
    }
  }

  protected String resolveHorizontalTransitionHint(TrainingPlaybackState state) {
    return "";
  }

  protected String formatHorizontalStateTitle(String title) {
    if (title == null || title.trim().isEmpty()) {
      return "WAITING";
    }
    return title.toUpperCase(Locale.US);
  }

  protected int resolveHorizontalTransitionIcon(String transitionType) {
    if ("HYDRATE".equals(transitionType)) {
      return R.drawable.icon_water;
    }
    if ("MOVE_STATION".equals(transitionType) || "MOVE_ZONE".equals(transitionType) || "SWITCH".equals(transitionType)) {
      return R.drawable.icon_cicle;
    }
    if ("REST".equals(transitionType)) {
      return R.drawable.icon_heart;
    }
    return 0;
  }

  protected int getHorizontalTransitionBackgroundColor(String transitionType) {
    return getColor(R.color.tv_playback_background);
  }

  protected int parseSafeInt(String value) {
    if (value == null || value.trim().isEmpty()) {
      return 0;
    }
    try {
      return Integer.parseInt(value.trim());
    } catch (NumberFormatException ignored) {
      return 0;
    }
  }

}
