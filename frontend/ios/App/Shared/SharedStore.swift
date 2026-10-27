import Foundation
import Security

/// Troca de dados entre o app e o widget pelo chaveiro compartilhado.
/// Não usamos App Group: o grupo de chaveiro do time basta e não exige
/// cadastro extra no portal da Apple.
enum SharedStore {
    static let accessGroup = "2WND53C953.app.petlife.shared"
    private static let service = "app.petlife.shared"
    private static let account = "widget"

    private static var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: accessGroup,
        ]
    }

    static func write(_ data: Data) {
        let attrs: [String: Any] = [
            kSecValueData as String: data,
            // O widget roda com o aparelho bloqueado (tela de bloqueio).
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        let status = SecItemUpdate(baseQuery as CFDictionary, attrs as CFDictionary)
        if status == errSecItemNotFound {
            var add = baseQuery
            attrs.forEach { add[$0.key] = $0.value }
            SecItemAdd(add as CFDictionary, nil)
        }
    }

    static func read() -> Data? {
        var q = baseQuery
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess else { return nil }
        return out as? Data
    }

    static func clear() {
        SecItemDelete(baseQuery as CFDictionary)
    }
}
