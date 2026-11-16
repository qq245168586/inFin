import Foundation

/// The existing API uses both numeric IDs and string IDs in course scripts.
public struct EntityID: Codable, Hashable, Sendable, CustomStringConvertible {
    public let value: String
    public var description: String { value }
    public init(_ value: String) { self.value = value }
    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if let value = try? c.decode(String.self) { self.value = value }
        else { value = String(try c.decode(Int.self)) }
    }
    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(value)
    }
}

struct Envelope<T: Decodable>: Decodable { let data: T }
struct DailyBundle: Decodable { let schedules: [CourseSchedule] }

struct UserSession: Codable, Equatable {
    let username: String
    let nickname: String?
    let venueId: String?
    let venueName: String?
    let accountNamespace: String?
    let access_token: String // Public session identity, not the authentication secret.
    var displayName: String { nickname?.isEmpty == false ? nickname! : username }
    var hasVenue: Bool { !(venueId ?? "").isEmpty && !(accountNamespace ?? "").isEmpty }
}

public struct CourseSchedule: Decodable, Identifiable {
    public let id: EntityID
    let courseId: Int
    let courseName: String
    let version: String?
    let date: String?
    let beginTime: String
    let duration: Double?
    let description: String?
    let topic: String?
    let venueId: String?
    let accountNamespace: String?
    let contentChecksum: String?
    let course: CourseContent?

    var actionSections: [ActionSection] {
        guard let script = course?.script else { return [] }
        var result: [ActionSection] = []
        func append(_ title: String, _ cards: [VideoCard], _ key: String) {
            let actions = cards.enumerated().compactMap { index, card -> ActionItem? in
                guard !(card.actionName ?? "").isEmpty || card.actionId != nil else { return nil }
                return ActionItem(id: "\(key)-\(index)", actionID: card.actionId?.value,
                                  name: card.actionName ?? "未命名动作", station: card.stationNumber?.value,
                                  video: card.videoSource, description: card.description)
            }
            if !actions.isEmpty { result.append(ActionSection(id: key, title: title, actions: actions)) }
        }
        append("热身", script.sections?.warmup?.items ?? [], "warmup")
        for (g, group) in (script.training?.videoGroups ?? []).enumerated() {
            for screen in (group.screens ?? []).sorted(by: { $0.screenIndex < $1.screenIndex }) {
                append("\(group.name ?? "正式训练") · 屏幕组 \(screen.screenIndex)", screen.videoCards ?? [], "group-\(g)-\(screen.screenIndex)")
            }
        }
        append("冷身", script.sections?.cooldown?.items ?? [], "cooldown")
        return result
    }
    var actionCount: Int { actionSections.reduce(0) { $0 + $1.actions.count } }
}

struct CourseContent: Decodable { let script: CourseScript? }
struct CourseScript: Decodable {
    let sections: WaterfallSections?
    let training: Training?
}
struct WaterfallSections: Decodable { let warmup: Waterfall?; let cooldown: Waterfall? }
struct Waterfall: Decodable { let items: [VideoCard]? }
struct Training: Decodable { let videoGroups: [VideoGroup]? }
struct VideoGroup: Decodable { let name: String?; let screens: [VideoScreen]? }
struct VideoScreen: Decodable { let screenIndex: Int; let videoCards: [VideoCard]? }
struct VideoCard: Decodable {
    let actionId: EntityID?
    let actionName: String?
    let stationNumber: EntityID?
    let description: String?
    let mediaUrl: String?
    let videoUrl: String?
    let url: String?
    let media: MediaLink?
    let video: MediaLink?
    var videoSource: String? {
        [mediaUrl, videoUrl, url, media?.url, media?.src, video?.url, video?.src]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }.first { !$0.isEmpty }
    }
}
struct MediaLink: Decodable { let url: String?; let src: String? }
struct ActionSection: Identifiable { let id: String; let title: String; let actions: [ActionItem] }
struct ActionItem: Identifiable, Hashable {
    let id: String
    let actionID: String?
    let name: String
    let station: String?
    let video: String?
    let description: String?
}

struct ScreenEnvelope: Decodable { let screens: [TVScreen] }
struct TVScreen: Decodable, Identifiable {
    var id: String { deviceId }
    let deviceId: String
    let screenNumber: Int
    let online: Bool
    let appVersion: String?
    let playbackState: String?
    let cacheFileCount: Int?
    let cacheBytes: Double?
    let lastSeenAt: String?
}
struct CoursePackage: Decodable, Identifiable, Equatable { let id: Int; let name: String; let description: String? }
struct VenuePackages: Decodable {
    let packages: [CoursePackage]?
    let items: [CoursePackage]?
    let activeCoursePackageId: Int?
    let running: Bool?
    var all: [CoursePackage] { packages ?? items ?? [] }
}
struct PackageEnvelope: Decodable { let data: VenuePackages; let warning: String? }
struct PlaybackEnvelope: Decodable {
    let session: PlaybackSession?
    let data: PlaybackSession?
    var current: PlaybackSession? { session ?? data }
}
struct PlaybackSession: Decodable {
    let id: String
    let state: String
    let scheduleId: EntityID
    let courseName: String?
    var isActive: Bool { ["PREVIEW", "SCHEDULED", "RUNNING", "PAUSED"].contains(state) }
    var label: String {
        ["PREVIEW": "预览中", "SCHEDULED": "同步中", "RUNNING": "进行中", "PAUSED": "已暂停", "ENDED": "已结束", "TERMINATED": "已结束"][state] ?? "待机"
    }
}
