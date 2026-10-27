import WidgetKit
import SwiftUI

@main
struct PetLifeWidgetBundle: WidgetBundle {
    var body: some Widget {
        ProtectionWidget()
        WalkLiveActivity()
    }
}
