import Foundation
import Alamofire

struct HTTPReply { let data: Data; let status: Int; let headers: [String: String] }
@MainActor
protocol HTTPTransport { func send(_ request: URLRequest) async throws -> HTTPReply }

@MainActor
final class AlamofireTransport: HTTPTransport {
    private let session: Session
    init() {
        let config = URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies = false
        config.httpCookieStorage = nil
        config.timeoutIntervalForRequest = 20
        config.timeoutIntervalForResource = 40
        session = Session(configuration: config, redirectHandler: Redirector(behavior: .doNotFollow))
    }
    func send(_ request: URLRequest) async throws -> HTTPReply {
        let response = await session.request(request).serializingData(emptyResponseCodes: [204]).response
        if let error = response.error { throw error }
        guard let http = response.response else { throw URLError(.badServerResponse) }
        return HTTPReply(data: response.data ?? Data(), status: http.statusCode,
                         headers: Dictionary(uniqueKeysWithValues: http.allHeaderFields.map { (String(describing: $0.key), String(describing: $0.value)) }))
    }
}

@MainActor
final class APIClient {
    let configuration: APIConfiguration
    private let transport: any HTTPTransport
    private let credentials: any CredentialStore
    private(set) var credential: StoredCredential?
    private var generation = 0
    private var refreshTask: Task<UserSession, Error>?

    init(configuration: APIConfiguration = APIConfiguration(), transport: any HTTPTransport,
         credentials: any CredentialStore) {
        self.configuration = configuration; self.transport = transport; self.credentials = credentials
    }

    func restore() async throws -> UserSession? {
        credential = try credentials.read()
        guard credential != nil else { return nil }
        return try await refresh()
    }

    func login(username: String, password: String) async throws -> UserSession {
        generation += 1
        let version = generation
        let response = try await send("/api/browser-auth/coach-web/login", method: "POST", body: ["username": username, "password": password])
        try validate(response)
        guard generation == version else { throw staleRequest() }
        let user = try JSONDecoder().decode(Envelope<UserSession>.self, from: response.data).data
        let cookies = HTTPCookie.cookies(withResponseHeaderFields: response.headers, for: configuration.origin)
        guard let cookie = cookies.first(where: { $0.name == "infini-session-coach-web" }), cookie.isSecure else {
            throw APIError(status: 0, code: "COOKIE_MISSING", message: "服务器未返回安全会话，请稍后重试。")
        }
        let next = StoredCredential(cookie: "\(cookie.name)=\(cookie.value)", user: user)
        try credentials.save(next)
        credential = next
        return user
    }

    func refresh() async throws -> UserSession {
        if let refreshTask { return try await refreshTask.value }
        let version = generation
        let task = Task { @MainActor in
            let reply = try await self.send("/api/browser-auth/coach-web/refresh", method: "POST")
            guard self.generation == version else { throw self.staleRequest() }
            try self.validate(reply)
            let user = try JSONDecoder().decode(Envelope<UserSession>.self, from: reply.data).data
            guard let old = self.credential else { throw self.staleRequest() }
            let next = StoredCredential(cookie: old.cookie, user: user)
            try self.credentials.save(next)
            self.credential = next
            return user
        }
        refreshTask = task
        defer { refreshTask = nil }
        do { return try await task.value }
        catch { try expireIfNeeded(error, version: version); throw error }
    }

    func logout() async throws {
        let version = generation
        let reply = try await send("/api/browser-auth/coach-web/logout", method: "POST")
        try validate(reply)
        guard generation == version else { return }
        try credentials.clear()
        generation += 1
        credential = nil
    }

    func request<T: Decodable>(_ path: String, method: String = "GET", query: [String: String] = [:], body: [String: Any]? = nil) async throws -> T {
        let data = try await bytes(path, method: method, query: query, body: body)
        do { return try JSONDecoder().decode(T.self, from: data) }
        catch { throw APIError(status: 0, code: "INVALID_RESPONSE", message: "服务器数据格式有误，请稍后重试。") }
    }

    /// A single retry is permitted only when the server rejected the request before execution.
    func bytes(_ path: String, method: String = "GET", query: [String: String] = [:], body: [String: Any]? = nil) async throws -> Data {
        let version = generation
        let identity = credential?.user.access_token
        do {
            var reply = try await send(path, method: method, query: query, body: body)
            guard generation == version else { throw staleRequest() }
            if apiError(reply)?.shouldRefresh == true {
                _ = try await refresh()
                guard generation == version, identity == credential?.user.access_token else { throw staleRequest() }
                reply = try await send(path, method: method, query: query, body: body)
            }
            guard generation == version else { throw staleRequest() }
            try validate(reply)
            return reply.data
        } catch { try expireIfNeeded(error, version: version); throw error }
    }

    private func send(_ path: String, method: String, query: [String: String] = [:], body: [String: Any]? = nil) async throws -> HTTPReply {
        var request = URLRequest(url: configuration.api(path, query: query))
        request.httpMethod = method
        request.setValue(configuration.origin.absoluteString, forHTTPHeaderField: "Origin")
        request.setValue("coach-web", forHTTPHeaderField: "X-Infini-Client")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let credential {
            request.setValue(credential.cookie, forHTTPHeaderField: "Cookie")
            request.setValue(credential.user.access_token, forHTTPHeaderField: "X-Infini-Session")
        }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        return try await transport.send(request)
    }
    private func validate(_ response: HTTPReply) throws {
        if let error = apiError(response) { throw error }
    }
    private func apiError(_ response: HTTPReply) -> APIError? {
        guard !(200..<300).contains(response.status) else { return nil }
        struct Failure: Decodable { let code: String?; let message: String? }
        let payload = try? JSONDecoder().decode(Failure.self, from: response.data)
        return APIError(status: response.status, code: payload?.code ?? "HTTP_\(response.status)",
                        message: payload?.message ?? "服务暂不可用（\(response.status)），请稍后重试。")
    }
    private func expireIfNeeded(_ error: Error, version: Int) throws {
        if generation == version, (error as? APIError)?.expiresSession == true {
            try credentials.clear(); credential = nil; generation += 1
        }
    }
    private func staleRequest() -> APIError {
        APIError(status: 409, code: "SESSION_CHANGED", message: "登录状态已变化，请重新操作。")
    }
}
