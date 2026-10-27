import Foundation
#if canImport(ActivityKit)
import ActivityKit

/// Live Activity do passeio: tempo corre sozinho (Text(timerInterval:)),
/// distância é atualizada pelo app enquanto o passeio está aberto.
@available(iOS 16.1, *)
struct WalkActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var distanceKm: Double
        /// Segundos parados até agora, para o cronômetro descontar a pausa.
        var pausedSeconds: Double
        /// Quando o passeio está pausado, o instante da pausa (o cronômetro congela).
        var pausedAt: Date?
    }

    var petName: String
    var startedAt: Date
    var locale: String

    /// Início efetivo do cronômetro, já descontadas as pausas.
    func timerStart(_ state: ContentState) -> Date {
        startedAt.addingTimeInterval(state.pausedSeconds)
    }
}
#endif
