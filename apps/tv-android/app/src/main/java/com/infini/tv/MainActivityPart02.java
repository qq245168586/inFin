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

abstract class MainActivityPart02 extends MainActivityPart01 {
  protected void showSelector() {
    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
    stopChecksumPolling();
    stopPlayback();
    activeScreenNumber = 0;
    activeAccountNamespace = "";
    clearSavedAccountNamespace();
    saveScreenNumber(0);
    ensurePairToken();
    if (mqttManager != null) {
      mqttManager.updateControlRouting("", false);
    }
    applyResponsiveLayout();
    updateDeviceMetaViews();
    updateSelectorPairingUi();
    selectorPanel.setVisibility(View.VISIBLE);
    contentPanel.setVisibility(View.GONE);
    startPairingPresence();
    dispatchScreenHeartbeat(false);
    scheduleScreenHeartbeat();
  }

  protected SharedPreferences getAppPreferences() {
    return getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
  }

  protected String readSavedAccountNamespace() {
    return trimAccountNamespace(getAppPreferences().getString(PREF_ACCOUNT_NAMESPACE, ""));
  }

  protected void saveAccountNamespace(String accountNamespace) {
    getAppPreferences()
        .edit()
        .putString(PREF_ACCOUNT_NAMESPACE, trimAccountNamespace(accountNamespace))
        .apply();
  }

  protected void clearSavedAccountNamespace() {
    getAppPreferences().edit().remove(PREF_ACCOUNT_NAMESPACE).apply();
  }

  protected String ensureDeviceId() {
    SharedPreferences preferences = getAppPreferences();
    String existing = preferences.getString(PREF_DEVICE_ID, "");
    if (existing != null && !existing.trim().isEmpty()) {
      return existing.trim().toUpperCase(Locale.US);
    }

    String generated = "TV-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase(Locale.US);
    preferences.edit().putString(PREF_DEVICE_ID, generated).apply();
    return generated;
  }

  protected String buildMqttClientId(String currentDeviceId) {
    String compact = (currentDeviceId == null ? "" : currentDeviceId).replaceAll("[^A-Za-z0-9]", "").toLowerCase(Locale.US);
    return compact.isEmpty() ? "tv-unknown" : "tv-" + compact;
  }

  protected String trimAccountNamespace(String accountNamespace) {
    return accountNamespace == null ? "" : accountNamespace.trim().toLowerCase(Locale.US);
  }

  protected int readSavedScreenNumber() {
    return getAppPreferences().getInt(PREF_SCREEN_NUMBER, 0);
  }

  protected void saveScreenNumber(int screenNumber) {
    getAppPreferences().edit().putInt(PREF_SCREEN_NUMBER, screenNumber).apply();
  }

  protected void clearCurrentScreenBinding() {
    String previousNamespace = activeAccountNamespace;
    int previousScreenNumber = activeScreenNumber;
    String previousPairToken = currentPairToken;
    clearSavedAccountNamespace();
    saveScreenNumber(0);
    activeAccountNamespace = "";
    currentPairToken = readOrCreatePairToken();
    if (mqttManager != null) {
      mqttManager.publishUnboundEvent(deviceId, previousNamespace, previousScreenNumber, previousPairToken);
    }
    showSelector();
  }

  protected void updateDeviceMetaViews() {
    String mqttClientId = mqttManager != null ? mqttManager.getClientId() : buildMqttClientId(deviceId);
    String appVersion = resolveAppVersion();
    if (selectorDeviceIdText != null) {
      selectorDeviceIdText.setText("设备 ID  " + deviceId + "  ·  MQTT " + mqttClientId);
    }
    if (selectorPairCodeText != null) {
      selectorPairCodeText.setText(currentPairToken.isEmpty() ? "--" : currentPairToken);
    }
    if (screenDeviceMetaText != null) {
      screenDeviceMetaText.setText(deviceId + "  ·  v" + (appVersion == null || appVersion.trim().isEmpty() ? "unknown" : appVersion));
    }
  }

  protected void ensurePairToken() {
    if (!TextUtils.isEmpty(currentPairToken)) {
      return;
    }
    currentPairToken = readOrCreatePairToken();
  }

  protected String readOrCreatePairToken() {
    SharedPreferences preferences = getAppPreferences();
    String existing = preferences.getString(PREF_PAIR_TOKEN, "");
    if (existing != null && !existing.trim().isEmpty()) {
      return existing.trim().toUpperCase(Locale.US);
    }

    String generated =
        UUID.randomUUID()
            .toString()
            .replace("-", "")
            .substring(0, 8)
            .toUpperCase(Locale.US);
    preferences.edit().putString(PREF_PAIR_TOKEN, generated).apply();
    return generated;
  }

  protected String buildPairingPayload() {
    ensurePairToken();
    return "infini-tv://pair?deviceId=" + Uri.encode(deviceId) + "&pairToken=" + Uri.encode(currentPairToken);
  }

  protected void updateSelectorPairingUi() {
    ensurePairToken();
    if (selectorPairHintText != null) {
      selectorPairHintText.setText("请在 Coach 端扫码，选择场馆与屏幕编号后完成绑定");
    }
    if (selectorQrImage != null) {
      selectorQrImage.setImageBitmap(createPairingQrBitmap(buildPairingPayload(), dpToPx(260)));
    }
  }

  protected Bitmap createPairingQrBitmap(String content, int sizePx) {
    try {
      Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
      hints.put(EncodeHintType.MARGIN, 1);
      BitMatrix matrix = new QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, sizePx, sizePx, hints);
      Bitmap bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888);
      for (int x = 0; x < sizePx; x += 1) {
        for (int y = 0; y < sizePx; y += 1) {
          bitmap.setPixel(x, y, matrix.get(x, y) ? Color.BLACK : Color.WHITE);
        }
      }
      return bitmap;
    } catch (WriterException error) {
      Log.w(TAG, "Failed to render pairing QR code", error);
      Bitmap bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888);
      bitmap.eraseColor(Color.WHITE);
      return bitmap;
    }
  }

  protected int dpToPx(int valueDp) {
    return Math.round(
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, valueDp, getResources().getDisplayMetrics()));
  }

  protected void setUpdateUiState(
      String state,
      String targetVersion,
      int progressPercent,
      String message,
      boolean visible) {
    currentUpdateState = state == null || state.trim().isEmpty() ? "IDLE" : state.trim().toUpperCase(Locale.US);
    currentUpdateTargetVersion = targetVersion == null ? "" : targetVersion.trim();
    currentUpdateProgressPercent = Math.max(0, Math.min(progressPercent, 100));
    currentUpdateMessage = message == null ? "" : message.trim();

    if (updatePanel != null) {
      updatePanel.setVisibility(visible ? View.VISIBLE : View.GONE);
    }
    if (updateTitleText != null) {
      updateTitleText.setText("TV 正在准备更新");
    }
    if (updateVersionText != null) {
      updateVersionText.setText(
          currentUpdateTargetVersion.isEmpty() ? "版本信息待确认" : "目标版本 " + currentUpdateTargetVersion);
    }
    if (updateStatusText != null) {
      updateStatusText.setText(currentUpdateMessage.isEmpty() ? "请稍候..." : currentUpdateMessage);
    }
    if (updateProgressBar != null) {
      updateProgressBar.setProgress(currentUpdateProgressPercent);
    }
    if (updateProgressText != null) {
      updateProgressText.setText(currentUpdateProgressPercent + "%");
    }
    refreshUpdateActionButtons(visible);
    dispatchScreenHeartbeat(false);
  }

  protected void clearUpdateUiState() {
    lastDownloadedUpdateApkFile = null;
    lastDownloadedUpdateVersion = "";
    setUpdateUiState("IDLE", "", 0, "", false);
  }

  protected void refreshUpdateActionButtons(boolean panelVisible) {
    boolean canShowManualInstall =
        panelVisible
            && lastDownloadedUpdateApkFile != null
            && lastDownloadedUpdateApkFile.exists()
            && ("DOWNLOADED".equals(currentUpdateState)
                || "INSTALLING".equals(currentUpdateState)
                || "ERROR".equals(currentUpdateState));
    boolean needsInstallPermission =
        panelVisible
            && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && !getPackageManager().canRequestPackageInstalls();

    if (updatePermissionButton != null) {
      updatePermissionButton.setVisibility(needsInstallPermission ? View.VISIBLE : View.GONE);
    }
    if (updateManualInstallButton != null) {
      updateManualInstallButton.setVisibility(canShowManualInstall ? View.VISIBLE : View.GONE);
    }
    if (updateActionSpacer != null) {
      updateActionSpacer.setVisibility(
          needsInstallPermission && canShowManualInstall ? View.VISIBLE : View.GONE);
    }
    if (updateActionRow != null) {
      updateActionRow.setVisibility((needsInstallPermission || canShowManualInstall) ? View.VISIBLE : View.GONE);
    }
  }

  protected void installAppUpdateFromRemote(
      String targetDeviceId,
      int screenNumber,
      String packageId,
      String version,
      String downloadUrl,
      String checksum) {
    Log.d(
        TAG,
        "install_app_update received targetDeviceId="
            + targetDeviceId
            + ", localDeviceId="
            + deviceId
            + ", targetScreen="
            + screenNumber
            + ", activeScreen="
            + activeScreenNumber
            + ", packageId="
            + packageId
            + ", version="
            + version
            + ", downloadUrl="
            + downloadUrl);

    if (targetDeviceId == null || !deviceId.equalsIgnoreCase(targetDeviceId)) {
      Log.d(TAG, "Ignoring install_app_update because deviceId does not match.");
      return;
    }

    if (screenNumber >= 1 && activeScreenNumber >= 1 && screenNumber != activeScreenNumber) {
      Log.w(
          TAG,
          "install_app_update screen mismatch detected, but proceeding because deviceId matched. targetScreen="
              + screenNumber
              + ", activeScreen="
              + activeScreenNumber);
    }

    stopPlayback();
    stopChecksumPolling();
    previewMode = false;
    setUpdateUiState("DOWNLOADING", version, 0, "正在下载更新包...", true);

    new Thread(
            () -> {
              try {
                Log.d(
                    TAG,
                    "Starting package download. packageId="
                        + packageId
                        + ", version="
                        + version
                        + ", downloadUrl="
                        + downloadUrl
                        + ", checksum="
                        + checksum);
                File apkFile =
                    repository.downloadAppPackage(
                        packageId,
                        version,
                        downloadUrl,
                        checksum,
                        (message, progressPercent) ->
                            runOnUiThread(
                                () ->
                                    setUpdateUiState(
                                        "DOWNLOADING", version, progressPercent, message, true)));

                lastDownloadedUpdateApkFile = apkFile;
                lastDownloadedUpdateVersion = version == null ? "" : version;
                Log.d(
                    TAG,
                    "Package download completed. file="
                        + apkFile.getAbsolutePath()
                        + ", size="
                        + apkFile.length());

                runOnUiThread(
                    () -> {
                      setUpdateUiState("DOWNLOADED", version, 100, "下载完成，准备安装...", true);
                      installDownloadedApk(apkFile, version);
                    });
              } catch (Exception error) {
                Log.e(TAG, "Package download failed", error);
                runOnUiThread(
                    () -> {
                        setUpdateUiState(
                            "ERROR",
                            version,
                            currentUpdateProgressPercent,
                            error.getMessage() == null ? "安装包下载失败。" : error.getMessage(),
                            true);
                        syncHandler.postDelayed(
                            () -> {
                              if ("ERROR".equals(currentUpdateState)) {
                                clearUpdateUiState();
                                scheduleChecksumPolling();
                              }
                            },
                            4000);
                    });
              }
            })
        .start();
  }

  protected void installDownloadedApk(File apkFile, String version) {
    if (apkFile == null || !apkFile.exists()) {
      setUpdateUiState("ERROR", version, currentUpdateProgressPercent, "安装包不存在，请重新下载。", true);
      return;
    }

    Log.d(
        TAG,
        "installDownloadedApk called. version="
            + version
            + ", file="
            + apkFile.getAbsolutePath()
            + ", size="
            + apkFile.length());
    setUpdateUiState("INSTALLING", version, 100, "正在尝试静默安装更新...", true);
    new Thread(
            () -> {
              SilentInstallResult silentResult = trySilentRootInstall(apkFile);
              runOnUiThread(
                  () -> {
                    if (silentResult.success) {
                      Log.d(
                          TAG,
                          "Silent install succeeded via "
                              + silentResult.commandLabel
                              + ": "
                              + silentResult.output);
                      setUpdateUiState("INSTALLED", version, 100, "静默安装完成，正在重启应用...", true);
                      relaunchSelfAfterSilentInstall();
                      return;
                    }

                    Log.w(
                        TAG,
                        "Silent install unavailable. lastCommand="
                            + silentResult.commandLabel
                            + ", exit="
                            + silentResult.exitCode
                            + ", output="
                            + silentResult.output);
                    setUpdateUiState("INSTALLING", version, 100, "静默安装不可用，正在打开系统安装器...", true);
                    launchApkInstaller(apkFile, version);
                  });
            })
        .start();
  }
}
