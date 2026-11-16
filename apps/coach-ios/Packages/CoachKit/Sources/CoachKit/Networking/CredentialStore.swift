import Foundation
import Security

struct StoredCredential: Codable {
    let cookie: String
    let user: UserSession
}

@MainActor
protocol CredentialStore {
    func read() throws -> StoredCredential?
    func save(_ credential: StoredCredential) throws
    func clear() throws
}

/// Only the app's Keychain contains the opaque cookie; UserDefaults never stores credentials.
@MainActor
final class KeychainCredentialStore: CredentialStore {
    private let serviceName: String
    init(service: String = "work.infini.coach.ios.session") { serviceName = service }
    private var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: serviceName,
         kSecAttrAccount as String: "production-coach"]
    }
    func read() throws -> StoredCredential? {
        var q = query
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(q as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = result as? Data else { throw keychainError(status) }
        return try JSONDecoder().decode(StoredCredential.self, from: data)
    }
    func save(_ credential: StoredCredential) throws {
        let data = try JSONEncoder().encode(credential)
        let status = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecSuccess { return }
        guard status == errSecItemNotFound else { throw keychainError(status) }
        var q = query
        q[kSecValueData as String] = data
        q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let added = SecItemAdd(q as CFDictionary, nil)
        guard added == errSecSuccess else { throw keychainError(added) }
    }
    func clear() throws {
        let status = SecItemDelete(query as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { throw keychainError(status) }
    }
    private func keychainError(_ status: OSStatus) -> APIError {
        APIError(status: 0, code: "KEYCHAIN", message: "无法安全保存登录信息（\(status)）。")
    }
}
