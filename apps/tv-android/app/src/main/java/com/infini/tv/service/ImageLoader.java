package com.infini.tv.service;

import android.graphics.Bitmap;
import com.infini.tv.util.BitmapDecoder;
import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public final class ImageLoader {
  private ImageLoader() {}

  public static Bitmap loadBitmap(String source, int targetWidth, int targetHeight) {
    if (source == null || source.trim().isEmpty()) {
      return null;
    }

    String normalized = source.trim();
    try {
      File localFile = new File(normalized);
      if (localFile.isFile()) {
        return BitmapDecoder.decodeSampledFile(localFile, targetWidth, targetHeight);
      }

      HttpURLConnection connection = (HttpURLConnection) new URL(normalized).openConnection();
      connection.setConnectTimeout(6000);
      connection.setReadTimeout(12000);
      connection.setRequestMethod("GET");
      connection.setDoInput(true);

      int responseCode = connection.getResponseCode();
      if (responseCode < 200 || responseCode >= 300) {
        connection.disconnect();
        return null;
      }

      try (InputStream inputStream = new BufferedInputStream(connection.getInputStream())) {
        return BitmapDecoder.decodeSampledBytes(readAllBytes(inputStream), targetWidth, targetHeight);
      } finally {
        connection.disconnect();
      }
    } catch (Exception ignored) {
      return null;
    }
  }

  private static byte[] readAllBytes(InputStream inputStream) throws java.io.IOException {
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    byte[] buffer = new byte[16 * 1024];
    int read;
    while ((read = inputStream.read(buffer)) != -1) {
      output.write(buffer, 0, read);
    }
    return output.toByteArray();
  }
}
