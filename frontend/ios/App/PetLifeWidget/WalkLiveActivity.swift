import ActivityKit
import WidgetKit
import SwiftUI

struct WalkLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WalkActivityAttributes.self) { context in
            WalkLockScreenView(context: context)
                .activityBackgroundTint(Color(.systemBackground))
                .activitySystemActionForegroundColor(Color.plGreen)
                .widgetURL(URL(string: "petlife://walks/active"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Label(context.attributes.petName, systemImage: "pawprint.fill")
                        .font(.headline).foregroundStyle(Color.plGreen).lineLimit(1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    WalkTimer(context: context).font(.title3.weight(.semibold)).monospacedDigit()
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack {
                        Text(distance(context.state.distanceKm, context.attributes.locale))
                            .font(.title2.weight(.bold)).monospacedDigit()
                        Spacer()
                        if context.state.pausedAt != nil {
                            Text(CareLexicon.s("paused", context.attributes.locale)).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            } compactLeading: {
                Image(systemName: "pawprint.fill").foregroundStyle(Color.plGreen)
            } compactTrailing: {
                WalkTimer(context: context).monospacedDigit().frame(maxWidth: 52)
            } minimal: {
                Image(systemName: "pawprint.fill").foregroundStyle(Color.plGreen)
            }
            .widgetURL(URL(string: "petlife://walks/active"))
        }
    }
}

struct WalkTimer: View {
    let context: ActivityViewContext<WalkActivityAttributes>

    var body: some View {
        let start = context.attributes.timerStart(context.state)
        if let paused = context.state.pausedAt {
            Text(timerInterval: start...Date.distantFuture, pauseTime: paused, countsDown: false)
        } else {
            Text(timerInterval: start...Date.distantFuture, countsDown: false)
        }
    }
}

struct WalkLockScreenView: View {
    let context: ActivityViewContext<WalkActivityAttributes>

    var body: some View {
        let loc = context.attributes.locale
        HStack(spacing: 14) {
            Image(systemName: "pawprint.fill")
                .font(.title2)
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(Circle().fill(Color.plGreen))
            VStack(alignment: .leading, spacing: 2) {
                Text(CareLexicon.s("walkWith", loc, name: context.attributes.petName))
                    .font(.subheadline.weight(.semibold)).lineLimit(1)
                Text(context.state.pausedAt != nil ? CareLexicon.s("paused", loc) : CareLexicon.s("walk", loc))
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                WalkTimer(context: context).font(.title3.weight(.bold)).monospacedDigit()
                    .multilineTextAlignment(.trailing)
                Text(distance(context.state.distanceKm, loc)).font(.subheadline).monospacedDigit().foregroundStyle(.secondary)
            }
        }
        .padding(16)
    }
}

/// Mesma unidade da tela do passeio (km), com a vírgula onde o idioma usa.
func distance(_ km: Double, _ locale: String) -> String {
    let s = String(format: "%.2f km", km)
    return CareLexicon.lang(locale) == "en" ? s : s.replacingOccurrences(of: ".", with: ",")
}
