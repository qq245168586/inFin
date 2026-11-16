import Foundation

/// In-memory fixtures never send a production control command or modify a real venue.
@MainActor
final class DemoCoachService: CoachService {
    let isDemo = true
    var cachedUser: UserSession? { Self.user }
    static let user = UserSession(username: "coach.demo", nickname: "演示教练", venueId: "demo", venueName: "Infini 体验场馆", accountNamespace: "demo", access_token: "demo-public-id")
    private var current: PlaybackSession?
    private var activePackage = 1
    func restore() async throws -> UserSession? { Self.user }
    func login(username: String, password: String) async throws -> UserSession { Self.user }
    func logout() async throws { current = nil }
    func schedules(date: Date, user: UserSession) async throws -> [CourseSchedule] {
        guard CourseClock.day(date) == CourseClock.day(Date()) else { return [] }
        return try Self.makeSchedules(date: date)
    }
    static func makeSchedules(date: Date) throws -> [CourseSchedule] {
        let day = CourseClock.day(date)
        let cards: [[String: Any]] = [
            ["actionId": "demo-1", "actionName": "徒手深蹲", "stationNumber": "1A", "description": "双脚与肩同宽，保持躯干稳定。此处为学习用演示动作。"],
            ["actionId": "demo-2", "actionName": "交替弓步", "stationNumber": "1B", "description": "交替向前迈步，保持动作平稳。"],
            ["actionId": "demo-3", "actionName": "壶铃硬拉", "stationNumber": "2A"],
            ["actionId": "demo-4", "actionName": "动作视频样例", "stationNumber": "2B",
             "description": "现有线上媒体样例，不属于本课程训练配方。",
             "videoUrl": "https://114.215.185.184/infini/simulator-media/oss-shanghai/1783562199988-zwq2ft-.mp4"]
        ]
        let script: [String: Any] = [
            "sections": ["warmup": ["items": [["actionName": "动态热身", "actionId": "demo-warmup"]]], "cooldown": ["items": [["actionName": "全身拉伸", "actionId": "demo-cooldown"]]]],
            "training": ["videoGroups": [["name": "力量循环", "screens": [["screenIndex": 1, "videoCards": cards]]]]]
        ]
        let rows: [[String: Any]] = [
            ["id": 101, "courseId": 901, "courseName": "STRENGTH 全身力量", "version": "DEMO 1.0", "date": day, "beginTime": "09:00", "duration": 50, "topic": "力量训练", "description": "力量、耐力与动作控制。", "course": ["script": script]],
            ["id": 102, "courseId": 902, "courseName": "HYBRID 综合体能", "version": "DEMO 1.0", "date": day, "beginTime": "18:30", "duration": 45, "topic": "综合训练", "description": "循序渐进的全身训练。", "course": ["script": script]]
        ]
        return try JSONDecoder().decode([CourseSchedule].self, from: JSONSerialization.data(withJSONObject: rows))
    }
    func playback(user: UserSession) async throws -> PlaybackSession? { current }
    func screens() async throws -> [TVScreen] {
        (1...5).map { TVScreen(deviceId: "demo-tv-\($0)", screenNumber: $0, online: $0 != 4, appVersion: "Demo", playbackState: current?.state ?? "IDLE", cacheFileCount: 24, cacheBytes: 180_000_000, lastSeenAt: nil) }
    }
    func packages() async throws -> VenuePackages {
        VenuePackages(packages: [CoursePackage(id: 1, name: "Hybrid", description: "综合体能"), CoursePackage(id: 2, name: "12Round", description: "拳击训练")], items: nil, activeCoursePackageId: activePackage, running: current?.isActive)
    }
    func switchPackage(_ id: Int) async throws -> PackageEnvelope {
        guard current?.isActive != true else { throw APIError(status: 409, code: "ACTIVE", message: "请先结束当前演示课程。") }
        activePackage = id
        return PackageEnvelope(data: try await packages(), warning: nil)
    }
    func control(_ action: ControlAction, schedule: CourseSchedule, current: PlaybackSession?, user: UserSession) async throws {
        if let current, current.isActive, current.scheduleId != schedule.id {
            throw APIError(status: 409, code: "ACTIVE", message: "请先结束另一节演示课程。")
        }
        guard action != .plan else { return }
        let state: String = switch action {
        case .preview: "PREVIEW"
        case .start, .resume: "RUNNING"
        case .pause: "PAUSED"
        case .terminate: "TERMINATED"
        case .plan: "IDLE"
        }
        self.current = PlaybackSession(id: "demo-session", state: state, scheduleId: schedule.id, courseName: schedule.courseName)
    }
    func thumbnail(actionID: String) async throws -> Data { throw URLError(.resourceUnavailable) }
}
