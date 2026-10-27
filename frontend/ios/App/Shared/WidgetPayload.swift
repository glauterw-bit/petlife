import Foundation

/// O que o app manda para o widget: um resumo por pet, já na ordem do app
/// (o mais urgente primeiro). As datas vão em milissegundos (Date.now() do JS).
struct WidgetCareItem: Codable, Hashable {
    let kind: String          // vaccines | vermifugo | antipulgas
    let state: String         // ok | soon | overdue | never
    let dueMs: Double?
    let title: String?        // nome da vacina, quando houver

    var dueDate: Date? { dueMs.map { Date(timeIntervalSince1970: $0 / 1000) } }

    /// O estado recalculado na hora, para o widget não ficar "Em dia" depois
    /// que a data passou sem o app ser aberto.
    func state(at now: Date) -> String {
        guard state != "never", let due = dueDate else { return state }
        let days = CareLexicon.daysBetween(now, due)
        if days < 0 { return "overdue" }
        if days <= 30 { return "soon" }
        return "ok"
    }
}

struct WidgetPet: Codable, Hashable, Identifiable {
    let id: Int
    let name: String
    let items: [WidgetCareItem]

    func worst(at now: Date) -> String {
        let order = ["overdue": 3, "soon": 2, "never": 1, "ok": 0]
        return items.map { $0.state(at: now) }.max { (order[$0] ?? 0) < (order[$1] ?? 0) } ?? "never"
    }

    /// O item mais urgente entre atrasado e vence em breve.
    func next(at now: Date) -> WidgetCareItem? {
        items
            .filter { ["overdue", "soon"].contains($0.state(at: now)) && $0.dueDate != nil }
            .min { ($0.dueDate ?? .distantFuture) < ($1.dueDate ?? .distantFuture) }
    }

    func okCount(at now: Date) -> Int { items.filter { $0.state(at: now) == "ok" }.count }
}

struct WidgetPayload: Codable {
    let pets: [WidgetPet]
    let locale: String
    let updatedMs: Double

    static func load() -> WidgetPayload? {
        guard let data = SharedStore.read() else { return nil }
        return try? JSONDecoder().decode(WidgetPayload.self, from: data)
    }
}

/// O mesmo léxico do app (ui.care.* em lib/i18n), para o widget não contradizer a tela.
enum CareLexicon {
    static func daysBetween(_ from: Date, _ to: Date) -> Int {
        let cal = Calendar.current
        return cal.dateComponents([.day], from: cal.startOfDay(for: from), to: cal.startOfDay(for: to)).day ?? 0
    }

    private static let table: [String: [String: String]] = [
        "pt": [
            "protected": "Em dia", "dueIn": "Vence em {n} dias", "dueToday": "Vence hoje",
            "overdueBy": "Venceu há {n} dias", "overdueOne": "Venceu ontem", "dueInOne": "Vence amanhã",
            "never": "Sem registro", "vaccines": "Vacinas", "vermifugo": "Vermífugo", "antipulgas": "Antipulgas",
            "empty": "Abra o PetLife para ver a proteção dos seus pets.", "widgetName": "Proteção do pet",
            "widgetDesc": "Vacinas, vermífugo e antipulgas de um relance.", "allOk": "Tudo em dia",
            "walk": "Passeio", "paused": "Pausado", "walkWith": "Passeio com {name}",
        ],
        "en": [
            "protected": "Up to date", "dueIn": "Due in {n} days", "dueToday": "Due today",
            "overdueBy": "Overdue by {n} days", "overdueOne": "Overdue by 1 day", "dueInOne": "Due tomorrow",
            "never": "No record", "vaccines": "Vaccines", "vermifugo": "Dewormer", "antipulgas": "Flea & tick",
            "empty": "Open PetLife to see your pets' protection.", "widgetName": "Pet protection",
            "widgetDesc": "Vaccines, dewormer and flea & tick at a glance.", "allOk": "All up to date",
            "walk": "Walk", "paused": "Paused", "walkWith": "Walk with {name}",
        ],
        "es": [
            "protected": "Al día", "dueIn": "Vence en {n} días", "dueToday": "Vence hoy",
            "overdueBy": "Venció hace {n} días", "overdueOne": "Venció ayer", "dueInOne": "Vence mañana",
            "never": "Sin registro", "vaccines": "Vacunas", "vermifugo": "Desparasitante", "antipulgas": "Antipulgas",
            "empty": "Abre PetLife para ver la protección de tus mascotas.", "widgetName": "Protección de la mascota",
            "widgetDesc": "Vacunas, desparasitante y antipulgas de un vistazo.", "allOk": "Todo al día",
            "walk": "Paseo", "paused": "En pausa", "walkWith": "Paseo con {name}",
        ],
    ]

    static func lang(_ locale: String?) -> String {
        let l = (locale ?? Locale.preferredLanguages.first ?? "pt").lowercased()
        if l.hasPrefix("en") { return "en" }
        if l.hasPrefix("es") { return "es" }
        return "pt"
    }

    static func s(_ key: String, _ locale: String?, n: Int? = nil, name: String? = nil) -> String {
        var v = table[lang(locale)]?[key] ?? table["pt"]?[key] ?? key
        if let n { v = v.replacingOccurrences(of: "{n}", with: String(n)) }
        if let name { v = v.replacingOccurrences(of: "{name}", with: name) }
        return v
    }

    /// Igual a careStateLabel do app.
    static func label(_ item: WidgetCareItem?, _ locale: String?, now: Date) -> String {
        guard let item else { return s("protected", locale) }
        let st = item.state(at: now)
        if st == "never" { return s("never", locale) }
        guard let due = item.dueDate else { return s("protected", locale) }
        let d = daysBetween(now, due)
        if d < 0 { return -d <= 1 ? s("overdueOne", locale) : s("overdueBy", locale, n: -d) }
        if st == "soon" {
            if d == 0 { return s("dueToday", locale) }
            if d == 1 { return s("dueInOne", locale) }
            return s("dueIn", locale, n: d)
        }
        return s("protected", locale)
    }
}
