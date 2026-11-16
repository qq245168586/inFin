package com.infini.tv.util;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;

import java.io.File;
import java.io.FileOutputStream;
import org.junit.Test;

public class LocalVideoPlaybackPolicyTest {
  @Test
  public void rejectsRemoteAndMissingMedia() {
    assertEquals("", LocalVideoPlaybackPolicy.resolvePlayablePath("https://example.com/video.mp4"));
    assertEquals("", LocalVideoPlaybackPolicy.resolvePlayablePath("http://example.com/video.mp4"));
    assertEquals("", LocalVideoPlaybackPolicy.resolvePlayablePath("/missing/video.mp4"));
  }

  @Test
  public void acceptsReadableLocalMedia() throws Exception {
    File mediaFile = File.createTempFile("infini-local-video", ".mp4");
    try (FileOutputStream output = new FileOutputStream(mediaFile)) {
      output.write(new byte[] {1, 2, 3});
    }

    String resolved = LocalVideoPlaybackPolicy.resolvePlayablePath(mediaFile.getAbsolutePath());
    assertFalse(resolved.isEmpty());
    assertEquals(mediaFile.getAbsolutePath(), resolved);
    mediaFile.delete();
  }
}
