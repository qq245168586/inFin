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

class TrainingPlaybackState {
  final String renderKey;
  final String stageLabel;
  final String stageProgress;
  final String hintText;
  final int remainingSeconds;
  final List<CourseScript.VideoCard> displayCards;
  final List<Integer> rowLayouts;
  final int activeCardIndex;
  final boolean playActiveCard;
  final boolean waterfallLayout;
  final boolean messageOnly;
  final boolean fullScreenTransition;
  final String transitionType;
  final String stageSecondaryText;
  final int completedDots;
  final int totalDots;

  TrainingPlaybackState(
      String renderKey,
      String stageLabel,
      String stageProgress,
      String hintText,
      int remainingSeconds,
      List<CourseScript.VideoCard> displayCards,
      int activeCardIndex,
      boolean playActiveCard) {
    this(
        renderKey,
        stageLabel,
        stageProgress,
        hintText,
        remainingSeconds,
        displayCards,
        activeCardIndex,
        playActiveCard,
        false,
        false,
        false,
        "",
        "",
        0,
        0);
  }

  TrainingPlaybackState(
      String renderKey,
      String stageLabel,
      String stageProgress,
      String hintText,
      int remainingSeconds,
      List<CourseScript.VideoCard> displayCards,
      int activeCardIndex,
      boolean playActiveCard,
      boolean waterfallLayout,
      boolean messageOnly,
      boolean fullScreenTransition,
      String transitionType,
      List<Integer> rowLayouts) {
    this(
        renderKey,
        stageLabel,
        stageProgress,
        hintText,
        remainingSeconds,
        displayCards,
        activeCardIndex,
        playActiveCard,
        waterfallLayout,
        messageOnly,
        fullScreenTransition,
        transitionType,
        "",
        0,
        0,
        rowLayouts);
  }

  TrainingPlaybackState(
      String renderKey,
      String stageLabel,
      String stageProgress,
      String hintText,
      int remainingSeconds,
      List<CourseScript.VideoCard> displayCards,
      int activeCardIndex,
      boolean playActiveCard,
      boolean waterfallLayout,
      boolean messageOnly,
      boolean fullScreenTransition,
      String transitionType) {
    this(
        renderKey,
        stageLabel,
        stageProgress,
        hintText,
        remainingSeconds,
        displayCards,
        activeCardIndex,
        playActiveCard,
        waterfallLayout,
        messageOnly,
        fullScreenTransition,
        transitionType,
        "",
        0,
        0);
  }

  TrainingPlaybackState(
      String renderKey,
      String stageLabel,
      String stageProgress,
      String hintText,
      int remainingSeconds,
      List<CourseScript.VideoCard> displayCards,
      int activeCardIndex,
      boolean playActiveCard,
      boolean waterfallLayout,
      boolean messageOnly,
      boolean fullScreenTransition,
      String transitionType,
      String stageSecondaryText,
      int completedDots,
      int totalDots) {
    this(
        renderKey,
        stageLabel,
        stageProgress,
        hintText,
        remainingSeconds,
        displayCards,
        activeCardIndex,
        playActiveCard,
        waterfallLayout,
        messageOnly,
        fullScreenTransition,
        transitionType,
        stageSecondaryText,
        completedDots,
        totalDots,
        new ArrayList<>());
  }

  TrainingPlaybackState(
      String renderKey,
      String stageLabel,
      String stageProgress,
      String hintText,
      int remainingSeconds,
      List<CourseScript.VideoCard> displayCards,
      int activeCardIndex,
      boolean playActiveCard,
      boolean waterfallLayout,
      boolean messageOnly,
      boolean fullScreenTransition,
      String transitionType,
      String stageSecondaryText,
      int completedDots,
      int totalDots,
      List<Integer> rowLayouts) {
    this.renderKey = renderKey;
    this.stageLabel = stageLabel;
    this.stageProgress = stageProgress;
    this.hintText = hintText;
    this.remainingSeconds = remainingSeconds;
    this.displayCards = displayCards;
    this.rowLayouts = rowLayouts == null ? new ArrayList<>() : rowLayouts;
    this.activeCardIndex = activeCardIndex;
    this.playActiveCard = playActiveCard;
    this.waterfallLayout = waterfallLayout;
    this.messageOnly = messageOnly;
    this.fullScreenTransition = fullScreenTransition;
    this.transitionType = transitionType == null ? "" : transitionType;
    this.stageSecondaryText = stageSecondaryText == null ? "" : stageSecondaryText;
    this.completedDots = completedDots;
    this.totalDots = totalDots;
  }
}
