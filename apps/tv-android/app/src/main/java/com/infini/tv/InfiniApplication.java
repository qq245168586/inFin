package com.infini.tv;

import android.app.Application;
import com.infini.tv.diagnostics.TvDiagnostics;

/** Initializes process-wide diagnostics independently of Activity recreation. */
public final class InfiniApplication extends Application {
  @Override public void onCreate() {
    super.onCreate();
    TvDiagnostics.initialize(this);
  }
}
