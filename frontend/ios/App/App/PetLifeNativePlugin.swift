import Foundation
import Capacitor
import WidgetKit
#if canImport(ActivityKit)
import ActivityKit
#endif

/// Recursos nativos que a web chama pelo Capacitor (window.Capacitor.Plugins.PetLifeNative):
/// dados do widget de proteção e a Live Activity do passeio.
@objc(PetLifeNativePlugin)
public class PetLifeNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PetLifeNativePlugin"
    public let jsName = "PetLifeNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setWidgetData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearWidgetData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startWalk", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateWalk", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endWalk", returnType: CAPPluginReturnPromise),
    ]

    @objc func setWidgetData(_ call: CAPPluginCall) {
        guard let pets = call.options["pets"] as? [Any] else {
            call.reject("pets ausente")
            return
        }
        let payload: [String: Any] = [
            "pets": pets,
            "locale": call.getString("locale") ?? "pt-BR",
            "updatedMs": Date().timeIntervalSince1970 * 1000,
        ]
        guard JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload),
              (try? JSONDecoder().decode(WidgetPayload.self, from: data)) != nil else {
            call.reject("formato inválido")
            return
        }
        // Só recarrega o widget quando algo mudou (o Início chama isto a cada visita).
        let old = SharedStore.read().flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
        let changed = old == nil
            || !NSDictionary(dictionary: ["p": old?["pets"] ?? [], "l": old?["locale"] ?? ""])
                .isEqual(to: ["p": pets, "l": payload["locale"] ?? ""])
        SharedStore.write(data)
        if changed { WidgetCenter.shared.reloadAllTimelines() }
        call.resolve(["changed": changed])
    }

    @objc func clearWidgetData(_ call: CAPPluginCall) {
        SharedStore.clear()
        WidgetCenter.shared.reloadAllTimelines()
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) { endAllWalks() }
        #endif
        call.resolve()
    }

    // MARK: Live Activity do passeio

    @objc func startWalk(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            guard ActivityAuthorizationInfo().areActivitiesEnabled else {
                call.resolve(["started": false, "reason": "disabled"])
                return
            }
            endAllWalks()
            let startMs = call.getDouble("startedAt") ?? Date().timeIntervalSince1970 * 1000
            let attrs = WalkActivityAttributes(
                petName: call.getString("petName") ?? "",
                startedAt: Date(timeIntervalSince1970: startMs / 1000),
                locale: call.getString("locale") ?? "pt-BR"
            )
            let state = WalkActivityAttributes.ContentState(
                distanceKm: call.getDouble("distanceKm") ?? 0,
                pausedSeconds: call.getDouble("pausedSeconds") ?? 0,
                pausedAt: nil
            )
            do {
                _ = try Activity.request(attributes: attrs, content: .init(state: state, staleDate: nil))
                call.resolve(["started": true])
            } catch {
                call.resolve(["started": false, "reason": error.localizedDescription])
            }
            return
        }
        #endif
        call.resolve(["started": false, "reason": "unsupported"])
    }

    @objc func updateWalk(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            let state = walkState(call)
            Task {
                for a in Activity<WalkActivityAttributes>.activities {
                    await a.update(.init(state: state, staleDate: nil))
                }
                call.resolve()
            }
            return
        }
        #endif
        call.resolve()
    }

    @objc func endWalk(_ call: CAPPluginCall) {
        #if canImport(ActivityKit)
        if #available(iOS 16.2, *) {
            let state = walkState(call)
            Task {
                for a in Activity<WalkActivityAttributes>.activities {
                    // Fica alguns minutos na tela de bloqueio com o resumo final.
                    await a.end(.init(state: state, staleDate: nil), dismissalPolicy: .after(Date().addingTimeInterval(15 * 60)))
                }
                call.resolve()
            }
            return
        }
        #endif
        call.resolve()
    }

    #if canImport(ActivityKit)
    @available(iOS 16.2, *)
    private func walkState(_ call: CAPPluginCall) -> WalkActivityAttributes.ContentState {
        let pausedAt = call.getDouble("pausedAt").map { Date(timeIntervalSince1970: $0 / 1000) }
        return .init(
            distanceKm: call.getDouble("distanceKm") ?? 0,
            pausedSeconds: call.getDouble("pausedSeconds") ?? 0,
            pausedAt: pausedAt
        )
    }

    @available(iOS 16.2, *)
    private func endAllWalks() {
        for a in Activity<WalkActivityAttributes>.activities {
            Task { await a.end(nil, dismissalPolicy: .immediate) }
        }
    }
    #endif
}
