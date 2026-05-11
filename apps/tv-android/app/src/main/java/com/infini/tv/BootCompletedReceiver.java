package com.infini.tv;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import android.util.Log;

public class BootCompletedReceiver extends BroadcastReceiver {
  private static final String TAG = "InfiniTvBoot";
  private static final long LAUNCH_DELAY_MS = 3500L;

  @Override
  public void onReceive(Context context, Intent intent) {
    if (intent == null || intent.getAction() == null) {
      return;
    }

    String action = intent.getAction();
    if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
        && !Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)
        && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
        && !"android.intent.action.QUICKBOOT_POWERON".equals(action)
        && !"com.htc.intent.action.QUICKBOOT_POWERON".equals(action)
        && !"android.intent.action.ACTION_BOOT_IPO".equals(action)
        && !"com.infini.tv.action.DEBUG_AUTOSTART".equals(action)) {
      return;
    }

    try {
      Intent launchIntent = new Intent(context, MainActivity.class);
      launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
      PendingIntent pendingIntent =
          PendingIntent.getActivity(
              context,
              1001,
              launchIntent,
              PendingIntent.FLAG_UPDATE_CURRENT
                  | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                      ? PendingIntent.FLAG_IMMUTABLE
                      : 0));
      AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
      long triggerAtMs = SystemClock.elapsedRealtime() + LAUNCH_DELAY_MS;
      if (alarmManager != null) {
        alarmManager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAtMs, pendingIntent);
        Log.d(
            TAG,
            "Scheduled TV auto-launch for action="
                + action
                + " after "
                + LAUNCH_DELAY_MS
                + "ms");
      } else {
        context.startActivity(launchIntent);
        Log.d(TAG, "AlarmManager unavailable, launched TV app immediately for action=" + action);
      }
    } catch (Exception error) {
      Log.e(TAG, "Failed to auto-launch TV app", error);
    }
  }
}
