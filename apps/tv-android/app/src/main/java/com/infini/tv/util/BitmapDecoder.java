package com.infini.tv.util;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import java.io.File;

public final class BitmapDecoder {
  private BitmapDecoder() {}

  public static Bitmap decodeSampledFile(File file, int targetWidth, int targetHeight) {
    if (file == null || !file.isFile()) {
      return null;
    }
    BitmapFactory.Options bounds = new BitmapFactory.Options();
    bounds.inJustDecodeBounds = true;
    BitmapFactory.decodeFile(file.getAbsolutePath(), bounds);
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
      return null;
    }

    BitmapFactory.Options options = new BitmapFactory.Options();
    options.inSampleSize =
        calculateSampleSize(bounds.outWidth, bounds.outHeight, targetWidth, targetHeight);
    options.inPreferredConfig = Bitmap.Config.ARGB_8888;
    Bitmap bitmap = BitmapFactory.decodeFile(file.getAbsolutePath(), options);
    return scaleToTarget(bitmap, targetWidth, targetHeight);
  }

  public static Bitmap decodeSampledBytes(byte[] bytes, int targetWidth, int targetHeight) {
    if (bytes == null || bytes.length == 0) {
      return null;
    }
    BitmapFactory.Options bounds = new BitmapFactory.Options();
    bounds.inJustDecodeBounds = true;
    BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) {
      return null;
    }

    BitmapFactory.Options options = new BitmapFactory.Options();
    options.inSampleSize =
        calculateSampleSize(bounds.outWidth, bounds.outHeight, targetWidth, targetHeight);
    options.inPreferredConfig = Bitmap.Config.ARGB_8888;
    Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
    return scaleToTarget(bitmap, targetWidth, targetHeight);
  }

  private static int calculateSampleSize(
      int sourceWidth, int sourceHeight, int targetWidth, int targetHeight) {
    int safeTargetWidth = Math.max(targetWidth, 64);
    int safeTargetHeight = Math.max(targetHeight, 64);
    int sampleSize = 1;
    while ((sourceWidth / (sampleSize * 2)) >= safeTargetWidth
        && (sourceHeight / (sampleSize * 2)) >= safeTargetHeight) {
      sampleSize *= 2;
    }
    return Math.max(sampleSize, 1);
  }

  private static Bitmap scaleToTarget(Bitmap bitmap, int targetWidth, int targetHeight) {
    if (bitmap == null) {
      return null;
    }
    int safeTargetWidth = Math.max(targetWidth, 64);
    int safeTargetHeight = Math.max(targetHeight, 64);
    if (bitmap.getWidth() <= safeTargetWidth && bitmap.getHeight() <= safeTargetHeight) {
      return bitmap;
    }

    float scale =
        Math.min(
            safeTargetWidth / (float) Math.max(bitmap.getWidth(), 1),
            safeTargetHeight / (float) Math.max(bitmap.getHeight(), 1));
    int scaledWidth = Math.max(1, Math.round(bitmap.getWidth() * scale));
    int scaledHeight = Math.max(1, Math.round(bitmap.getHeight() * scale));
    Bitmap scaled = Bitmap.createScaledBitmap(bitmap, scaledWidth, scaledHeight, true);
    if (scaled != bitmap) {
      bitmap.recycle();
    }
    return scaled;
  }
}
