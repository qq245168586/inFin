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

abstract class MainActivityContract02 extends MainActivityContract01 {
  protected abstract long currentSessionPlaybackElapsedMs();

  protected abstract void dispatchScreenHeartbeat(boolean bind);

  protected abstract void registerNetworkMonitoring();

  protected abstract void unregisterNetworkMonitoring();

  protected abstract void scheduleScreenHeartbeat();

  protected abstract void syncBindingFromServer(TvScriptRepository.ScreenRegistration registration);

  protected abstract void requestCurrentPlaybackSession(String reason);

  protected abstract void applyCurrentPlaybackSession(
      TvScriptRepository.CurrentPlaybackSession result, String reason);

  protected abstract void applyPlaybackSessionToSchedule(
      TvScheduleItem item, TvScriptRepository.PlaybackSessionSnapshot session, long serverNowMs);

  protected abstract void updateSessionClock(long serverNowMs);

  protected abstract void applyPlaybackSessionFields(TvScriptRepository.PlaybackSessionSnapshot session);

  protected abstract void clearPlaybackSessionTiming();

  protected abstract void stopScreenHeartbeat();

  protected abstract void startPairingPresence();

  protected abstract void stopPairingPresence();

  protected abstract String resolveAppVersion();

  protected abstract boolean isVerticalCourseScreen(int screenNumber);

  protected abstract boolean isHorizontalInfoScreen(int screenNumber);

  protected abstract void applyScreenOrientation(int screenNumber);

  protected abstract int getDisplayScreenIndex();

  protected abstract void renderVerticalSchedule(int screenNumber);

  protected abstract void renderHorizontalScreen(int screenNumber);

  protected abstract void showVerticalScheduleList();

  protected abstract void bindScheduleItems(List<TvScheduleItem> scheduleItems);

  protected abstract void startCourse(TvScheduleItem item);

  protected abstract void startCourse(TvScheduleItem item, String playbackSessionId, String bundleChecksum);

  protected abstract void beginPreviewedCourse();

  protected abstract void previewCourseFromRemote(
      String scheduleId,
      int courseId,
      long scheduledStartAtMs,
      String playbackSessionId,
      String bundleChecksum);

  protected abstract void startCourseFromRemote(
      String scheduleId,
      int courseId,
      long scheduledStartAtMs,
      long playbackStartAtMs,
      String playbackSessionId,
      String bundleChecksum);

  protected abstract boolean canStartActivePreviewFromRemote(
      String scheduleId, int courseId, String playbackSessionId, String bundleChecksum);

  protected abstract void beginRemoteCoursePlayback(
      TvScheduleItem item, long playbackStartAtMs, String playbackSessionId, String bundleChecksum);

  protected abstract void bringPlaybackUiToFront();

  protected abstract void pauseCourseFromRemote(
      String scheduleId, int courseId, long pausedAtMs, String playbackSessionId);

  protected abstract void resumeCourseFromRemote(
      String scheduleId, int courseId, long resumedAtMs, String playbackSessionId);

  protected abstract void terminateCourseFromRemote(
      String scheduleId, int courseId, String playbackSessionId);

  protected abstract TvScheduleItem findSyncedSchedule(String scheduleId, int courseId, long scheduledStartAtMs);

  protected abstract void resolveRemoteSchedule(
      String scheduleId,
      int courseId,
      long scheduledStartAtMs,
      String requiredBundleChecksum,
      RemoteScheduleAction action);

  protected abstract void upsertSyncedSchedule(TvScheduleItem item);

  protected abstract boolean matchesActiveSchedule(String scheduleId, int courseId);

  protected abstract boolean matchesActiveSession(String playbackSessionId);

  protected abstract long toEpochMs(java.time.LocalDateTime localDateTime);

  protected abstract void renderPreviewState();

  protected abstract TrainingPlaybackState buildPreviewTrainingState(CourseScript course);

  protected abstract long resolvePlaybackStartTime(TvScheduleItem item);

  protected abstract void resetPlaybackStateCaches();

  protected abstract void syncTodaySchedule(int screenNumber, boolean immediate);

  protected abstract void requestTodayChecksumCheck(int screenNumber);

  protected abstract void clearTvCacheFromRemote(String targetDeviceId);

  protected abstract void scheduleChecksumPolling();

  protected abstract void stopChecksumPolling();

  protected abstract boolean shouldApplyScreenUpdate(int screenNumber);

  protected abstract boolean shouldApplyVerticalScreenUpdate(int screenNumber);

  protected abstract boolean shouldApplyHorizontalScreenUpdate(int screenNumber);

  protected abstract void requestNetworkRecoverySync();

  protected abstract String buildSyncMessage(String message, int completed, int total);
}
