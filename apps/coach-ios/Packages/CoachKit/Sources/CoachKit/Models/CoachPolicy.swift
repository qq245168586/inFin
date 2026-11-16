import Foundation

public enum CourseClock {
    public static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Shanghai")!
        return calendar
    }
    public static func day(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = calendar.timeZone
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }
    public static func startMilliseconds(date: String?, beginTime: String) -> Double {
        let iso = ISO8601DateFormatter()
        if let parsed = iso.date(from: beginTime) { return parsed.timeIntervalSince1970 * 1000 }
        iso.formatOptions.insert(.withFractionalSeconds)
        if let parsed = iso.date(from: beginTime) { return parsed.timeIntervalSince1970 * 1000 }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = calendar.timeZone
        for format in ["yyyy-MM-dd HH:mm", "yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd'T'HH:mm:ss"] {
            f.dateFormat = format
            if let parsed = f.date(from: beginTime.contains("T") || beginTime.contains(" ") ? beginTime : "\(date ?? "") \(beginTime)") {
                return parsed.timeIntervalSince1970 * 1000
            }
        }
        return 0
    }
    static func timeLabel(_ schedule: CourseSchedule) -> String {
        let ms = startMilliseconds(date: schedule.date, beginTime: schedule.beginTime)
        guard ms > 0 else { return schedule.beginTime }
        let f = DateFormatter()
        f.timeZone = calendar.timeZone
        f.dateFormat = "HH:mm"
        return f.string(from: Date(timeIntervalSince1970: ms / 1000))
    }
}

public struct APIConfiguration: Sendable {
    public let origin: URL
    public init(origin: URL = URL(string: "https://114.215.185.184")!) { self.origin = origin }
    public func api(_ path: String, query: [String: String] = [:]) -> URL {
        precondition(path.hasPrefix("/api/"))
        var c = URLComponents(url: origin, resolvingAgainstBaseURL: false)!
        c.path = "/infini" + path
        c.queryItems = query.isEmpty ? nil : query.sorted { $0.key < $1.key }.map(URLQueryItem.init)
        return c.url!
    }
    public func media(_ raw: String?) -> URL? {
        guard let raw, !raw.isEmpty else { return nil }
        let legacy = ["8.130.65.113", "api.infintraining.work", "coach.infintraining.work", "114.215.185.184"]
        guard var c = URLComponents(string: raw) else { return nil }
        if c.host == nil || legacy.contains(c.host ?? "") {
            guard c.path.hasPrefix("/") else { return nil }
            c.scheme = origin.scheme; c.host = origin.host; c.port = origin.port
            if c.path.hasPrefix("/api/") || c.path.hasPrefix("/media/") { c.path = "/infini" + c.path }
        }
        guard c.scheme == "https", c.user == nil, c.password == nil else { return nil }
        return c.url
    }
    public func allowsCredentials(_ url: URL) -> Bool {
        url.scheme == "https" && url.host == origin.host && url.port == origin.port && url.path.hasPrefix("/infini/api/")
    }
}

public struct APIError: Error, LocalizedError {
    public let status: Int
    public let code: String
    public let message: String
    public init(status: Int, code: String, message: String) { self.status = status; self.code = code; self.message = message }
    public var errorDescription: String? { message }
    public var expiresSession: Bool { status == 401 && code == "SESSION_EXPIRED" }
    public var shouldRefresh: Bool { status == 401 && code == "ACCESS_EXPIRED" }
}

enum ControlAction: String, Identifiable {
    case preview, start, pause, resume, terminate, plan
    var id: String { rawValue }
    var title: String {
        switch self {
        case .preview: "进入预览"
        case .start: "开始课程"
        case .pause: "暂停课程"
        case .resume: "继续课程"
        case .terminate: "结束课程"
        case .plan: "投屏课程计划"
        }
    }
    var symbol: String {
        switch self {
        case .preview: "eye"
        case .start, .resume: "play.fill"
        case .pause: "pause.fill"
        case .terminate: "stop.fill"
        case .plan: "airplayvideo"
        }
    }
}
