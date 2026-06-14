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

abstract class MainActivityInstallerAndAudioController extends MainActivityPairingAndUpdateController {
  protected boolean suppressTrainingCuePlayback = false;

  protected SilentInstallResult trySilentRootInstall(File apkFile) {
    String sourcePath = apkFile.getAbsolutePath();
    String stagedPath = "/data/local/tmp/infini-tv-update.apk";
    List<String[]> fallbackCommands = new ArrayList<>();
    fallbackCommands.add(new String[] {"pm", "install", "-r", stagedPath});
    String[][] rootSpecs = {
      {"/system/xbin/su", "0"},
      {"/system/bin/su", "0"},
      {"su", "0"},
      {"/system/xbin/su", "root"},
      {"/system/bin/su", "root"},
      {"su", "root"}
    };

    SilentInstallResult lastResult =
        new SilentInstallResult(false, "root install not attempted", -1, "");

    for (String[] rootSpec : rootSpecs) {
      SilentInstallResult copyResult =
          runSilentInstallCommand(
              new String[] {rootSpec[0], rootSpec[1], "cp", sourcePath, stagedPath});
      lastResult = copyResult;
      if (copyResult.exitCode != 0) {
        continue;
      }

      SilentInstallResult chmodResult =
          runSilentInstallCommand(
              new String[] {rootSpec[0], rootSpec[1], "chmod", "644", stagedPath});
      lastResult = chmodResult;
      if (chmodResult.exitCode != 0) {
        continue;
      }

      SilentInstallResult installResult =
          runSilentInstallCommand(
              new String[] {rootSpec[0], rootSpec[1], "pm", "install", "-r", stagedPath});
      lastResult = installResult;
      if (installResult.success) {
        return installResult;
      }
    }

    String directInstallCommand = "pm install -r " + shellQuote(sourcePath);
    fallbackCommands.add(new String[] {"/system/xbin/su", "-c", directInstallCommand});
    fallbackCommands.add(new String[] {"/system/bin/su", "-c", directInstallCommand});
    fallbackCommands.add(new String[] {"su", "-c", directInstallCommand});

    for (String[] command : fallbackCommands) {
      SilentInstallResult result = runSilentInstallCommand(command);
      lastResult = result;
      if (result.success) {
        return result;
      }
    }

    return lastResult;
  }

  protected SilentInstallResult runSilentInstallCommand(String[] command) {
    String commandLabel = joinCommandForLog(command);
    Process process = null;
    try {
      Log.d(TAG, "Trying silent install command: " + commandLabel);
      process = new ProcessBuilder(command).redirectErrorStream(true).start();
      boolean completed = process.waitFor(90, TimeUnit.SECONDS);
      String output = readProcessOutput(process);
      if (!completed) {
        process.destroy();
        return new SilentInstallResult(false, commandLabel, -2, "命令超时。" + output);
      }

      int exitCode = process.exitValue();
      boolean success = exitCode == 0 && output.toLowerCase(Locale.US).contains("success");
      return new SilentInstallResult(success, commandLabel, exitCode, output);
    } catch (Exception error) {
      return new SilentInstallResult(
          false,
          commandLabel,
          -1,
          error.getClass().getSimpleName() + ": " + (error.getMessage() == null ? "" : error.getMessage()));
    } finally {
      if (process != null) {
        process.destroy();
      }
    }
  }

  protected String readProcessOutput(Process process) {
    if (process == null) {
      return "";
    }
    StringBuilder output = new StringBuilder();
    try (BufferedReader reader =
        new BufferedReader(new InputStreamReader(process.getInputStream()))) {
      String line;
      while ((line = reader.readLine()) != null) {
        if (output.length() > 0) {
          output.append('\n');
        }
        output.append(line);
      }
    } catch (Exception error) {
      if (output.length() > 0) {
        output.append('\n');
      }
      output.append("读取安装输出失败: ").append(error.getMessage());
    }
    return output.toString();
  }

  protected String shellQuote(String value) {
    if (value == null) {
      return "''";
    }
    return "'" + value.replace("'", "'\\''") + "'";
  }

  protected String joinCommandForLog(String[] command) {
    if (command == null || command.length == 0) {
      return "";
    }
    StringBuilder label = new StringBuilder();
    for (String part : command) {
      if (label.length() > 0) {
        label.append(' ');
      }
      label.append(part);
    }
    return label.toString();
  }

  protected void relaunchSelfAfterSilentInstall() {
    playbackHandler.postDelayed(
        () -> {
          Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
          if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            startActivity(launchIntent);
          }
          finish();
          Runtime.getRuntime().exit(0);
        },
        1500L);
  }

  protected void launchApkInstaller(File apkFile, String version) {
    try {
      Log.d(
          TAG,
          "Preparing installer launch. version="
              + version
              + ", file="
              + (apkFile == null ? "<null>" : apkFile.getAbsolutePath()));
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
          && !getPackageManager().canRequestPackageInstalls()) {
        setUpdateUiState(
            "ERROR",
            version,
            currentUpdateProgressPercent,
            "请先允许此应用安装未知来源应用，然后点击下方按钮继续安装。",
            true);
        openUnknownAppSourcesSettings();
        return;
      }

      Uri apkUri =
          FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", apkFile);
      Intent intent = buildPackageInstallerIntent(apkUri);
      Log.d(TAG, "Starting installer intent: " + intent);

      setUpdateUiState("INSTALLING", version, 100, "已打开安装器，请完成更新安装。", true);
      startActivity(intent);
    } catch (Exception error) {
      Log.e(TAG, "Failed to launch installer", error);
      setUpdateUiState(
          "ERROR",
          version,
          currentUpdateProgressPercent,
          "无法打开系统安装器，请检查盒子安装权限。",
          true);
    }
  }

  protected void tryManualInstallFromUpdateUi(String source) {
    Log.d(
        TAG,
        "Manual install requested from "
            + source
            + ", state="
            + currentUpdateState
            + ", version="
            + currentUpdateTargetVersion
            + ", file="
            + (lastDownloadedUpdateApkFile == null
                ? "<null>"
                : lastDownloadedUpdateApkFile.getAbsolutePath()));
    if (lastDownloadedUpdateApkFile == null || !lastDownloadedUpdateApkFile.exists()) {
      setUpdateUiState(
          "ERROR",
          currentUpdateTargetVersion,
          currentUpdateProgressPercent,
          "当前没有可安装的更新包，请先重新下载更新。",
          true);
      return;
    }
    installDownloadedApk(lastDownloadedUpdateApkFile, lastDownloadedUpdateVersion);
  }

  protected void initCueSounds() {
    AudioAttributes audioAttributes =
        new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
    cueSoundPool =
        new SoundPool.Builder().setMaxStreams(1).setAudioAttributes(audioAttributes).build();
    cueSoundPool.setOnLoadCompleteListener(
        (soundPool, sampleId, status) -> {
          if (status == 0) {
            loadedCueSoundIds.add(sampleId);
          } else {
            Log.w(TAG, "Failed to load cue sound sampleId=" + sampleId + ", status=" + status);
          }
        });
    warmCueSoundId = cueSoundPool.load(this, R.raw.warm, 1);
    coolCueSoundId = cueSoundPool.load(this, R.raw.cool, 1);
    dingCueSoundId = cueSoundPool.load(this, R.raw.ding, 1);
  }

  protected void releaseCueSounds() {
    loadedCueSoundIds.clear();
    warmCueSoundId = 0;
    coolCueSoundId = 0;
    dingCueSoundId = 0;
    activeCueStreamId = 0;
    lastCuePlaybackKey = "";
    if (cueSoundPool != null) {
      cueSoundPool.release();
      cueSoundPool = null;
    }
  }

  protected void playCueSound(CueSound cueSound) {
    playCueSound(cueSound, "");
  }

  protected void playCueSound(CueSound cueSound, String cueKey) {
    if (cueSoundPool == null || cueSound == null) {
      return;
    }
    String safeCueKey =
        cueKey == null || cueKey.trim().isEmpty()
            ? ""
            : activePlaybackSessionId + "|" + cueKey;
    if (!TextUtils.isEmpty(safeCueKey) && safeCueKey.equals(lastCuePlaybackKey)) {
      return;
    }
    int sampleId = 0;
    switch (cueSound) {
      case WARM:
        sampleId = warmCueSoundId;
        break;
      case COOL:
        sampleId = coolCueSoundId;
        break;
      case DING:
        sampleId = dingCueSoundId;
        break;
      default:
        break;
    }
    if (sampleId <= 0 || !loadedCueSoundIds.contains(sampleId)) {
      return;
    }
    if (activeCueStreamId != 0) {
      cueSoundPool.stop(activeCueStreamId);
      activeCueStreamId = 0;
    }
    activeCueStreamId = cueSoundPool.play(sampleId, 1f, 1f, 1, 0, 1f);
    if (!TextUtils.isEmpty(safeCueKey)) {
      lastCuePlaybackKey = safeCueKey;
    }
  }

  protected void resetAudioCueTracking() {
    if (cueSoundPool != null && activeCueStreamId != 0) {
      cueSoundPool.stop(activeCueStreamId);
    }
    activeCueStreamId = 0;
    lastWaterfallAudioMode = "";
    lastWaterfallAudioIndex = -1;
    lastTrainingAudioRenderKey = "";
    lastTrainingAudioPhase = "";
  }

  protected void scheduleFinishReturn() {
    playbackHandler.removeCallbacks(finishReturnTicker);
    playbackHandler.postDelayed(finishReturnTicker, FINISH_RETURN_DELAY_MS);
  }

  protected void cancelFinishReturn() {
    playbackHandler.removeCallbacks(finishReturnTicker);
  }

  protected void maybePlayWaterfallCue(String modeKey, int currentIndex) {
    if (!"WARMUP".equals(modeKey) && !"COOLDOWN".equals(modeKey)) {
      lastWaterfallAudioMode = modeKey == null ? "" : modeKey;
      lastWaterfallAudioIndex = currentIndex;
      return;
    }
    if ("WARMUP".equals(modeKey) && "WARMUP_READY".equals(lastWaterfallAudioMode)) {
      playCueSound(CueSound.WARM, "waterfall|warmup-ready|start|" + currentIndex);
      lastWaterfallAudioMode = modeKey;
      lastWaterfallAudioIndex = currentIndex;
      return;
    }
    if (!safeEquals(lastWaterfallAudioMode, modeKey)) {
      lastWaterfallAudioMode = modeKey;
      lastWaterfallAudioIndex = currentIndex;
      return;
    }
    if (currentIndex != lastWaterfallAudioIndex && lastWaterfallAudioIndex >= 0) {
      playCueSound(
          "COOLDOWN".equals(modeKey) ? CueSound.COOL : CueSound.WARM,
          "waterfall|" + modeKey + "|index|" + currentIndex);
    }
    lastWaterfallAudioMode = modeKey;
    lastWaterfallAudioIndex = currentIndex;
  }

  protected void maybePlayTrainingCue(TrainingPlaybackState state) {
    if (suppressTrainingCuePlayback) {
      return;
    }
    if (state == null) {
      lastTrainingAudioRenderKey = "";
      lastTrainingAudioPhase = "";
      return;
    }
    String currentRenderKey = state.renderKey == null ? "" : state.renderKey;
    String currentPhase = resolveTrainingCuePhase(state);
    if (!TextUtils.isEmpty(lastTrainingAudioRenderKey)
        && shouldPlayTrainingCue(lastTrainingAudioPhase, currentPhase)) {
      playCueSound(
          CueSound.DING,
          "training|" + lastTrainingAudioPhase + ">" + currentPhase + "|" + currentRenderKey);
    }
    lastTrainingAudioRenderKey = currentRenderKey;
    lastTrainingAudioPhase = currentPhase;
  }

  protected boolean shouldPlayTrainingCue(String lastPhase, String currentPhase) {
    if (TextUtils.isEmpty(currentPhase) || safeEquals(lastPhase, currentPhase)) {
      return false;
    }
    if ("MOVE_STATION".equals(currentPhase)) {
      return "WORK".equals(lastPhase) || "REST".equals(lastPhase);
    }
    if ("WORK".equals(currentPhase)) {
      return "READY".equals(lastPhase) || "REST".equals(lastPhase) || "MOVE_STATION".equals(lastPhase);
    }
    return "REST".equals(currentPhase) && "WORK".equals(lastPhase);
  }

  protected void rememberTrainingCuePhase(String renderKey, String phase) {
    lastTrainingAudioRenderKey = renderKey == null ? "" : renderKey;
    lastTrainingAudioPhase = phase == null ? "" : phase;
  }

  protected String resolveTrainingCuePhase(TrainingPlaybackState state) {
    if (state == null || state.stageProgress == null) {
      return "";
    }
    if ("MOVE_STATION".equals(state.transitionType) || "MOVE_ZONE".equals(state.transitionType) || "SWITCH".equals(state.transitionType)) {
      return "MOVE_STATION";
    }
    String progress = state.stageProgress.trim().toUpperCase(Locale.US);
    if ("WORK".equals(progress)) {
      return "WORK";
    }
    if ("REST".equals(progress)) {
      return "REST";
    }
    if ("MOVE STATION".equals(progress) || "MOVE ZONE".equals(progress)) {
      return "MOVE_STATION";
    }
    return "";
  }

  protected void openUnknownAppSourcesSettings() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return;
    }
    Intent settingsIntent =
        new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
            .setData(Uri.parse("package:" + getPackageName()))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    startActivity(settingsIntent);
  }
}
