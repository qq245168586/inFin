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
import com.infini.tv.component.vertical.WaterfallRowView;
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

abstract class MainActivityWaterfallPlaybackController extends MainActivityHorizontalScheduleController {
  protected void updateWaterfallPlayback(
      CourseScript.WaterfallSection section,
      int elapsedSeconds,
      String stageLabel,
      String modeKey,
      String fallbackHint) {
    contentPanel.setBackgroundColor(getColor(R.color.tv_black));
    applyPlaybackTheme(PlaybackTheme.NORMAL);
    showPlaybackChrome(true, false);
    showPlaybackScroller();
    if (section == null || section.items == null || section.items.isEmpty()) {
      showPlaybackMessage("0", stageLabel, fallbackHint);
      return;
    }

    List<CourseScript.WaterfallItem> items = section.items;
    String waterfallSignature = buildWaterfallSignature(items);
    if (!modeKey.equals(lastPlaybackMode) || !waterfallSignature.equals(lastWaterfallSignature)) {
      lastPlaybackMode = modeKey;
      lastWaterfallSignature = waterfallSignature;
      lastWaterfallIndex = -1;
      lastWaterfallWindowStart = -1;
      lastTrainingSignature = "";
      trainingCardsContainer.removeAllViews();
      trainingCardsContainer.setVisibility(View.GONE);
      warmupRowsContainer.setVisibility(View.VISIBLE);
      buildWaterfallRows(items);
    }

    int currentIndex = 0;
    int currentItemStart = 0;
    int currentItemEnd = 0;
    for (int index = 0; index < items.size(); index += 1) {
      int nextEnd = currentItemStart + Math.max(items.get(index).seconds, 0);
      if (elapsedSeconds < nextEnd || index == items.size() - 1) {
        currentIndex = index;
        currentItemEnd = nextEnd;
        break;
      }
      currentItemStart = nextEnd;
    }

    int remainingSeconds = Math.max(currentItemEnd - elapsedSeconds, 0);
    int maxWindowStart = Math.max(items.size() - 3, 0);
    int windowStart = Math.min(Math.max(currentIndex - 1, 0), maxWindowStart);
    maybePlayWaterfallCue(modeKey, currentIndex);

    if (isHorizontalInfoScreen(activeScreenNumber)) {
      showHorizontalMainState(
          activePlaybackItem == null ? null : activePlaybackItem.course,
          remainingSeconds,
          stageLabel,
          "",
          0,
          0);
      return;
    }

    playbackCountdownText.setText(formatCountdownSeconds(remainingSeconds));
    playbackStageLabel.setText(stageLabel);
    playbackStageProgress.setText((currentIndex + 1) + " / " + items.size());
    playbackHint.setText("");
    playbackHint.setVisibility(View.GONE);
    renderStageMeta("", 0, 0);

    if (currentIndex != lastWaterfallIndex || windowStart != lastWaterfallWindowStart) {
      lastWaterfallIndex = currentIndex;
      lastWaterfallWindowStart = windowStart;
      updateWaterfallRows(currentIndex, windowStart);
      scrollWaterfallToWindowStart(windowStart);
    } else {
      updateWaterfallActiveState(currentIndex);
    }
  }

  protected String buildWaterfallHint(CourseScript.WaterfallItem item, String fallbackHint) {
    if (item == null) {
      return fallbackHint;
    }

    if (item.cue != null && !item.cue.trim().isEmpty()) {
      return item.cue;
    }
    if (item.actionName != null && !item.actionName.trim().isEmpty()) {
      return item.actionName;
    }
    return fallbackHint;
  }

  protected String buildWaterfallSignature(List<CourseScript.WaterfallItem> items) {
    if (items == null || items.isEmpty()) {
      return "empty";
    }

    StringBuilder builder = new StringBuilder();
    builder.append(items.size());
    for (CourseScript.WaterfallItem item : items) {
      builder
          .append("|")
          .append(item == null || item.mediaUrl == null ? "" : item.mediaUrl)
          .append(":")
          .append(item == null || item.actionName == null ? "" : item.actionName)
          .append(":")
          .append(item == null ? 0 : Math.max(item.seconds, 0));
    }
    return builder.toString();
  }

  protected String buildTrainingWaterfallSignature(List<CourseScript.VideoCard> cards) {
    if (cards == null || cards.isEmpty()) {
      return "empty";
    }

    StringBuilder builder = new StringBuilder();
    builder.append(cards.size());
    for (CourseScript.VideoCard card : cards) {
      builder
          .append("|")
          .append(card == null || card.mediaUrl == null ? "" : card.mediaUrl)
          .append(":")
          .append(card == null || card.actionName == null ? "" : card.actionName)
          .append(":")
          .append(card == null || card.stationNumber == null ? "" : card.stationNumber);
    }
    return builder.toString();
  }

  protected void buildWaterfallRows(List<CourseScript.WaterfallItem> items) {
    clearWaterfallRows();
    warmupRowsContainer.setVisibility(View.VISIBLE);
    if (items == null) {
      return;
    }

    for (int index = 0; index < items.size(); index += 1) {
      WaterfallRowView row = createWaterfallRow();
      row.itemIndex = index;
      row.item = items.get(index);
      bindWaterfallRowContent(row);
      waterfallRows.add(row);
      warmupRowsContainer.addView(row.container);
    }
    syncWaterfallRowLayout();
    playbackScrollView.post(() -> playbackScrollView.scrollTo(0, 0));
  }

  protected void buildTrainingWaterfallRows(List<CourseScript.VideoCard> cards) {
    clearWaterfallRows();
    warmupRowsContainer.setVisibility(View.VISIBLE);
    if (cards == null) {
      return;
    }

    for (int index = 0; index < cards.size(); index += 1) {
      CourseScript.VideoCard card = cards.get(index);
      WaterfallRowView row = createWaterfallRow();
      row.itemIndex = index;
      row.item =
          new CourseScript.WaterfallItem(
              card == null ? "" : card.actionId,
              card == null ? "" : card.actionName,
              card == null ? "" : card.mediaUrl,
              0,
              "");
      bindWaterfallRowContent(row);
      waterfallRows.add(row);
      warmupRowsContainer.addView(row.container);
    }
    syncWaterfallRowLayout();
    playbackScrollView.post(() -> playbackScrollView.scrollTo(0, 0));
  }

  protected WaterfallRowView createWaterfallRow() {
    FrameLayout container = new FrameLayout(this);
    LinearLayout.LayoutParams containerParams =
        new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
    container.setLayoutParams(containerParams);
    container.setBackgroundResource(R.drawable.bg_playback_surface_card);

    VideoView videoView = new VideoView(this);
    FrameLayout.LayoutParams videoParams =
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT);
    videoParams.gravity = android.view.Gravity.CENTER;
    videoView.setLayoutParams(videoParams);
    container.addView(videoView);

    TextView placeholder = new TextView(this);
    placeholder.setLayoutParams(
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    placeholder.setGravity(android.view.Gravity.CENTER);
    placeholder.setPadding(dp(16), dp(16), dp(16), dp(16));
    placeholder.setText("暂无视频");
    placeholder.setTextColor(getColor(R.color.tv_accent_gold_bright));
    placeholder.setTextSize(26f);
    placeholder.setTypeface(placeholder.getTypeface(), android.graphics.Typeface.BOLD);
    container.addView(placeholder);

    View dimOverlay = new View(this);
    dimOverlay.setLayoutParams(
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    dimOverlay.setBackgroundColor(getColor(R.color.tv_playback_dim));
    container.addView(dimOverlay);

    return new WaterfallRowView(container, videoView, placeholder, dimOverlay);
  }

  protected void bindWaterfallRowContent(WaterfallRowView row) {
    if (row == null) {
      return;
    }

    String placeholderText = "暂无视频";
    if (row.item != null && row.item.actionName != null && !row.item.actionName.trim().isEmpty()) {
      placeholderText = row.item.actionName;
    }
    row.placeholderText.setText(placeholderText);
    row.placeholderText.setVisibility(View.VISIBLE);
    row.videoView.setVisibility(View.GONE);
    row.dimOverlay.setAlpha(0.54f);
    row.dimOverlay.setVisibility(View.VISIBLE);
  }

  protected void updateWaterfallRows(int currentIndex, int windowStart) {
    int preloadEnd = Math.min(windowStart + 3, waterfallRows.size() - 1);
    for (int index = 0; index < waterfallRows.size(); index += 1) {
      WaterfallRowView row = waterfallRows.get(index);
      boolean shouldBindVideo = index >= windowStart && index <= preloadEnd;
      bindWaterfallVideo(row, shouldBindVideo ? row.item.mediaUrl : null);
      applyWaterfallRowActiveState(row, index == currentIndex);
    }
  }

  protected void updateWaterfallActiveState(int currentIndex) {
    for (int index = 0; index < waterfallRows.size(); index += 1) {
      applyWaterfallRowActiveState(waterfallRows.get(index), index == currentIndex);
    }
  }

  protected void ensureWaterfallRowsPlaying(int windowStart) {
    int preloadEnd = Math.min(windowStart + 3, waterfallRows.size() - 1);
    for (int index = Math.max(windowStart, 0); index <= preloadEnd; index += 1) {
      WaterfallRowView row = waterfallRows.get(index);
      if (row != null
          && row.videoView != null
          && row.videoView.getVisibility() == View.VISIBLE
          && !row.videoView.isPlaying()) {
        startLoopingVideoIfNeeded(row.videoView);
      }
    }
  }

  protected void bindWaterfallVideo(WaterfallRowView row, String mediaUrl) {
    if (row == null) {
      return;
    }

    if (mediaUrl == null || mediaUrl.trim().isEmpty()) {
      stopWaterfallVideo(row);
      return;
    }

    if (mediaUrl.equals(row.boundUrl)) {
      if (!row.videoView.isPlaying()) {
        row.videoView.start();
      }
      return;
    }

    row.boundUrl = mediaUrl;
    row.placeholderText.setVisibility(View.GONE);
    row.videoView.setVisibility(View.VISIBLE);
    try {
      row.videoView.stopPlayback();
    } catch (Exception ignored) {
      // Ignore stale player state while rebinding warmup rows.
    }
    row.videoView.setOnPreparedListener(
        mediaPlayer -> {
          mediaPlayer.setLooping(true);
          mediaPlayer.setVolume(0f, 0f);
          row.videoView.start();
        });
    row.videoView.setOnCompletionListener(mediaPlayer -> restartLoopingVideoFromStart(row.videoView));
    row.videoView.setOnErrorListener(
        (mediaPlayer, what, extra) -> {
          Log.w(TAG, "Waterfall video playback failed url=" + mediaUrl + " what=" + what + " extra=" + extra);
          stopWaterfallVideo(row);
          return true;
        });
    row.videoView.setVideoPath(mediaUrl);
    row.videoView.start();
  }

  protected void stopWaterfallVideo(WaterfallRowView row) {
    if (row == null) {
      return;
    }

    row.boundUrl = "";
    try {
      row.videoView.stopPlayback();
    } catch (Exception ignored) {
      // Ignore stale player state when leaving playback.
    }
    row.videoView.setVisibility(View.GONE);
    row.placeholderText.setVisibility(View.VISIBLE);
  }

  protected void applyWaterfallRowActiveState(WaterfallRowView row, boolean active) {
    if (row == null) {
      return;
    }
    row.container.setSelected(active);
    row.dimOverlay.setAlpha(active ? 0f : 0.56f);
  }

  protected void syncWaterfallRowLayout() {
    playbackScrollView.post(
        () -> {
          if (waterfallRows.isEmpty()) {
            return;
          }

          int contentWidth = warmupRowsContainer.getWidth();
          int viewportHeight = playbackScrollView.getHeight();
          if (contentWidth <= 0 || viewportHeight <= 0) {
            return;
          }

          int rowGap = dp(12);
          int heightByWidth = Math.round(contentWidth * 9f / 16f);
          int heightByViewport = Math.max((viewportHeight - rowGap * 2) / 3, dp(150));
          int rowHeight = Math.max(Math.min(heightByWidth, heightByViewport), dp(150));
          for (int index = 0; index < waterfallRows.size(); index += 1) {
            WaterfallRowView row = waterfallRows.get(index);
            LinearLayout.LayoutParams params = (LinearLayout.LayoutParams) row.container.getLayoutParams();
            if (params == null) {
              params =
                  new LinearLayout.LayoutParams(
                      LinearLayout.LayoutParams.MATCH_PARENT, rowHeight);
            }
            params.height = rowHeight;
            params.topMargin = index == 0 ? 0 : rowGap;
            row.container.setLayoutParams(params);
          }
        });
  }

  protected void scrollWaterfallToWindowStart(int windowStart) {
    playbackScrollView.post(
        () -> {
          if (windowStart < 0 || windowStart >= waterfallRows.size()) {
            return;
          }
          View targetRow = waterfallRows.get(windowStart).container;
          playbackScrollView.smoothScrollTo(0, Math.max(targetRow.getTop(), 0));
        });
  }

  protected void showPlaybackScroller() {
    hideTransitionDesign();
    hideFinishPanel();
    scheduleScrollView.setVisibility(View.GONE);
    verticalSchedulePanel.setVisibility(View.GONE);
    verticalPlaybackPanel.setVisibility(View.VISIBLE);
    horizontalPlaceholderPanel.setVisibility(View.GONE);
    if (horizontalPlaybackPanel != null) {
      horizontalPlaybackPanel.setVisibility(View.GONE);
    }
    if (horizontalScheduleScroll != null) {
      horizontalScheduleScroll.setVisibility(View.GONE);
    }
    if (horizontalLoadingText != null) {
      horizontalLoadingText.setVisibility(View.GONE);
    }
    if (horizontalContentPanel != null) {
      horizontalContentPanel.setVisibility(View.GONE);
    }
    if (horizontalTransitionPanel != null) {
      horizontalTransitionPanel.setVisibility(View.GONE);
    }
    if (getReadyPanel != null) {
      getReadyPanel.setVisibility(View.GONE);
    }
    playbackScrollView.setVisibility(View.VISIBLE);
  }
}
