export function createMockCourseScript(overrides: Record<string, any> = {}) {
  const metadata = {
    id: "course-mock-strength",
    name: "Mock Strength",
    version: "2026.01",
    creator: "Coach Kai",
    description: "Fixture course for server unit tests",
    topic: "strength",
    rotationType: "REGION",
    tags: ["fixture"],
    defaultHydrateSeconds: 30,
    trainingPanel: {
      setCount: 1,
      breakCount: 0,
      workSeconds: 40,
      restSeconds: 20
    },
    readyDurations: {
      warmupSeconds: 10,
      workoutSeconds: 15,
      cooldownSeconds: 10
    },
    ...(overrides.metadata || {})
  };

  return {
    metadata,
    sections: {
      warmup: {
        id: "fixture-warmup",
        title: "Warmup",
        layout: "WATERFALL",
        items: [
          {
            id: "fixture-warmup-1",
            actionId: "1",
            actionName: "Air Squat",
            seconds: 30,
            cue: "Stay tall"
          }
        ]
      },
      cooldown: {
        id: "fixture-cooldown",
        title: "Cooldown",
        layout: "WATERFALL",
        items: [
          {
            id: "fixture-cooldown-1",
            actionId: "2",
            actionName: "Stretch",
            seconds: 30,
            cue: "Breathe"
          }
        ]
      }
    },
    plan: {
      sections: []
    },
    training: {
      videoGroups: [
        {
          id: "fixture-group",
          name: "Main Group",
          screenCount: 3,
          screens: [
            {
              id: "fixture-screen-1",
              screenIndex: 1,
              stationLabel: "Screen 1",
              layout: "STATIONS",
              rowLayouts: [1, 1, 1],
              videoCards: [
                {
                  id: "fixture-card-1",
                  actionId: "1",
                  actionName: "Air Squat",
                  stationNumber: "1A",
                  target: ""
                }
              ]
            },
            {
              id: "fixture-screen-2",
              screenIndex: 2,
              stationLabel: "Screen 2",
              layout: "STATIONS",
              rowLayouts: [1, 1, 1],
              videoCards: [
                {
                  id: "fixture-card-2",
                  actionId: "2",
                  actionName: "Stretch",
                  stationNumber: "2A",
                  target: ""
                }
              ]
            },
            {
              id: "fixture-screen-3",
              screenIndex: 3,
              stationLabel: "Screen 3",
              layout: "STATIONS",
              rowLayouts: [1, 1, 1],
              videoCards: [
                {
                  id: "fixture-card-3",
                  actionId: "3",
                  actionName: "Row",
                  stationNumber: "3A",
                  target: ""
                }
              ]
            }
          ]
        }
      ],
      pods: [
        {
          id: "fixture-pod",
          name: "Pod 1",
          videoGroupId: "fixture-group",
          ending: "FINISH",
          stationFlow: "NORMAL",
          screens: [
            {
              id: "fixture-pod-screen-1",
              screenIndex: 1,
              loopCount: 1,
              stationRestSeconds: 10,
              setConfigs: [{ id: "fixture-set-1", workSeconds: 40, restSeconds: 0 }]
            },
            {
              id: "fixture-pod-screen-2",
              screenIndex: 2,
              loopCount: 1,
              stationRestSeconds: 10,
              setConfigs: [{ id: "fixture-set-2", workSeconds: 40, restSeconds: 0 }]
            },
            {
              id: "fixture-pod-screen-3",
              screenIndex: 3,
              loopCount: 1,
              stationRestSeconds: 10,
              setConfigs: [{ id: "fixture-set-3", workSeconds: 40, restSeconds: 0 }]
            }
          ]
        }
      ]
    },
    ...overrides
  };
}

export function createMockDatabaseState(overrides: Record<string, any> = {}) {
  const createdAt = "2026-06-01T00:00:00.000Z";
  const courseScript = createMockCourseScript();

  return {
    media: [],
    appPackages: [],
    coursePackages: [
      {
        id: 1,
        name: "Default Package",
        description: "Fixture default package",
        courseIds: [101],
        isDefault: true,
        createTime: createdAt,
        updateTime: createdAt
      },
      {
        id: 2,
        name: "Advanced Package",
        description: "Fixture secondary package",
        courseIds: [],
        isDefault: false,
        createTime: createdAt,
        updateTime: createdAt
      }
    ],
    actionTypes: [
      { id: 1, name: "Strength", coursePackageIds: [1, 2] },
      { id: 2, name: "Mobility", coursePackageIds: [1] }
    ],
    lessonTypes: [
      { id: 1, name: "Strength" },
      { id: 2, name: "Mobility" }
    ],
    actions: [
      {
        id: 1,
        name: "Air Squat",
        description: "",
        typeIds: [1],
        media: null,
        courseTags: [],
        coursePackageIds: [1, 2],
        author: "coach",
        ownerUsername: "coach",
        createTime: createdAt,
        updateTime: createdAt
      },
      {
        id: 2,
        name: "Stretch",
        description: "",
        typeIds: [2],
        media: null,
        courseTags: [],
        coursePackageIds: [1],
        author: "coach",
        ownerUsername: "coach",
        createTime: createdAt,
        updateTime: createdAt
      },
      {
        id: 3,
        name: "Row",
        description: "",
        typeIds: [1],
        media: null,
        courseTags: [],
        coursePackageIds: [1],
        author: "coach",
        ownerUsername: "coach",
        createTime: createdAt,
        updateTime: createdAt
      }
    ],
    courses: [
      {
        id: 101,
        name: "Mock Strength",
        creator: "Coach Kai",
        author: "coach",
        ownerUsername: "coach",
        version: "2026.01",
        description: "Fixture course for server unit tests",
        topic: "strength",
        rotationType: "REGION",
        typeIds: [1],
        coursePackageId: 1,
        logoMedia: null,
        metadata: courseScript.metadata,
        stationRules: {
          screens: []
        },
        script: courseScript,
        summary: {
          totalSeconds: 100,
          warmupActionCount: 1,
          cooldownActionCount: 1,
          trainingCardCount: 3
        },
        updateTime: createdAt
      }
    ],
    templates: [],
    schedules: [],
    tvScreens: [],
    playbackSessions: [],
    venues: [
      {
        id: "venue-a",
        name: "Venue A",
        accountNamespace: "venue-a",
        coursePackageIds: [1],
        activeCoursePackageId: 1,
        createTime: createdAt,
        updateTime: createdAt
      }
    ],
    users: [
      {
        id: 10,
        username: "coach",
        nickname: "Coach",
        avatar: "",
        gender: "UNKNOWN",
        userType: "CONSOLE",
        passwordDigest: "test",
        passwordPlain: "test",
        accountNamespace: "venue-a",
        environmentLabel: "Venue A",
        role: "venue",
        venueId: "venue-a",
        coursePackageIds: [1],
        allowedClients: ["coach-web", "editor-web"],
        createTime: createdAt,
        lastLoginTime: null
      }
    ],
    authSessions: [],
    ...overrides
  };
}
