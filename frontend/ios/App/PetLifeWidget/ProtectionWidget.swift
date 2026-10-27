import WidgetKit
import SwiftUI

// Cores do app (tailwind primary/amber/red) — o estado sempre vem com texto, nunca só cor.
extension Color {
    static let plGreen = Color(red: 16 / 255, green: 185 / 255, blue: 129 / 255)
    static let plAmber = Color(red: 245 / 255, green: 158 / 255, blue: 11 / 255)
    static let plRed = Color(red: 220 / 255, green: 38 / 255, blue: 38 / 255)
    static let plGray = Color.gray.opacity(0.35)

    static func care(_ state: String) -> Color {
        switch state {
        case "ok": return .plGreen
        case "soon": return .plAmber
        case "overdue": return .plRed
        default: return .plGray
        }
    }
}

struct ProtectionEntry: TimelineEntry {
    let date: Date
    let payload: WidgetPayload?
}

struct ProtectionProvider: TimelineProvider {
    func placeholder(in context: Context) -> ProtectionEntry {
        ProtectionEntry(date: Date(), payload: .sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (ProtectionEntry) -> Void) {
        completion(ProtectionEntry(date: Date(), payload: WidgetPayload.load() ?? (context.isPreview ? .sample : nil)))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ProtectionEntry>) -> Void) {
        let payload = WidgetPayload.load()
        let now = Date()
        let cal = Calendar.current
        // Uma entrada por dia (os textos "Vence em N dias" mudam à meia-noite).
        var entries: [ProtectionEntry] = []
        for i in 0..<7 {
            let day = i == 0 ? now : cal.startOfDay(for: cal.date(byAdding: .day, value: i, to: now) ?? now)
            entries.append(ProtectionEntry(date: day, payload: payload))
        }
        completion(Timeline(entries: entries, policy: .atEnd))
    }
}

/// Anel em três partes, como no Início do app.
struct CareRing: View {
    let pet: WidgetPet
    let date: Date
    var lineWidth: CGFloat = 7

    var body: some View {
        ZStack {
            ForEach(Array(pet.items.prefix(3).enumerated()), id: \.offset) { idx, item in
                Circle()
                    .trim(from: CGFloat(idx) / 3 + 0.02, to: CGFloat(idx + 1) / 3 - 0.02)
                    .stroke(Color.care(item.state(at: date)), style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                    .rotationEffect(.degrees(-90))
            }
            Text("\(pet.okCount(at: date))/3")
                .font(.system(size: lineWidth * 2.1, weight: .bold, design: .rounded))
                .monospacedDigit()
        }
    }
}

struct PetRow: View {
    let pet: WidgetPet
    let date: Date
    let locale: String

    var body: some View {
        let next = pet.next(at: date)
        HStack(spacing: 10) {
            CareRing(pet: pet, date: date, lineWidth: 5).frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 1) {
                Text(pet.name).font(.subheadline.weight(.semibold)).lineLimit(1)
                Text(rowText(next))
                    .font(.caption)
                    .foregroundStyle(next == nil ? Color.secondary : Color.care(pet.worst(at: date)))
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
    }

    private func rowText(_ next: WidgetCareItem?) -> String {
        guard let next else {
            return pet.worst(at: date) == "never" ? CareLexicon.s("never", locale) : CareLexicon.s("allOk", locale)
        }
        let what = next.title ?? CareLexicon.s(next.kind, locale)
        return "\(what) · \(CareLexicon.label(next, locale, now: date))"
    }
}

struct ProtectionWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: ProtectionEntry

    var body: some View {
        content
            .containerBackground(for: .widget) { Color(.systemBackground) }
            .widgetURL(URL(string: "petlife://dashboard"))
    }

    @ViewBuilder private var content: some View {
        let locale = entry.payload?.locale
        if let pets = entry.payload?.pets, let first = pets.first {
            switch family {
            case .accessoryCircular:
                Gauge(value: Double(first.okCount(at: entry.date)), in: 0...3) {
                    Image(systemName: "pawprint.fill")
                } currentValueLabel: {
                    Text("\(first.okCount(at: entry.date))/3")
                }
                .gaugeStyle(.accessoryCircularCapacity)
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 1) {
                    Label(first.name, systemImage: "pawprint.fill").font(.headline).lineLimit(1)
                    Text(statusText(first, locale)).font(.caption).lineLimit(2)
                }
            case .accessoryInline:
                Text("\(first.name): \(statusText(first, locale))")
            case .systemMedium, .systemLarge:
                VStack(alignment: .leading, spacing: 8) {
                    header(locale)
                    ForEach(pets.prefix(family == .systemLarge ? 6 : 3)) { pet in
                        PetRow(pet: pet, date: entry.date, locale: locale ?? "pt-BR")
                    }
                    Spacer(minLength: 0)
                }
            default:
                VStack(alignment: .leading, spacing: 6) {
                    CareRing(pet: first, date: entry.date).frame(width: 62, height: 62)
                    Spacer(minLength: 0)
                    Text(first.name).font(.headline).lineLimit(1)
                    Text(statusText(first, locale))
                        .font(.caption.weight(.medium))
                        .foregroundStyle(first.next(at: entry.date) == nil ? Color.secondary : Color.care(first.worst(at: entry.date)))
                        .lineLimit(2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        } else {
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: "pawprint.fill").font(.title2).foregroundStyle(Color.plGreen)
                Spacer(minLength: 0)
                Text(CareLexicon.s("empty", locale)).font(.caption).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func header(_ locale: String?) -> some View {
        HStack(spacing: 6) {
            Image(systemName: "pawprint.fill").foregroundStyle(Color.plGreen)
            Text("PetLife").font(.caption.weight(.bold)).foregroundStyle(.secondary)
        }
    }

    private func statusText(_ pet: WidgetPet, _ locale: String?) -> String {
        guard let next = pet.next(at: entry.date) else {
            return pet.worst(at: entry.date) == "never" ? CareLexicon.s("never", locale) : CareLexicon.s("allOk", locale)
        }
        let what = next.title ?? CareLexicon.s(next.kind, locale)
        return "\(what) · \(CareLexicon.label(next, locale, now: entry.date))"
    }
}

struct ProtectionWidget: Widget {
    let kind = "PetLifeProtection"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ProtectionProvider()) { entry in
            ProtectionWidgetView(entry: entry)
        }
        .configurationDisplayName(CareLexicon.s("widgetName", nil))
        .description(CareLexicon.s("widgetDesc", nil))
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

extension WidgetPayload {
    static var sample: WidgetPayload {
        let now = Date().timeIntervalSince1970 * 1000
        let day = 86_400_000.0
        return WidgetPayload(
            pets: [
                WidgetPet(id: 1, name: "Thor", items: [
                    WidgetCareItem(kind: "vaccines", state: "ok", dueMs: now + 200 * day, title: nil),
                    WidgetCareItem(kind: "vermifugo", state: "soon", dueMs: now + 5 * day, title: nil),
                    WidgetCareItem(kind: "antipulgas", state: "ok", dueMs: now + 60 * day, title: nil),
                ]),
            ],
            locale: Locale.preferredLanguages.first ?? "pt-BR",
            updatedMs: now
        )
    }
}
