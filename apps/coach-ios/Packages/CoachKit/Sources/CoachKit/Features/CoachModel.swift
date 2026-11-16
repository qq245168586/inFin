import Foundation
import Observation

@MainActor @Observable
final class CoachModel {
    private(set) var user: UserSession?
    private(set) var isDemo = false
    private(set) var restoring = true
    private(set) var authenticating = false
    var selectedDate = Date()
    private(set) var schedules: [CourseSchedule] = []
    private(set) var screens: [TVScreen] = []
    private(set) var packages: VenuePackages?
    private(set) var playback: PlaybackSession?
    private(set) var loading = false
    private(set) var controlsLocked = false
    var errorMessage: String?
    var notice: String?
    var loginError: String?
    @ObservationIgnored private var service: any CoachService
    @ObservationIgnored private var identity = UUID()
    @ObservationIgnored private var loadID = UUID()
    @ObservationIgnored private var lockID = UUID()

    init(service: any CoachService) { self.service = service }
    convenience init() { self.init(service: LiveCoachService()) }

    func restore() async {
        defer { restoring = false }
        guard !ProcessInfo.processInfo.arguments.contains("--ui-testing") else { return }
        do { user = try await service.restore() }
        catch {
            if (error as? APIError)?.expiresSession != true { user = service.cachedUser }
            loginError = error.localizedDescription
        }
        if user != nil { await refresh() }
    }
    func login(username: String, password: String) async {
        guard !authenticating else { return }
        authenticating = true; loginError = nil
        defer { authenticating = false }
        do {
            let next = try await service.login(username: username, password: password)
            guard next.hasVenue else {
                try await service.logout()
                throw APIError(status: 403, code: "VENUE_REQUIRED", message: "请使用绑定场馆的教练账号。")
            }
            identity = UUID(); user = next; isDemo = false
            await refresh()
        } catch { loginError = error.localizedDescription }
    }
    func enterDemo() async {
        guard !authenticating else { return }
        resetData()
        service = DemoCoachService(); isDemo = true; user = DemoCoachService.user
        await refresh()
    }
    func logout() async {
        guard !controlsLocked, !authenticating else { return }
        authenticating = true
        defer { authenticating = false }
        do {
            try await service.logout()
            resetData(); user = nil; isDemo = false; service = LiveCoachService()
        } catch { handle(error) }
    }

    /// New dates and account changes invalidate older responses before they can update the UI.
    func refresh() async {
        guard let user else { return }
        let token = UUID(); loadID = token
        let account = identity
        let date = selectedDate
        loading = true
        defer { if loadID == token { loading = false } }
        do {
            let result = try await service.schedules(date: date, user: user)
            guard loadID == token, account == identity else { return }
            schedules = result
            let next = try await service.playback(user: user)
            guard loadID == token, account == identity else { return }
            playback = next
        } catch { if loadID == token, account == identity { handle(error) } }
    }
    func selectDate(_ date: Date) async {
        guard CourseClock.day(date) != CourseClock.day(selectedDate) else { return }
        selectedDate = date; schedules = []
        await refresh()
    }
    func refreshPlayback() async {
        guard let user, !controlsLocked else { return }
        let token = identity
        do {
            let next = try await service.playback(user: user)
            if identity == token, !controlsLocked { playback = next }
        } catch { if identity == token { handle(error) } }
    }
    func loadScreens() async {
        let token = identity
        do { let next = try await service.screens(); if identity == token { screens = next } }
        catch { if identity == token { handle(error) } }
    }
    func loadPackages() async {
        let token = identity
        do { let next = try await service.packages(); if identity == token { packages = next } }
        catch { if identity == token { handle(error) } }
    }
    func switchPackage(_ package: CoursePackage) async {
        guard !controlsLocked else { return }
        let lock = beginControl()
        let started = ContinuousClock.now
        do {
            let response = try await service.switchPackage(package.id)
            packages = response.data
            schedules = []; playback = nil
            notice = response.warning?.isEmpty == false ? response.warning : "已切换至 \(package.name)"
            await refresh()
        } catch { handle(error) }
        await endControl(lock, started: started)
    }
    func control(_ action: ControlAction, schedule: CourseSchedule) async {
        guard !controlsLocked, let user else { return }
        let lock = beginControl()
        let started = ContinuousClock.now
        do {
            // Re-read authority immediately before mutation; never guess state from an old card.
            let latest = try await service.playback(user: user)
            playback = latest
            try await service.control(action, schedule: schedule, current: latest, user: user)
            playback = try await service.playback(user: user)
            notice = isDemo ? "演示：\(action.title)成功" : "\(action.title)指令已提交"
        } catch { handle(error) }
        await endControl(lock, started: started)
    }
    func thumbnail(_ id: String) async throws -> Data { try await service.thumbnail(actionID: id) }
    func state(for schedule: CourseSchedule) -> PlaybackSession? {
        playback?.scheduleId == schedule.id ? playback : nil
    }
    private func beginControl() -> UUID {
        controlsLocked = true; lockID = UUID(); notice = nil
        return lockID
    }
    private func endControl(_ token: UUID, started: ContinuousClock.Instant) async {
        let remaining = Duration.seconds(2) - started.duration(to: .now)
        if remaining > .zero { try? await Task.sleep(for: remaining) }
        if token == lockID { controlsLocked = false }
    }
    private func handle(_ error: Error) {
        if error is CancellationError { return }
        errorMessage = error.localizedDescription
        if (error as? APIError)?.expiresSession == true { user = nil; resetData() }
    }
    private func resetData() {
        identity = UUID(); loadID = UUID(); lockID = UUID()
        schedules = []; screens = []; packages = nil; playback = nil
        loading = false; controlsLocked = false; notice = nil; loginError = nil
    }
}
