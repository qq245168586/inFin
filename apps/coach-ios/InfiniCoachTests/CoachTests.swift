import XCTest
@testable import CoachKit

final class CoachPolicyTests: XCTestCase {
    func testMixedIDs() throws {
        XCTAssertEqual(try JSONDecoder().decode(EntityID.self, from: Data("42".utf8)), EntityID("42"))
        XCTAssertEqual(try JSONDecoder().decode(EntityID.self, from: Data("\"42\"".utf8)), EntityID("42"))
    }
    func testBeijingDayDoesNotUseDeviceTimeZone() {
        let date = ISO8601DateFormatter().date(from: "2026-11-10T17:00:00Z")!
        XCTAssertEqual(CourseClock.day(date), "2026-11-11")
    }
    func testCourseStartUsesBeijingTime() {
        let expected = ISO8601DateFormatter().date(from: "2026-11-11T01:00:00Z")!.timeIntervalSince1970 * 1000
        XCTAssertEqual(CourseClock.startMilliseconds(date: "2026-11-11", beginTime: "09:00"), expected)
        XCTAssertEqual(CourseClock.startMilliseconds(date: nil, beginTime: "2026-11-11T09:00:00+08:00"), expected)
        XCTAssertEqual(CourseClock.startMilliseconds(date: nil, beginTime: "invalid"), 0)
    }
    func testURLPrefixAndQueryEncoding() {
        let url = APIConfiguration().api("/api/tv/daily-bundle", query: ["accountNamespace": "venue a&b"])
        XCTAssertEqual(url.path, "/infini/api/tv/daily-bundle")
        XCTAssertEqual(URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first?.value, "venue a&b")
    }
    func testMediaAndCredentialBoundaries() {
        let config = APIConfiguration()
        XCTAssertEqual(config.media("/api/media/a.mp4")?.path, "/infini/api/media/a.mp4")
        XCTAssertEqual(config.media("https://api.infintraining.work/api/media/a.mp4")?.host, "114.215.185.184")
        XCTAssertNil(config.media("http://external.example/a.mp4"))
        XCTAssertNil(config.media("file:///private/secret"))
        XCTAssertFalse(config.allowsCredentials(URL(string: "https://external.example/infini/api/a")!))
        XCTAssertFalse(config.allowsCredentials(URL(string: "https://114.215.185.184/not-api")!))
        XCTAssertTrue(config.allowsCredentials(config.api("/api/tv/screens")))
    }
    func testTemporaryFailuresDoNotExpireSession() {
        for status in [403, 409, 500, 503] {
            XCTAssertFalse(APIError(status: status, code: "SESSION_EXPIRED", message: "").expiresSession)
            XCTAssertFalse(APIError(status: status, code: "ACCESS_EXPIRED", message: "").shouldRefresh)
        }
        XCTAssertTrue(APIError(status: 401, code: "SESSION_EXPIRED", message: "").expiresSession)
    }
    @MainActor func testDemoContainsAllPhasesAndUniqueActionIDs() throws {
        let schedule = try DemoCoachService.makeSchedules(date: Date())[0]
        XCTAssertEqual(schedule.actionSections.map(\.title), ["热身", "力量循环 · 屏幕组 1", "冷身"])
        let ids = schedule.actionSections.flatMap(\.actions).map(\.id)
        XCTAssertEqual(ids.count, Set(ids).count)
        XCTAssertEqual(schedule.actionCount, 6)
    }
    func testAbsentOptionalScriptIsSafe() throws {
        let data = Data(#"{"id":1,"courseId":2,"courseName":"Empty","beginTime":"09:00"}"#.utf8)
        XCTAssertEqual(try JSONDecoder().decode(CourseSchedule.self, from: data).actionCount, 0)
    }
    func testVideoAliasDoesNotHideMissingVideos() throws {
        let data = Data(#"{"actionId":1,"actionName":"Squat","mediaUrl":"","video":{"src":"https://cdn.example/video.mp4"}}"#.utf8)
        XCTAssertEqual(try JSONDecoder().decode(VideoCard.self, from: data).videoSource, "https://cdn.example/video.mp4")
    }
}

@MainActor final class MemoryCredentials: CredentialStore {
    var value: StoredCredential? = StoredCredential(cookie: "infini-session-coach-web=private-cookie", user: DemoCoachService.user)
    func read() throws -> StoredCredential? { value }
    func save(_ credential: StoredCredential) throws { value = credential }
    func clear() throws { value = nil }
}
@MainActor final class MockTransport: HTTPTransport {
    var requests: [URLRequest] = []
    var replies: [HTTPReply] = []
    func send(_ request: URLRequest) async throws -> HTTPReply {
        requests.append(request)
        guard !replies.isEmpty else { throw URLError(.notConnectedToInternet) }
        return replies.removeFirst()
    }
    func queue(_ json: String, status: Int = 200, headers: [String: String] = [:]) {
        replies.append(HTTPReply(data: Data(json.utf8), status: status, headers: headers))
    }
    func queueUser() throws {
        let data = try JSONEncoder().encode(DemoCoachService.user)
        queue("{\"data\":\(String(decoding: data, as: UTF8.self))}")
    }
}

@MainActor final class APIClientTests: XCTestCase {
    func testRealKeychainRoundTrip() throws {
        let store = KeychainCredentialStore(service: "work.infini.coach.ios.tests.\(UUID().uuidString)")
        defer { try? store.clear() }
        XCTAssertNil(try store.read())
        try store.save(StoredCredential(cookie: "test-cookie", user: DemoCoachService.user))
        XCTAssertEqual(try store.read()?.cookie, "test-cookie")
        try store.save(StoredCredential(cookie: "updated-cookie", user: DemoCoachService.user))
        XCTAssertEqual(try store.read()?.cookie, "updated-cookie")
        try store.clear()
        XCTAssertNil(try store.read())
    }
    private func restored() async throws -> (APIClient, MockTransport, MemoryCredentials) {
        let transport = MockTransport(), credentials = MemoryCredentials()
        let client = APIClient(transport: transport, credentials: credentials)
        try transport.queueUser()
        _ = try await client.restore()
        transport.requests = []
        return (client, transport, credentials)
    }
    func testHeadersAreCentralized() async throws {
        let (client, transport, _) = try await restored()
        transport.queue("{}")
        _ = try await client.bytes("/api/tv/screens")
        let request = try XCTUnwrap(transport.requests.first)
        XCTAssertEqual(request.value(forHTTPHeaderField: "X-Infini-Client"), "coach-web")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Origin"), "https://114.215.185.184")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Cookie"), "infini-session-coach-web=private-cookie")
        XCTAssertNil(request.value(forHTTPHeaderField: "Authorization"))
    }
    func testAccessExpiredRefreshesAndRetriesSameCommandOnce() async throws {
        let (client, transport, _) = try await restored()
        transport.queue(#"{"code":"ACCESS_EXPIRED"}"#, status: 401)
        try transport.queueUser()
        transport.queue("{}")
        _ = try await client.bytes("/api/tv/control", method: "POST", body: ["commandId": "same-command"])
        XCTAssertEqual(transport.requests.count, 3)
        XCTAssertEqual(transport.requests[0].httpBody, transport.requests[2].httpBody)
        XCTAssertTrue(transport.requests[1].url!.path.hasSuffix("/refresh"))
    }
    func test503DoesNotRetryWriteOrLogout() async throws {
        let (client, transport, credentials) = try await restored()
        transport.queue(#"{"message":"Busy"}"#, status: 503)
        do { _ = try await client.bytes("/api/tv/control", method: "POST"); XCTFail("Expected failure") }
        catch { XCTAssertEqual((error as? APIError)?.status, 503) }
        XCTAssertEqual(transport.requests.count, 1)
        XCTAssertNotNil(credentials.value)
    }
    func testSessionExpiredClearsOnlyAppCredential() async throws {
        let (client, transport, credentials) = try await restored()
        transport.queue(#"{"code":"SESSION_EXPIRED"}"#, status: 401)
        do { _ = try await client.bytes("/api/tv/screens"); XCTFail("Expected failure") } catch {}
        XCTAssertNil(credentials.value)
        XCTAssertNil(client.credential)
    }
    func testOfflineRestoreKeepsKeychain() async throws {
        let transport = MockTransport(), credentials = MemoryCredentials()
        let client = APIClient(transport: transport, credentials: credentials)
        do { _ = try await client.restore(); XCTFail("Expected failure") } catch {}
        XCTAssertNotNil(client.credential)
        XCTAssertNotNil(credentials.value)
    }
    func testLogoutFailureDoesNotPretendSuccess() async throws {
        let (client, transport, credentials) = try await restored()
        transport.queue("{}", status: 503)
        do { try await client.logout(); XCTFail("Expected failure") } catch {}
        XCTAssertNotNil(credentials.value)
    }
    func testSuccessfulLogoutClearsCredentials() async throws {
        let (client, transport, credentials) = try await restored()
        transport.queue("{}")
        try await client.logout()
        XCTAssertNil(credentials.value)
    }
    func testControlPayloadMatchesCoachWeb() async throws {
        let (api, transport, _) = try await restored()
        transport.queue("{}")
        let service = LiveCoachService(api: api)
        let schedule = try DemoCoachService.makeSchedules(date: Date())[0]
        try await service.control(.start, schedule: schedule, current: nil, user: DemoCoachService.user)
        let request = try XCTUnwrap(transport.requests.first)
        XCTAssertTrue(request.url!.path.hasSuffix("/start-from-schedule"))
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: request.httpBody!) as? [String: Any])
        XCTAssertEqual(body["startDelayMs"] as? Int, 5000)
        XCTAssertEqual(body["scheduleId"] as? String, "101")
        XCTAssertEqual(body["accountNamespace"] as? String, "demo")
        XCTAssertNotNil(UUID(uuidString: body["commandId"] as! String))
    }
    func testDifferentActiveCourseDoesNotSendCommand() async throws {
        let (api, transport, _) = try await restored()
        let service = LiveCoachService(api: api)
        let schedule = try DemoCoachService.makeSchedules(date: Date())[0]
        let current = PlaybackSession(id: "session", state: "RUNNING", scheduleId: EntityID("other"), courseName: nil)
        do { try await service.control(.preview, schedule: schedule, current: current, user: DemoCoachService.user); XCTFail("Expected conflict") } catch {}
        XCTAssertTrue(transport.requests.isEmpty)
    }
    func testUnknownVenueCannotLoadAllSchedules() async throws {
        let (api, transport, _) = try await restored()
        let user = UserSession(username: "admin", nickname: nil, venueId: nil, venueName: nil, accountNamespace: nil, access_token: "id")
        do { _ = try await LiveCoachService(api: api).schedules(date: Date(), user: user); XCTFail("Expected scope error") } catch {}
        XCTAssertTrue(transport.requests.isEmpty)
    }
    func testModelRejectsDoubleControlAndWaitsTwoSeconds() async throws {
        let model = CoachModel(service: DemoCoachService())
        await model.enterDemo()
        let schedule = try XCTUnwrap(model.schedules.first)
        let clock = ContinuousClock.now
        let first = Task { await model.control(.preview, schedule: schedule) }
        await Task.yield()
        XCTAssertTrue(model.controlsLocked)
        await model.control(.start, schedule: schedule)
        await first.value
        XCTAssertEqual(model.playback?.state, "PREVIEW")
        XCTAssertFalse(model.controlsLocked)
        XCTAssertGreaterThanOrEqual(clock.duration(to: .now), .seconds(2))
    }
}
