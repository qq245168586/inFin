const SECTION_LAYOUT = Object.freeze({
  WATERFALL: "WATERFALL",
  STATIONS: "STATIONS"
});

export const POD_ENDING = Object.freeze({
  HYDRATE: "HYDRATE",
  MOVE_ZONE: "MOVE_ZONE",
  FINISH: "FINISH"
});

export const POD_STATION_FLOW = Object.freeze({
  NORMAL: "NORMAL",
  SWITCH: "SWITCH"
});

export const COURSE_ROTATION_TYPE = Object.freeze({
  REGION: "REGION",
  LANE: "LANE",
  SNAKE: "SNAKE"
});

let idSeed = 0;

function uid(prefix) {
  idSeed += 1;
  return `${prefix}-${idSeed}`;
}

function seconds(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function positiveSeconds(value, fallback) {
  const num = seconds(value, fallback);
  return num > 0 ? num : fallback;
}

function nonNegativeSeconds(value, fallback = 0) {
  const num = seconds(value, fallback);
  return num >= 0 ? num : fallback;
}

function stationCode(value) {
  return String(value ?? "").trim();
}

function stationInputValue(value) {
  return String(value ?? "");
}

function normalizeVideoRowLayouts(rowLayouts = [], videoCards = [], screenCount = 3) {
  if (screenCount === 1) {
    return [];
  }

  const source = Array.isArray(rowLayouts) ? rowLayouts : [];
  if (!source.length) return [1, 1, 1];

  const rows = source.map((columns) => (Number(columns) === 2 ? 2 : 1));
  return rows.length === 3 && rows.every((columns) => columns === 2) ? [2, 2, 2, 2, 2] : rows.slice(0, 5);
}

function fitVideoCardsForRows(videoCards = [], rowLayouts = [], screenCount = 3) {
  if (screenCount === 1) {
    return videoCards.length ? videoCards : [createVideoCard()];
  }

  const capacity = rowLayouts.reduce((total, columns) => total + columns, 0);
  const nextCards = videoCards.slice(0, capacity);
  while (nextCards.length < capacity) {
    nextCards.push(createVideoCard());
  }
  return nextCards;
}

function isFilledVideoCard(card = {}) {
  return Boolean(card.actionId || card.actionName || stationCode(card.stationNumber));
}

function filledVideoCards(cards = []) {
  return (Array.isArray(cards) ? cards : []).filter((card) => isFilledVideoCard(card));
}

function normalizeSetConfigs(setConfigs = []) {
  const list = Array.isArray(setConfigs) ? setConfigs : [];
  const safeCount = Math.max(list.length, 1);

  return Array.from({ length: safeCount }, (_, index) => {
    const existing = list[index] || {};
    const isLast = index === safeCount - 1;
    return {
      id: existing.id || uid("pod-set"),
      workSeconds: positiveSeconds(existing.workSeconds, 40),
      restSeconds: isLast ? 0 : nonNegativeSeconds(existing.restSeconds, 20)
    };
  });
}

function normalizeSetConfigsForScreenCount(setConfigs = [], screenCount = 3) {
  const isSingleScreen = screenCount === 1;
  const source = isSingleScreen ? (setConfigs.length ? [setConfigs[0]] : []) : setConfigs;
  const targetCount = isSingleScreen ? 1 : Math.max(source.length, 1);
  return normalizeSetConfigs(source).slice(0, targetCount);
}

function findActionMeta(actionId, actionLookup = []) {
  return actionLookup.find((item) => String(item.id) === String(actionId)) ?? null;
}

function toActionName(actionId, fallbackName, actionLookup) {
  return fallbackName || findActionMeta(actionId, actionLookup)?.name || "";
}

export function createWaterfallItem(overrides = {}) {
  return {
    id: uid("waterfall-item"),
    actionId: "",
    actionName: "",
    seconds: 30,
    cue: "",
    ...overrides
  };
}

export function createWaterfallSection(title, overrides = {}) {
  return {
    id: uid("section"),
    title,
    layout: SECTION_LAYOUT.WATERFALL,
    items: [createWaterfallItem()],
    ...overrides
  };
}

export function createVideoCard(overrides = {}) {
  return {
    id: uid("video-card"),
    actionId: "",
    actionName: "",
    ...overrides,
    stationNumber: stationInputValue(overrides.stationNumber)
  };
}

export function createVideoGroupScreen(screenIndex, screenCount) {
  const rowLayouts = screenCount === 1 ? [] : [1, 1, 1];
  return {
    id: uid("group-screen"),
    screenIndex,
    stationLabel: screenCount === 1 ? "瀑布流屏幕" : `屏幕 ${screenIndex}`,
    layout: screenCount === 1 ? SECTION_LAYOUT.WATERFALL : SECTION_LAYOUT.STATIONS,
    rowLayouts,
    videoCards: fitVideoCardsForRows([createVideoCard()], rowLayouts, screenCount)
  };
}

export function createVideoGroup(overrides = {}) {
  const screenCount = overrides.screenCount ?? 3;
  return {
    id: uid("video-group"),
    name: `视频组 ${screenCount === 1 ? "单屏" : "三屏"}`,
    screenCount,
    screens: Array.from({ length: screenCount }, (_, index) =>
      createVideoGroupScreen(index + 1, screenCount)
    ),
    ...overrides
  };
}

export function createPodSetConfig(overrides = {}) {
  return {
    id: overrides.id || uid("pod-set"),
    workSeconds: positiveSeconds(overrides.workSeconds, 40),
    restSeconds: nonNegativeSeconds(overrides.restSeconds, 0)
  };
}

export function createPodScreenRule(screenIndex, overrides = {}) {
  const screenCount = overrides.screenCount === 1 ? 1 : 3;
  return {
    ...overrides,
    id: overrides.id || uid("pod-screen"),
    screenIndex,
    loopCount: Math.max(1, seconds(overrides.loopCount, 1)),
    stationRestSeconds: nonNegativeSeconds(overrides.stationRestSeconds, 30),
    setConfigs: normalizeSetConfigsForScreenCount(overrides.setConfigs || [createPodSetConfig()], screenCount),
    isCustomized: Boolean(overrides.isCustomized)
  };
}

export function createPod(overrides = {}) {
  const screenCount = overrides.screenCount ?? 3;
  return {
    id: uid("pod"),
    name: "新 Pod",
    videoGroupId: "",
    ending: POD_ENDING.HYDRATE,
    endingSeconds: nonNegativeSeconds(overrides.endingSeconds, 30),
    stationFlow: POD_STATION_FLOW.NORMAL,
    screens: Array.from({ length: screenCount }, (_, index) =>
      createPodScreenRule(index + 1)
    ),
    ...overrides
  };
}

export function createTrainingPanel(overrides = {}) {
  return {
    setCount: 1,
    breakCount: 0,
    workSeconds: 40,
    restSeconds: 20,
    ...overrides
  };
}

export function createReadyDurations(overrides = {}) {
  return {
    warmupSeconds: nonNegativeSeconds(overrides?.warmupSeconds, 15),
    workoutSeconds: nonNegativeSeconds(overrides?.workoutSeconds, 15),
    cooldownSeconds: nonNegativeSeconds(overrides?.cooldownSeconds, 10)
  };
}

export function createCoursePlanItem(overrides = {}) {
  return {
    id: uid("plan-item"),
    text: "",
    ...overrides
  };
}

export function createCoursePlanSection(overrides = {}) {
  return {
    id: uid("plan-section"),
    title: "",
    items: [createCoursePlanItem()],
    ...overrides
  };
}

export function createCoursePlan(overrides = {}) {
  return {
    sections: [],
    ...overrides
  };
}

export function createEmptyCourseScript() {
  const videoGroup = createVideoGroup({ name: "默认三屏视频组", screenCount: 3 });
  return {
    metadata: {
      id: uid("course"),
      name: "新课程",
      version: "v1.0.0",
      creator: "",
      description: "",
      topic: "",
      rotationType: COURSE_ROTATION_TYPE.REGION,
      tags: [],
      defaultHydrateSeconds: 30,
      readyDurations: createReadyDurations(),
      trainingPanel: createTrainingPanel()
    },
    sections: {
      warmup: createWaterfallSection("热身"),
      cooldown: createWaterfallSection("冷身")
    },
    plan: createCoursePlan(),
    training: {
      videoGroups: [videoGroup],
      pods: [
        createPod({
          name: "Pod 1",
          videoGroupId: videoGroup.id,
          screenCount: videoGroup.screenCount,
          ending: POD_ENDING.FINISH
        })
      ]
    }
  };
}

export function cloneCourseScript(courseScript) {
  return JSON.parse(JSON.stringify(courseScript));
}

function coerceLegacyPodScreen(screen, screenIndex, screenCount = 3) {
  const legacySegments = Array.isArray(screen?.segments) ? screen.segments : [];
  const firstSegment = legacySegments[0] || {};
  return createPodScreenRule(screenIndex, {
    screenCount,
    id: screen?.id || uid("pod-screen"),
    loopCount: Math.max(1, legacySegments.length || 1),
    stationRestSeconds: nonNegativeSeconds(firstSegment.restSeconds, 30),
    setConfigs: [
      createPodSetConfig({
        workSeconds: positiveSeconds(firstSegment.workSeconds, 40),
        restSeconds: 0
      })
    ]
  });
}

function normalizePodScreenRule(screen, screenIndex, screenCount = 3) {
  if (Array.isArray(screen?.setConfigs) && screen.setConfigs.length) {
    return {
      id: screen.id || uid("pod-screen"),
      screenIndex,
      loopCount: Math.max(1, seconds(screen.loopCount, 1)),
      stationRestSeconds: nonNegativeSeconds(screen.stationRestSeconds, 30),
      setConfigs: normalizeSetConfigsForScreenCount(screen.setConfigs, screenCount),
      isCustomized: Boolean(screen.isCustomized)
    };
  }

  return coerceLegacyPodScreen(screen, screenIndex, screenCount);
}

function normalizePodScreens(group, pod = {}) {
  return group.screens.map((screen) => {
    const existing = (pod.screens || []).find((item) => item.screenIndex === screen.screenIndex);
    return normalizePodScreenRule(existing, screen.screenIndex, group.screenCount);
  });
}

function normalizeCoursePlanItem(item = {}, index = 0) {
  return {
    id: item.id || `plan-item-${index + 1}`,
    text: String(item.text ?? "")
  };
}

function normalizeCoursePlanSection(section = {}, index = 0) {
  const items = Array.isArray(section?.items) ? section.items : [];
  return {
    id: section.id || `plan-section-${index + 1}`,
    title: String(section.title ?? ""),
    items: items.map(normalizeCoursePlanItem)
  };
}

export function normalizeCoursePlan(plan = {}) {
  const sections = Array.isArray(plan?.sections) ? plan.sections : [];
  return {
    sections: sections.map(normalizeCoursePlanSection)
  };
}

function getPodActionSequence(screenRule, videoCards = []) {
  const cards = Array.isArray(videoCards) ? videoCards.filter((card) => card.actionId || card.actionName) : [];
  const loopCount = Math.max(1, seconds(screenRule?.loopCount, 1));
  const sequence = [];

  for (let loopIndex = 0; loopIndex < loopCount; loopIndex += 1) {
    cards.forEach((card) => {
      sequence.push(card);
    });
  }

  return sequence;
}

function getPodActionCount(screenRule, videoCards = []) {
  return getPodActionSequence(screenRule, videoCards).length;
}

export function podScreenTotal(screenRule, videoCards = [], layout = SECTION_LAYOUT.STATIONS, stationFlow = POD_STATION_FLOW.NORMAL) {
  const cards = Array.isArray(videoCards)
    ? videoCards.filter((card) => card.actionId || card.actionName)
    : [];
  const cardCount = cards.length;
  if (!cardCount) {
    return 0;
  }

  const setConfigs = normalizeSetConfigs(screenRule?.setConfigs);
  const perLoopSeconds = setConfigs.reduce(
    (total, setConfig, index) =>
      total +
      positiveSeconds(setConfig.workSeconds, 40) +
      (index < setConfigs.length - 1 ? nonNegativeSeconds(setConfig.restSeconds, 0) : 0),
    0
  );
  const loopCount = Math.max(1, seconds(screenRule?.loopCount, 1));

  if (layout === SECTION_LAYOUT.WATERFALL) {
    const actionCount = cardCount * loopCount;
    const transitionSeconds =
      Math.max(actionCount - 1, 0) * nonNegativeSeconds(screenRule?.stationRestSeconds, 0);
    return actionCount * perLoopSeconds + transitionSeconds;
  }

  if (stationFlow === POD_STATION_FLOW.SWITCH) {
    const pairCount = Math.floor(cardCount / 2);
    if (!pairCount || !loopCount) {
      return 0;
    }
    const stationRestSeconds = nonNegativeSeconds(screenRule?.stationRestSeconds, 0);
    const perPairSeconds = setConfigs.reduce((total, setConfig, index) => {
      const workSeconds = positiveSeconds(setConfig.workSeconds, 40);
      const groupRestSeconds = index < setConfigs.length - 1 ? nonNegativeSeconds(setConfig.restSeconds, 0) : 0;
      return total + workSeconds * 2 + stationRestSeconds + groupRestSeconds;
    }, 0);
    const pairRounds = pairCount * loopCount;
    return pairRounds * perPairSeconds + Math.max(pairRounds - 1, 0) * stationRestSeconds;
  }

  const transitionSeconds =
    Math.max(loopCount - 1, 0) * nonNegativeSeconds(screenRule?.stationRestSeconds, 0);
  return loopCount * perLoopSeconds + transitionSeconds;
}

export function podTotalSeconds(pod, videoGroups = []) {
  if (!pod?.screens?.length) {
    return 0;
  }

  const linkedGroup = videoGroups.find((group) => group.id === pod.videoGroupId);
  const firstScreen = pod.screens[0];
  const linkedScreen = linkedGroup?.screens?.find((screen) => screen.screenIndex === firstScreen.screenIndex);
  return podScreenTotal(firstScreen, linkedScreen?.videoCards || [], linkedScreen?.layout, pod.stationFlow);
}

export function summarizeCourseScript(courseScript) {
  const warmupItems = courseScript?.sections?.warmup?.items || [];
  const cooldownItems = courseScript?.sections?.cooldown?.items || [];
  const warmupSeconds = warmupItems.reduce(
    (total, item) => total + seconds(item.seconds),
    0
  );
  const cooldownSeconds = cooldownItems.reduce(
    (total, item) => total + seconds(item.seconds),
    0
  );
  const trainingSeconds = courseScript.training.pods.reduce(
    (total, pod) => total + podTotalSeconds(pod, courseScript.training.videoGroups),
    0
  );
  const transitionSeconds = courseScript.training.pods.reduce(
    (total, pod) =>
      total +
      (pod.ending === POD_ENDING.FINISH
        ? 0
        : nonNegativeSeconds(pod.endingSeconds, courseScript.metadata.defaultHydrateSeconds)),
    0
  );

  return {
    warmupSeconds,
    trainingSeconds,
    hydrateSeconds: transitionSeconds,
    cooldownSeconds,
    totalSeconds: warmupSeconds + trainingSeconds + transitionSeconds + cooldownSeconds,
    podCount: courseScript.training.pods.length,
    videoGroupCount: courseScript.training.videoGroups.length
  };
}

export function legacyCourseToScript(legacyCourse = {}, options = {}) {
  const actionLookup = Array.isArray(options.actionLookup) ? options.actionLookup : [];
  if (legacyCourse?.sections && legacyCourse?.training) {
    const cloned = cloneCourseScript(legacyCourse);
    const groups = Array.isArray(cloned?.training?.videoGroups) ? cloned.training.videoGroups : [];
    const defaultHydrateSeconds = positiveSeconds(cloned.metadata?.defaultHydrateSeconds, 30);
    cloned.training = {
      ...cloned.training,
      videoGroups: groups.map((group) => ({
        ...group,
        screens: (group.screens || []).map((screen, screenIndex) => {
          const rowLayouts = normalizeVideoRowLayouts(screen.rowLayouts, screen.videoCards || [], group.screenCount);
          const videoCards = fitVideoCardsForRows(
            (screen.videoCards || []).map((card) => ({
              ...card,
              id: card.id || uid("video-card"),
              stationNumber: group.screenCount === 1 ? "" : stationInputValue(card.stationNumber)
            })),
            rowLayouts,
            group.screenCount
          );

          return {
            ...screen,
            screenIndex: screen.screenIndex || screenIndex + 1,
            stationLabel:
              screen.stationLabel ||
              (group.screenCount === 1 ? "瀑布流屏幕" : `屏幕 ${screen.screenIndex || screenIndex + 1}`),
            layout: group.screenCount === 1 ? SECTION_LAYOUT.WATERFALL : SECTION_LAYOUT.STATIONS,
            videoCards,
            rowLayouts
          };
        })
      })),
      pods: (cloned.training.pods || []).map((pod, podIndex) => {
        const linkedGroup =
          groups.find((group) => group.id === pod.videoGroupId) ||
          groups[0] ||
          createVideoGroup({ screenCount: 3 });
        return {
          ...pod,
          id: pod.id || uid("pod"),
          name: pod.name || `Pod ${podIndex + 1}`,
          ending: Object.values(POD_ENDING).includes(pod.ending) ? pod.ending : POD_ENDING.HYDRATE,
          endingSeconds: nonNegativeSeconds(pod.endingSeconds, defaultHydrateSeconds),
          stationFlow: pod.stationFlow === POD_STATION_FLOW.SWITCH ? POD_STATION_FLOW.SWITCH : POD_STATION_FLOW.NORMAL,
          videoGroupId: pod.videoGroupId || linkedGroup.id,
          screens: normalizePodScreens(linkedGroup, pod)
        };
      })
    };

    cloned.metadata = {
      ...cloned.metadata,
      description: String(cloned.metadata?.description ?? ""),
      topic: String(cloned.metadata?.topic ?? ""),
      rotationType: Object.values(COURSE_ROTATION_TYPE).includes(cloned.metadata?.rotationType)
        ? cloned.metadata.rotationType
        : COURSE_ROTATION_TYPE.REGION,
      defaultHydrateSeconds,
      readyDurations: createReadyDurations(cloned.metadata?.readyDurations),
      trainingPanel: createTrainingPanel(cloned.metadata?.trainingPanel)
    };
    cloned.plan = normalizeCoursePlan(cloned.plan);

    return cloned;
  }

  const legacyScreens = Array.isArray(legacyCourse.screens) ? legacyCourse.screens : [];
  const screenCount = legacyScreens.length > 1 ? 3 : 1;
  const baseGroup = createVideoGroup({
    name: screenCount === 1 ? "默认单屏组" : "默认三屏组",
    screenCount
  });

  const warmupItems = Array.isArray(legacyCourse.warmups)
    ? legacyCourse.warmups
        .map((item, index) => ({
          id: item.id || `warmup-${index + 1}`,
          actionId: String(item.actionId || ""),
          actionName: toActionName(item.actionId, item.actionName, actionLookup),
          seconds: positiveSeconds(item.duration, 30),
          cue: item.cue || ""
        }))
        .filter((item) => item.actionId || item.actionName)
    : [];

  const groupScreens = baseGroup.screens.map((screen) => {
    const source = legacyScreens.find((item) => Number(item.screenNum) === screen.screenIndex);
    const videoCards = Array.isArray(source?.items)
      ? source.items
          .map((item, index) => ({
            id: item.id || `legacy-card-${screen.screenIndex}-${index + 1}`,
            actionId: String(item.actionId || ""),
            actionName: toActionName(item.actionId, item.actionName, actionLookup),
            stationNumber: stationInputValue(item.serialNum)
          }))
          .filter((item) => item.actionId || item.actionName)
      : [];

    return {
      ...screen,
      videoCards: videoCards.length ? videoCards : screen.videoCards
    };
  });

  const videoGroup = {
    ...baseGroup,
    screens: groupScreens
  };

  const podScreens = videoGroup.screens.map((screen) =>
    createPodScreenRule(screen.screenIndex, {
      loopCount: 1,
      stationRestSeconds: Math.max(seconds(legacyCourse.restTime), 0),
      setConfigs: [
        createPodSetConfig({
          workSeconds: positiveSeconds(legacyCourse.trainingTime, 40),
          restSeconds: 0
        })
      ]
    })
  );

  return {
    metadata: {
      id: legacyCourse.id ? `course-${legacyCourse.id}` : uid("course"),
      name: legacyCourse.name || "新课程",
      version: legacyCourse.version || "v1.0.0",
      creator: legacyCourse.creator || "",
      description: "",
      topic: "",
      rotationType: COURSE_ROTATION_TYPE.REGION,
      tags: [],
      defaultHydrateSeconds: 30,
      readyDurations: createReadyDurations(),
      trainingPanel: createTrainingPanel({
        setCount: 1,
        breakCount: Math.max(seconds(legacyCourse.waterTime), 0),
        workSeconds: positiveSeconds(legacyCourse.trainingTime, 40),
        restSeconds: Math.max(seconds(legacyCourse.restTime), 0)
      })
    },
    sections: {
      warmup: {
        ...createWaterfallSection("热身"),
        items: warmupItems.length ? warmupItems : [createWaterfallItem()]
      },
      cooldown: {
        ...createWaterfallSection("冷身"),
        items:
          Array.isArray(legacyCourse.cooldown?.items) && legacyCourse.cooldown.items.length
            ? legacyCourse.cooldown.items
          : [createWaterfallItem()]
      }
    },
    plan: createCoursePlan(),
    training: {
      videoGroups: [videoGroup],
      pods: [
        createPod({
          name: "Pod 1",
          videoGroupId: videoGroup.id,
          screenCount: videoGroup.screenCount,
          ending: POD_ENDING.FINISH,
          screens: podScreens
        })
      ]
    }
  };
}

export function courseScriptUsesAction(courseScript, actionId) {
  const target = String(actionId || "");
  if (!target) {
    return false;
  }

  const waterfallItems = [
    ...(courseScript?.sections?.warmup?.items || []),
    ...(courseScript?.sections?.cooldown?.items || [])
  ];
  const videoCards = (courseScript?.training?.videoGroups || []).flatMap((group) =>
    (group.screens || []).flatMap((screen) => screen.videoCards || [])
  );

  return [...waterfallItems, ...videoCards].some((item) => String(item.actionId || "") === target);
}

export function validateCourseScript(courseScript) {
  const issues = [];
  const metadata = courseScript?.metadata || {};
  const sections = courseScript?.sections || {};
  const training = courseScript?.training || { videoGroups: [], pods: [] };

  if (!metadata.name?.trim()) {
    issues.push("课程名称不能为空。");
  }
  if (!metadata.version?.trim()) {
    issues.push("课程版本不能为空。");
  }
  if (seconds(metadata?.trainingPanel?.workSeconds) <= 0) {
    issues.push("TV 横屏显示的 work 时间必须大于 0。");
  }
  if (seconds(metadata?.trainingPanel?.restSeconds) < 0) {
    issues.push("TV 横屏显示的 rest 时间不能小于 0。");
  }
  if (!Object.values(COURSE_ROTATION_TYPE).includes(metadata.rotationType || COURSE_ROTATION_TYPE.REGION)) {
    issues.push("课程换站模式无效。");
  }

  for (const [sectionKey, fallbackTitle] of [
    ["warmup", "热身"],
    ["cooldown", "冷身"]
  ]) {
    const section = sections?.[sectionKey];
    const title = section?.title || fallbackTitle;
    const items = Array.isArray(section?.items) ? section.items : [];
    const allowEmpty = sectionKey === "cooldown";

    if (!items.length) {
      if (!allowEmpty) {
        issues.push(`${title}至少需要一个动作。`);
      }
      continue;
    }

    items.forEach((item, index) => {
      if (!item.actionId && !item.actionName) {
        issues.push(`${title}第 ${index + 1} 个动作未绑定动作库条目。`);
      }
      if (seconds(item.seconds) <= 0) {
        issues.push(`${title}第 ${index + 1} 个动作时长必须大于 0。`);
      }
    });

    if ((section?.layout || SECTION_LAYOUT.WATERFALL) !== SECTION_LAYOUT.WATERFALL) {
      issues.push(`${title}必须使用瀑布流展示。`);
    }
  }

  for (const sectionKey of Object.keys(sections || {})) {
    if (!["warmup", "cooldown"].includes(sectionKey)) {
      issues.push(`未知的课程分段: ${sectionKey}`);
    }
  }

  const groups = new Map(training.videoGroups.map((group) => [group.id, group]));
  if (!groups.size) {
    issues.push("正式训练至少需要一个视频组。");
  }

  training.videoGroups.forEach((group) => {
    let groupActiveCardCount = 0;
    group.screens.forEach((screen) => {
      const activeCards = filledVideoCards(screen.videoCards);
      groupActiveCardCount += activeCards.length;
      if (group.screenCount === 1 && !activeCards.length) {
        issues.push(`视频组 ${group.name} 的屏幕 ${screen.screenIndex} 没有动作卡片。`);
      }
      if (group.screenCount !== 1) {
        const stationCodes = activeCards.map((card) => stationCode(card.stationNumber));
        if (stationCodes.some((code) => !code)) {
          issues.push(`视频组 ${group.name} 的屏幕 ${screen.screenIndex} 存在空站点标签。`);
        }
        if (new Set(stationCodes).size !== stationCodes.length) {
          issues.push(`视频组 ${group.name} 的屏幕 ${screen.screenIndex} 站点标签不能重复。`);
        }
      }

      activeCards.forEach((card, index) => {
        if (!card.actionId && !card.actionName) {
          issues.push(
            `视频组 ${group.name} 的屏幕 ${screen.screenIndex} 第 ${index + 1} 个卡片未选择动作。`
          );
        }
      });
    });
    if (group.screenCount !== 1 && groupActiveCardCount <= 0) {
      issues.push(`视频组 ${group.name} 至少需要一个屏幕有动作卡片。`);
    }
  });

  if (!training.pods.length) {
    issues.push("正式训练至少需要一个 Pod。");
  }

  training.pods.forEach((pod, podIndex) => {
    const linkedGroup = groups.get(pod.videoGroupId);
    if (!linkedGroup) {
      issues.push(`Pod ${pod.name} 没有绑定有效的视频组。`);
      return;
    }

    if (!Object.values(POD_ENDING).includes(pod.ending)) {
      issues.push(`Pod ${pod.name} 的结束方式必须是补水、换区或课程结束。`);
    }
    if (
      pod.ending !== POD_ENDING.FINISH
      && nonNegativeSeconds(pod.endingSeconds, metadata?.defaultHydrateSeconds) <= 0
    ) {
      issues.push(`Pod ${pod.name} 的补水 / 换区时长必须大于 0。`);
    }
    if (![POD_STATION_FLOW.NORMAL, POD_STATION_FLOW.SWITCH, undefined].includes(pod.stationFlow)) {
      issues.push(`Pod ${pod.name} 的站点流转方式无效。`);
    }

    pod.screens.forEach((screen) => {
      const linkedScreen = linkedGroup.screens.find((item) => item.screenIndex === screen.screenIndex);
      if (!linkedScreen) {
        return;
      }
      if (seconds(screen.loopCount) <= 0) {
        issues.push(`Pod ${pod.name} 的屏幕 ${screen.screenIndex} 循环次数必须大于 0。`);
      }
      if (!screen.setConfigs?.length) {
        issues.push(`Pod ${pod.name} 的屏幕 ${screen.screenIndex} 至少需要一组训练配置。`);
      }
      if (seconds(screen.stationRestSeconds) < 0) {
        issues.push(`Pod ${pod.name} 的屏幕 ${screen.screenIndex} 换站休息时间不能小于 0。`);
      }
      screen.setConfigs.forEach((setConfig, setIndex) => {
        if (seconds(setConfig.workSeconds) <= 0) {
          issues.push(`Pod ${pod.name} 的屏幕 ${screen.screenIndex} 第 ${setIndex + 1} 组 work 时间必须大于 0。`);
        }
        if (setIndex < screen.setConfigs.length - 1 && seconds(setConfig.restSeconds) < 0) {
          issues.push(`Pod ${pod.name} 的屏幕 ${screen.screenIndex} 第 ${setIndex + 1} 组间休息不能小于 0。`);
        }
      });
    });

    const isLastPod = podIndex === training.pods.length - 1;
    if (isLastPod && pod.ending !== POD_ENDING.FINISH) {
      issues.push(`最后一个 Pod ${pod.name} 必须以课程结束收尾。`);
    }
    if (!isLastPod && pod.ending === POD_ENDING.FINISH) {
      issues.push(`非最后一个 Pod ${pod.name} 不能直接结束课程。`);
    }
  });

  return issues;
}

export const COURSE_ENUMS = {
  SECTION_LAYOUT,
  POD_ENDING,
  POD_STATION_FLOW,
  COURSE_ROTATION_TYPE
};

export const sampleActionLibrary = [
  { id: "act-box-jab", name: "Jab", category: "拳击", mediaUrl: "/media/jab.mp4" },
  { id: "act-box-hook", name: "Hook", category: "拳击", mediaUrl: "/media/hook.mp4" },
  { id: "act-box-upper", name: "Uppercut", category: "拳击", mediaUrl: "/media/uppercut.mp4" },
  { id: "act-kb-swing", name: "Kettlebell Swing", category: "壶铃", mediaUrl: "/media/swing.mp4" },
  { id: "act-burpee", name: "Burpee", category: "自重", mediaUrl: "/media/burpee.mp4" },
  { id: "act-row", name: "Row", category: "心肺", mediaUrl: "/media/row.mp4" },
  { id: "act-bike", name: "Bike", category: "心肺", mediaUrl: "/media/bike.mp4" },
  { id: "act-plank", name: "Plank", category: "核心", mediaUrl: "/media/plank.mp4" },
  { id: "act-warm-march", name: "March", category: "热身", mediaUrl: "/media/march.mp4" },
  { id: "act-cool-stretch", name: "Stretch", category: "冷身", mediaUrl: "/media/stretch.mp4" }
];

export const sampleCourseScript = {
  metadata: {
    id: "course-hybrid-001",
    name: "Hybrid Boxing",
    version: "2026.04",
    creator: "Infini Lab",
    description: "",
    topic: "",
    rotationType: COURSE_ROTATION_TYPE.REGION,
    tags: ["boxing", "hybrid", "interval"],
    defaultHydrateSeconds: 30,
    trainingPanel: {
      setCount: 3,
      breakCount: 1,
      workSeconds: 45,
      restSeconds: 15
    },
    readyDurations: {
      warmupSeconds: 15,
      workoutSeconds: 15,
      cooldownSeconds: 10
    }
  },
  sections: {
    warmup: {
      id: "section-warmup",
      title: "热身",
      layout: SECTION_LAYOUT.WATERFALL,
      items: [
        { id: "warm-1", actionId: "act-warm-march", actionName: "March", seconds: 45, cue: "Raise temperature" },
        { id: "warm-2", actionId: "act-plank", actionName: "Plank", seconds: 30, cue: "Brace core" },
        { id: "warm-3", actionId: "act-box-jab", actionName: "Jab", seconds: 45, cue: "Wake up shoulders" }
      ]
    },
    cooldown: {
      id: "section-cooldown",
      title: "冷身",
      layout: SECTION_LAYOUT.WATERFALL,
      items: [
        { id: "cool-1", actionId: "act-cool-stretch", actionName: "Stretch", seconds: 60, cue: "Breath down" },
        { id: "cool-2", actionId: "act-plank", actionName: "Plank", seconds: 30, cue: "Finish steady" }
      ]
    }
  },
  training: {
    videoGroups: [
      {
        id: "group-box-3",
        name: "拳击三屏组",
        screenCount: 3,
        screens: [
          {
            id: "group-box-3-screen-1",
            screenIndex: 1,
            stationLabel: "屏幕 1",
            layout: SECTION_LAYOUT.STATIONS,
            videoCards: [
              { id: "vg1-s1-1", actionId: "act-box-jab", actionName: "Jab", stationNumber: "1A" },
              { id: "vg1-s1-2", actionId: "act-box-hook", actionName: "Hook", stationNumber: "1B" },
              { id: "vg1-s1-3", actionId: "act-box-upper", actionName: "Uppercut", stationNumber: "1C" }
            ]
          },
          {
            id: "group-box-3-screen-2",
            screenIndex: 2,
            stationLabel: "屏幕 2",
            layout: SECTION_LAYOUT.STATIONS,
            videoCards: [
              { id: "vg1-s2-1", actionId: "act-burpee", actionName: "Burpee", stationNumber: "2A" },
              { id: "vg1-s2-2", actionId: "act-kb-swing", actionName: "Kettlebell Swing", stationNumber: "2B" },
              { id: "vg1-s2-3", actionId: "act-row", actionName: "Row", stationNumber: "2C" }
            ]
          },
          {
            id: "group-box-3-screen-3",
            screenIndex: 3,
            stationLabel: "屏幕 3",
            layout: SECTION_LAYOUT.STATIONS,
            videoCards: [
              { id: "vg1-s3-1", actionId: "act-bike", actionName: "Bike", stationNumber: "3A" },
              { id: "vg1-s3-2", actionId: "act-plank", actionName: "Plank", stationNumber: "3B" },
              { id: "vg1-s3-3", actionId: "act-burpee", actionName: "Burpee", stationNumber: "3C" }
            ]
          }
        ]
      },
      {
        id: "group-engine-1",
        name: "单屏瀑布组",
        screenCount: 1,
        screens: [
          {
            id: "group-engine-1-screen-1",
            screenIndex: 1,
            stationLabel: "瀑布流屏幕",
            layout: SECTION_LAYOUT.WATERFALL,
            videoCards: [
              { id: "vg2-s1-1", actionId: "act-row", actionName: "Row", stationNumber: "A" },
              { id: "vg2-s1-2", actionId: "act-bike", actionName: "Bike", stationNumber: "B" },
              { id: "vg2-s1-3", actionId: "act-kb-swing", actionName: "Kettlebell Swing", stationNumber: "C" }
            ]
          }
        ]
      }
    ],
    pods: [
      {
        id: "pod-1",
        name: "Pod 1",
        videoGroupId: "group-box-3",
        ending: POD_ENDING.HYDRATE,
        screens: [
          {
            id: "pod-1-screen-1",
            screenIndex: 1,
            loopCount: 2,
            stationRestSeconds: 30,
            setConfigs: [
              { id: "pod-1-screen-1-set-1", workSeconds: 45, restSeconds: 20 },
              { id: "pod-1-screen-1-set-2", workSeconds: 25, restSeconds: 0 }
            ]
          },
          {
            id: "pod-1-screen-2",
            screenIndex: 2,
            loopCount: 2,
            stationRestSeconds: 30,
            setConfigs: [
              { id: "pod-1-screen-2-set-1", workSeconds: 45, restSeconds: 20 },
              { id: "pod-1-screen-2-set-2", workSeconds: 25, restSeconds: 0 }
            ]
          },
          {
            id: "pod-1-screen-3",
            screenIndex: 3,
            loopCount: 2,
            stationRestSeconds: 30,
            setConfigs: [
              { id: "pod-1-screen-3-set-1", workSeconds: 45, restSeconds: 20 },
              { id: "pod-1-screen-3-set-2", workSeconds: 25, restSeconds: 0 }
            ]
          }
        ]
      },
      {
        id: "pod-2",
        name: "Pod 2",
        videoGroupId: "group-engine-1",
        ending: POD_ENDING.MOVE_ZONE,
        screens: [
          {
            id: "pod-2-screen-1",
            screenIndex: 1,
            loopCount: 1,
            stationRestSeconds: 25,
            setConfigs: [
              { id: "pod-2-screen-1-set-1", workSeconds: 50, restSeconds: 15 },
              { id: "pod-2-screen-1-set-2", workSeconds: 35, restSeconds: 0 }
            ]
          }
        ]
      },
      {
        id: "pod-3",
        name: "Pod 3",
        videoGroupId: "group-box-3",
        ending: POD_ENDING.FINISH,
        screens: [
          {
            id: "pod-3-screen-1",
            screenIndex: 1,
            loopCount: 1,
            stationRestSeconds: 30,
            setConfigs: [
              { id: "pod-3-screen-1-set-1", workSeconds: 40, restSeconds: 15 },
              { id: "pod-3-screen-1-set-2", workSeconds: 30, restSeconds: 10 },
              { id: "pod-3-screen-1-set-3", workSeconds: 20, restSeconds: 0 }
            ]
          },
          {
            id: "pod-3-screen-2",
            screenIndex: 2,
            loopCount: 1,
            stationRestSeconds: 30,
            setConfigs: [
              { id: "pod-3-screen-2-set-1", workSeconds: 40, restSeconds: 15 },
              { id: "pod-3-screen-2-set-2", workSeconds: 30, restSeconds: 10 },
              { id: "pod-3-screen-2-set-3", workSeconds: 20, restSeconds: 0 }
            ]
          },
          {
            id: "pod-3-screen-3",
            screenIndex: 3,
            loopCount: 1,
            stationRestSeconds: 30,
            setConfigs: [
              { id: "pod-3-screen-3-set-1", workSeconds: 40, restSeconds: 15 },
              { id: "pod-3-screen-3-set-2", workSeconds: 30, restSeconds: 10 },
              { id: "pod-3-screen-3-set-3", workSeconds: 20, restSeconds: 0 }
            ]
          }
        ]
      }
    ]
  }
};
