package com.infini.tv;

import android.graphics.Color;
import android.text.TextUtils;
import android.util.Log;
import android.util.TypedValue;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.VideoView;
import com.infini.tv.model.CourseScript;
import com.infini.tv.util.LocalVideoPlaybackPolicy;
import com.infini.tv.util.TrainingLayoutCalculator;
import java.util.List;

abstract class MainActivityTrainingCardRendererController extends MainActivityTrainingTimelineController {
  protected void renderTrainingCards(TrainingPlaybackState state) {
    trainingCardsContainer.removeAllViews();
    if (state.displayCards == null || state.displayCards.isEmpty()) {
      TextView emptyText = new TextView(this);
      emptyText.setText("");
      emptyText.setTextColor(getColor(R.color.tv_text_subtle));
      emptyText.setTextSize(16f);
      emptyText.setGravity(android.view.Gravity.CENTER);
      emptyText.setPadding(0, dp(30), 0, dp(10));
      trainingCardsContainer.addView(emptyText);
      return;
    }

    int cardCount = state.displayCards.size();
    List<Integer> rowLayouts = normalizeTrainingRowLayouts(state.rowLayouts, state.displayCards);
    int rowCount = Math.max(rowLayouts.size(), 1);
    int visibleRowCount = Math.min(rowCount, 5);
    int rowGap = calculateTrainingRowGap(visibleRowCount);
    boolean waitingForViewportMeasure = playbackScrollView != null && playbackScrollView.getHeight() <= 0;
    int viewportHeight = resolveTrainingViewportHeight();
    List<Integer> rowHeights = calculateTrainingRowHeights(rowLayouts, rowGap, viewportHeight);
    int totalRowsHeight = 0;
    for (int height : rowHeights) {
      totalRowsHeight += height;
    }
    totalRowsHeight += Math.max(rowCount - 1, 0) * rowGap;
    int verticalSpace = Math.max(viewportHeight - dp(24), 0);
    trainingCardsContainer.setGravity(android.view.Gravity.CENTER_VERTICAL);
    trainingCardsContainer.setMinimumHeight(Math.max(totalRowsHeight, verticalSpace));

    int rowStart = 0;
    for (int rowIndex = 0; rowIndex < rowLayouts.size(); rowIndex += 1) {
      int columns = rowLayouts.get(rowIndex) == 2 ? 2 : 1;
      LinearLayout row = new LinearLayout(this);
      row.setOrientation(LinearLayout.HORIZONTAL);
      row.setGravity(android.view.Gravity.CENTER);
      LinearLayout.LayoutParams rowParams =
          new LinearLayout.LayoutParams(
              LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
      if (rowIndex > 0) {
        rowParams.topMargin = rowGap;
      }
      row.setLayoutParams(rowParams);

      for (int column = 0; column < columns; column += 1) {
        int cardIndex = rowStart + column;
        if (cardIndex >= cardCount) {
          continue;
        }

        int rowHeight = rowIndex < rowHeights.size() ? rowHeights.get(rowIndex) : calculateGridTrainingRowHeight();
        View card =
            columns == 1
                ? createTrainingWideCard(state.displayCards.get(cardIndex), cardIndex, rowHeight)
                : createTrainingGridCard(state.displayCards.get(cardIndex), cardIndex, rowHeight);
        row.addView(card);
      }
      trainingCardsContainer.addView(row);
      rowStart += columns;
    }
    playbackScrollView.post(
        () -> {
          playbackScrollView.scrollTo(0, 0);
          if (waitingForViewportMeasure && playbackScrollView.getHeight() > 0) {
            renderTrainingCards(state);
          }
        });
  }

  protected int resolveTrainingViewportHeight() {
    if (playbackScrollView == null) {
      return Math.round(getResources().getDisplayMetrics().heightPixels * 0.78f);
    }
    int measuredHeight = playbackScrollView.getHeight();
    if (measuredHeight > 0) {
      return measuredHeight;
    }
    int screenHeight = getResources().getDisplayMetrics().heightPixels;
    int[] location = new int[2];
    playbackScrollView.getLocationOnScreen(location);
    if (location[1] > 0 && location[1] < screenHeight) {
      return Math.max(screenHeight - location[1] - dp(8), dp(240));
    }
    int topChrome =
        dp(18)
            + (playbackStatusGroup == null ? dp(210) : Math.max(playbackStatusGroup.getHeight(), dp(210)))
            + (playbackHint != null && playbackHint.getVisibility() == View.VISIBLE
                ? Math.max(playbackHint.getHeight(), dp(42))
                : 0)
            + dp(26);
    return Math.max(screenHeight - topChrome, dp(240));
  }

  protected List<Integer> calculateTrainingRowHeights(List<Integer> rowLayouts, int rowGap, int viewportHeight) {
    return TrainingLayoutCalculator.calculateRowHeights(
        rowLayouts,
        rowGap,
        viewportHeight,
        calculateWideTrainingRowHeight(),
        calculateGridTrainingRowHeight(),
        dp(4),
        dp(64),
        dp(48),
        dp(42));
  }

  protected int getTrainingCardsContentWidth() {
    int measuredWidth = 0;
    if (trainingCardsContainer != null && trainingCardsContainer.getWidth() > 0) {
      measuredWidth =
          trainingCardsContainer.getWidth()
              - trainingCardsContainer.getPaddingLeft()
              - trainingCardsContainer.getPaddingRight();
    } else if (playbackScrollView != null && playbackScrollView.getWidth() > 0) {
      measuredWidth =
          playbackScrollView.getWidth()
              - playbackScrollView.getPaddingLeft()
              - playbackScrollView.getPaddingRight();
    }
    if (measuredWidth <= 0) {
      measuredWidth = Math.max(getResources().getDisplayMetrics().widthPixels - dp(36), dp(280));
    }
    return Math.max(measuredWidth, dp(280));
  }

  protected View createTrainingWideCard(
      CourseScript.VideoCard card, int cardIndex, int previewHeight) {
    FrameLayout wrapper = new FrameLayout(this);
    int contentWidth = getTrainingCardsContentWidth();
    int itemWidth = Math.min(contentWidth, Math.max(Math.round(previewHeight * 16f / 9f), 1));
    LinearLayout.LayoutParams params =
        new LinearLayout.LayoutParams(itemWidth, previewHeight);
    wrapper.setLayoutParams(params);
    wrapper.setBackgroundResource(R.drawable.bg_training_card);

    FrameLayout preview = new FrameLayout(this);
    FrameLayout.LayoutParams previewParams =
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT);
    preview.setLayoutParams(previewParams);
    preview.setBackgroundColor(getColor(R.color.tv_training_card_inactive));
    wrapper.addView(preview);

    bindTrainingPreview(preview, card);
    wrapper.addView(
        createTrainingStationBadge(
            safeStationLabel(card == null ? null : card.stationNumber, cardIndex + 1), true));
    addTrainingTargetDot(wrapper, card, true);

    return wrapper;
  }

  protected View createTrainingGridCard(
      CourseScript.VideoCard card, int cardIndex, int previewHeight) {
    FrameLayout wrapper = new FrameLayout(this);
    int contentWidth = getTrainingCardsContentWidth();
    int columnWidth = Math.max((contentWidth - dp(14)) / 2, dp(180));
    int itemWidth = Math.min(columnWidth, Math.max(Math.round(previewHeight * 16f / 9f), dp(160)));
    LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(itemWidth, previewHeight);
    if (cardIndex % 2 == 0) {
      params.rightMargin = dp(7);
    } else {
      params.leftMargin = dp(7);
    }
    wrapper.setLayoutParams(params);
    wrapper.setBackgroundResource(R.drawable.bg_training_card);

    FrameLayout preview = new FrameLayout(this);
    FrameLayout.LayoutParams previewParams =
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT);
    preview.setLayoutParams(previewParams);
    preview.setBackgroundColor(getColor(R.color.tv_training_card_inactive));
    wrapper.addView(preview);

    bindTrainingPreview(preview, card);
    wrapper.addView(
        createTrainingStationBadge(
            safeStationLabel(card == null ? null : card.stationNumber, cardIndex + 1), false));
    addTrainingTargetDot(wrapper, card, false);

    return wrapper;
  }

  protected void addTrainingTargetDot(FrameLayout wrapper, CourseScript.VideoCard card, boolean isWide) {
    if (wrapper == null || card == null || TextUtils.isEmpty(card.target)) {
      return;
    }
    wrapper.addView(createTrainingTargetDot(card.target, isWide));
  }

  protected TextView createTrainingStationBadge(String label, boolean isWide) {
    TextView badge = new TextView(this);
    FrameLayout.LayoutParams params =
        new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT);
    params.gravity = android.view.Gravity.TOP | android.view.Gravity.START;
    params.leftMargin = dp(isWide ? 28 : 24);
    params.topMargin = dp(isWide ? 14 : 12);
    badge.setLayoutParams(params);
    badge.setText(label);
    badge.setTextColor(getColor(R.color.tv_accent_gold_bright));
    badge.setTextSize(isWide ? 34f : 30f);
    badge.setTypeface(badge.getTypeface(), android.graphics.Typeface.BOLD);
    badge.setGravity(android.view.Gravity.CENTER);
    badge.setSingleLine(true);
    badge.setEllipsize(TextUtils.TruncateAt.END);
    int contentWidth = getTrainingCardsContentWidth();
    int maxBadgeWidth =
        isWide
            ? Math.max(contentWidth - dp(32), dp(180))
            : Math.max((contentWidth - dp(14)) / 2 - dp(28), dp(132));
    badge.setMaxWidth(maxBadgeWidth);
    badge.setPadding(dp(isWide ? 14 : 10), dp(5), dp(isWide ? 14 : 10), dp(6));
    android.graphics.drawable.GradientDrawable background =
        new android.graphics.drawable.GradientDrawable();
    background.setColor(Color.argb(218, 0, 0, 0));
    background.setCornerRadius(dp(8));
    background.setStroke(dp(1), getColor(R.color.tv_accent_gold_bright));
    badge.setBackground(background);
    return badge;
  }

  protected TextView createTrainingTargetDot(String target, boolean isWide) {
    TextView dot = new TextView(this);
    String label = target == null ? "" : target.trim();
    int length = label.length();
    int baseSize = isWide ? 76 : 66;
    int size = dp(length > 8 ? baseSize + 12 : length > 5 ? baseSize + 6 : baseSize);
    FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(size, size);
    params.gravity = android.view.Gravity.BOTTOM | android.view.Gravity.START;
    params.leftMargin = dp(isWide ? 24 : 20);
    params.bottomMargin = dp(isWide ? 16 : 12);
    dot.setLayoutParams(params);
    dot.setText(label);
    dot.setTextColor(getColor(R.color.tv_accent_gold_bright));
    int maxTextSize = length > 8 ? (isWide ? 17 : 15) : length > 5 ? (isWide ? 19 : 17) : (isWide ? 22 : 19);
    dot.setTextSize(maxTextSize);
    dot.setTypeface(dot.getTypeface(), android.graphics.Typeface.BOLD);
    dot.setGravity(android.view.Gravity.CENTER);
    dot.setMaxLines(2);
    dot.setEllipsize(TextUtils.TruncateAt.END);
    dot.setIncludeFontPadding(false);
    dot.setPadding(dp(7), dp(5), dp(7), dp(5));
    dot.setAutoSizeTextTypeUniformWithConfiguration(8, maxTextSize, 1, TypedValue.COMPLEX_UNIT_SP);

    android.graphics.drawable.GradientDrawable background =
        new android.graphics.drawable.GradientDrawable();
    background.setShape(android.graphics.drawable.GradientDrawable.OVAL);
    background.setColor(Color.argb(238, 0, 0, 0));
    background.setStroke(dp(2), getColor(R.color.tv_accent_gold_bright));
    dot.setBackground(background);
    dot.setElevation(dp(4));
    return dot;
  }

  protected void bindTrainingPreview(FrameLayout preview, CourseScript.VideoCard card) {
    String localMediaPath =
        LocalVideoPlaybackPolicy.resolvePlayablePath(card == null ? null : card.mediaUrl);
    boolean hasMedia = !localMediaPath.isEmpty();
    if (hasMedia) {
      VideoView videoView = new VideoView(this);
      videoView.setLayoutParams(
          new FrameLayout.LayoutParams(
              FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
      preview.addView(videoView);
      videoView.setOnPreparedListener(
          mediaPlayer -> {
            mediaPlayer.setLooping(true);
            mediaPlayer.setVolume(0f, 0f);
            centerTrainingVideoInPreview(
                videoView, preview, mediaPlayer.getVideoWidth(), mediaPlayer.getVideoHeight());
            videoView.start();
          });
      videoView.setOnCompletionListener(mediaPlayer -> restartLoopingVideoFromStart(videoView));
      videoView.setOnErrorListener(
          (mediaPlayer, what, extra) -> {
            Log.w(
                TAG,
                "Training video playback failed url="
                    + localMediaPath
                    + " what="
                    + what
                    + " extra="
                    + extra);
            videoView.setVisibility(View.GONE);
            return true;
          });
      videoView.setVideoPath(localMediaPath);
      videoView.start();
      preview.post(() -> startVideoViewIfNeeded(videoView));
    } else {
      View dim = new View(this);
      dim.setLayoutParams(
          new FrameLayout.LayoutParams(
              FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
      dim.setBackgroundColor(getColor(R.color.tv_playback_caption));
      preview.addView(dim);

      TextView placeholder = new TextView(this);
      placeholder.setLayoutParams(
          new FrameLayout.LayoutParams(
              FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
      placeholder.setGravity(android.view.Gravity.CENTER);
      placeholder.setPadding(dp(16), dp(16), dp(16), dp(16));
      placeholder.setText(safeStationLabel(card == null ? null : card.stationNumber, 1));
      placeholder.setTextColor(getColor(R.color.tv_accent_gold_bright));
      placeholder.setTextSize(46f);
      placeholder.setTypeface(placeholder.getTypeface(), android.graphics.Typeface.BOLD);
      preview.addView(placeholder);
    }
  }

  protected void centerTrainingVideoInPreview(
      VideoView videoView, FrameLayout preview, int videoWidth, int videoHeight) {
    if (videoView == null || preview == null || videoWidth <= 0 || videoHeight <= 0) {
      return;
    }
    preview.post(
        () -> {
          int boxWidth = preview.getWidth();
          int boxHeight = preview.getHeight();
          if (boxWidth <= 0 || boxHeight <= 0) {
            return;
          }

          float videoRatio = videoWidth / (float) videoHeight;
          float boxRatio = boxWidth / (float) boxHeight;
          int targetWidth;
          int targetHeight;
          if (videoRatio > boxRatio) {
            targetWidth = boxWidth;
            targetHeight = Math.max(Math.round(boxWidth / videoRatio), 1);
          } else {
            targetHeight = boxHeight;
            targetWidth = Math.max(Math.round(boxHeight * videoRatio), 1);
          }

          FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(targetWidth, targetHeight);
          params.gravity = android.view.Gravity.CENTER;
          videoView.setLayoutParams(params);
        });
  }

  protected void ensureTrainingCardVideosPlaying() {
    startChildVideoViews(trainingCardsContainer);
  }

  protected void startChildVideoViews(View view) {
    if (view == null || view.getVisibility() != View.VISIBLE) {
      return;
    }
    if (view instanceof VideoView) {
      startVideoViewIfNeeded((VideoView) view);
      return;
    }
    if (!(view instanceof ViewGroup)) {
      return;
    }
    ViewGroup group = (ViewGroup) view;
    for (int index = 0; index < group.getChildCount(); index += 1) {
      startChildVideoViews(group.getChildAt(index));
    }
  }

  protected void startVideoViewIfNeeded(VideoView videoView) {
    startLoopingVideoIfNeeded(videoView);
  }
}
