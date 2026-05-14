package com.infini.tv.repository;

import android.content.Context;
import android.os.Environment;
import android.util.Log;
import com.infini.tv.model.CourseScript;
import com.infini.tv.model.TvScheduleItem;
import java.io.BufferedOutputStream;
import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URLEncoder;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.Collections;
import java.util.concurrent.TimeUnit;
import okhttp3.ConnectionSpec;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Protocol;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

abstract class TvScriptRepositoryBase extends TvScriptRepositoryContracts {
  protected final Context context;

  protected final File mediaCacheRoot;

  protected final File appUpdateRoot;

  protected TvScriptRepositoryBase(Context context) {
    this.context = context.getApplicationContext();
    this.mediaCacheRoot = new File(this.context.getFilesDir(), "tv-media-cache");
    File externalDownloadsRoot = this.context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
    if (externalDownloadsRoot != null) {
      this.appUpdateRoot = new File(externalDownloadsRoot, "tv-app-updates");
    } else {
      this.appUpdateRoot = new File(this.context.getFilesDir(), "tv-app-updates");
    }
    if (!mediaCacheRoot.exists()) {
      mediaCacheRoot.mkdirs();
    }
    if (!appUpdateRoot.exists()) {
      appUpdateRoot.mkdirs();
    }
  }

}
