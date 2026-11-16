import Foundation

@MainActor
protocol CoachService {
    var isDemo: Bool { get }
    var cachedUser: UserSession? { get }
    func restore() async throws -> UserSession?
    func login(username: String, password: String) async throws -> UserSession
    func logout() async throws
    func schedules(date: Date, user: UserSession) async throws -> [CourseSchedule]
    func playback(user: UserSession) async throws -> PlaybackSession?
    func screens() async throws -> [TVScreen]
    func packages() async throws -> VenuePackages
    func switchPackage(_ id: Int) async throws -> PackageEnvelope
    func control(_ action: ControlAction, schedule: CourseSchedule, current: PlaybackSession?, user: UserSession) async throws
    func thumbnail(actionID: String) async throws -> Data
}

@MainActor
final class LiveCoachService: CoachService {
    let isDemo = false
    private let api: APIClient
    var cachedUser: UserSession? { api.credential?.user }
    init(api: APIClient) { self.api = api }
    convenience init() {
        self.init(api: APIClient(transport: AlamofireTransport(), credentials: KeychainCredentialStore()))
    }
    func restore() async throws -> UserSession? { try await api.restore() }
    func login(username: String, password: String) async throws -> UserSession { try await api.login(username: username, password: password) }
    func logout() async throws { try await api.logout() }
    func schedules(date: Date, user: UserSession) async throws -> [CourseSchedule] {
        guard user.hasVenue else { throw scopeError() }
        let response: DailyBundle = try await api.request("/api/tv/daily-bundle", query: [
            "date": CourseClock.day(date), "timeZone": "Asia/Shanghai", "accountNamespace": user.accountNamespace!])
        return response.schedules
    }
    func playback(user: UserSession) async throws -> PlaybackSession? {
        guard user.hasVenue else { throw scopeError() }
        let payload: PlaybackEnvelope = try await api.request("/api/tv/playback-sessions/current", query: ["venueId": user.venueId!, "accountNamespace": user.accountNamespace!])
        return payload.current
    }
    func screens() async throws -> [TVScreen] {
        let payload: ScreenEnvelope = try await api.request("/api/tv/screens")
        return payload.screens
    }
    func packages() async throws -> VenuePackages {
        let payload: PackageEnvelope = try await api.request("/api/coach/course-packages")
        return payload.data
    }
    func switchPackage(_ id: Int) async throws -> PackageEnvelope {
        try await api.request("/api/coach/active-course-package", method: "POST", body: ["coursePackageId": id, "commandId": UUID().uuidString])
    }
    func control(_ action: ControlAction, schedule: CourseSchedule, current: PlaybackSession?, user: UserSession) async throws {
        guard user.hasVenue else { throw scopeError() }
        guard schedule.venueId == nil || schedule.venueId == user.venueId,
              schedule.accountNamespace == nil || schedule.accountNamespace == user.accountNamespace else { throw scopeError() }
        if let current, current.isActive, current.scheduleId != schedule.id {
            throw APIError(status: 409, code: "OTHER_COURSE_ACTIVE", message: "另一节课正在进行，请先在那节课中结束后再切换。")
        }
        var body: [String: Any] = ["commandId": UUID().uuidString, "venueId": user.venueId!, "accountNamespace": user.accountNamespace!]
        var path: String
        switch action {
        case .preview, .start:
            body.merge(["scheduleId": schedule.id.value, "courseId": schedule.courseId,
                        "scheduledStartAtMs": CourseClock.startMilliseconds(date: schedule.date, beginTime: schedule.beginTime),
                        "bundleChecksum": schedule.contentChecksum ?? ""]) { _, new in new }
            if action == .start { body["startDelayMs"] = 5000 }
            if action == .start, let current, current.isActive, current.scheduleId == schedule.id {
                path = "/api/tv/playback-sessions/\(current.id)/start"
            } else {
                path = "/api/tv/playback-sessions/\(action == .preview ? "preview" : "start-from-schedule")"
            }
        case .pause, .resume, .terminate:
            guard let current, current.isActive, current.scheduleId == schedule.id else {
                throw APIError(status: 409, code: "NO_ACTIVE_SESSION", message: "没有可控制的当前课程，请刷新状态。")
            }
            path = "/api/tv/playback-sessions/\(current.id)/\(action.rawValue)"
        case .plan:
            path = "/api/tv/course-plan/show"
            body.merge(["scheduleId": schedule.id.value, "courseId": schedule.courseId,
                        "courseName": schedule.courseName, "playbackSessionId": current?.id ?? ""]) { _, new in new }
        }
        _ = try await api.bytes(path, method: "POST", body: body)
    }
    func thumbnail(actionID: String) async throws -> Data {
        guard Int(actionID) != nil else { throw URLError(.badURL) }
        return try await api.bytes("/api/actions/\(actionID)/thumbnail")
    }
    private func scopeError() -> APIError {
        APIError(status: 403, code: "VENUE_REQUIRED", message: "请使用绑定场馆的教练账号，学习版暂不支持管理员跨场馆控制。")
    }
}
