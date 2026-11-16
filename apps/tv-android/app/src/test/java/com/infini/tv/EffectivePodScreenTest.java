package com.infini.tv;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import com.infini.tv.model.CourseScript;
import com.infini.tv.testutil.CourseScriptFixtures;
import java.util.Arrays;
import java.util.Collections;
import org.junit.Test;

public class EffectivePodScreenTest {
  @Test
  public void constructor_filtersBlankCardsSoNoActionScreensRemainEmpty() {
    CourseScript.VideoGroupScreen sourceScreen =
        new CourseScript.VideoGroupScreen(
            1,
            "Empty",
            Collections.emptyList(),
            Arrays.asList(CourseScriptFixtures.blankCard(), null));
    CourseScript.PodScreen rule =
        new CourseScript.PodScreen(
            1,
            1,
            0,
            Collections.singletonList(new CourseScript.PodSetConfig(20, 0)));

    EffectivePodScreen effectiveScreen = new EffectivePodScreen(1, rule, sourceScreen, false);

    assertTrue(effectiveScreen.videoCards.isEmpty());
  }

  @Test
  public void constructor_keepsPlayableCardsWithActionTextOrMedia() {
    CourseScript.VideoGroupScreen sourceScreen =
        new CourseScript.VideoGroupScreen(
            1,
            "Mixed",
            Collections.emptyList(),
            Arrays.asList(CourseScriptFixtures.blankCard(), CourseScriptFixtures.card("row", "Row", "2")));
    CourseScript.PodScreen rule =
        new CourseScript.PodScreen(
            1,
            1,
            0,
            Collections.singletonList(new CourseScript.PodSetConfig(20, 0)));

    EffectivePodScreen effectiveScreen = new EffectivePodScreen(1, rule, sourceScreen, false);

    assertEquals(1, effectiveScreen.videoCards.size());
    assertEquals("Row", effectiveScreen.videoCards.get(0).actionName);
  }
}
