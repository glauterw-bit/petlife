import UIKit
import WebKit
import Capacitor

/// Controlador da web com os ajustes nativos que o Capacitor não traz:
/// plugin próprio, gesto de voltar pela borda e texto que segue o tamanho
/// escolhido em Ajustes > Tela e Brilho > Tamanho do Texto (Dynamic Type).
class PetLifeBridgeViewController: CAPBridgeViewController {

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PetLifeNativePlugin())
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        webView?.allowsBackForwardNavigationGestures = true
        installTextScale()
        NotificationCenter.default.addObserver(
            self, selector: #selector(textSizeChanged),
            name: UIContentSizeCategory.didChangeNotification, object: nil
        )
    }

    /// Escala do texto do sistema em relação ao padrão (Grande = 1.0).
    /// Limitada para o layout não quebrar nos tamanhos de acessibilidade.
    private var textScale: CGFloat {
        let s = UIFontMetrics(forTextStyle: .body).scaledValue(for: 17) / 17
        return min(max(s, 0.88), 1.3)
    }

    private func scaleScript(_ s: CGFloat) -> String {
        let pct = String(format: "%.1f", s * 100)
        return "document.documentElement.style.fontSize='\(pct)%';document.documentElement.dataset.textScale='\(String(format: "%.2f", s))';"
    }

    private func installTextScale() {
        guard let controller = webView?.configuration.userContentController else { return }
        let script = WKUserScript(source: scaleScript(textScale), injectionTime: .atDocumentStart, forMainFrameOnly: true)
        controller.addUserScript(script)
    }

    @objc private func textSizeChanged() {
        guard let webView else { return }
        let src = scaleScript(textScale)
        // Troca o script de início (próximas cargas) e aplica já na página aberta.
        let controller = webView.configuration.userContentController
        let others = controller.userScripts.filter { !$0.source.contains("dataset.textScale") }
        controller.removeAllUserScripts()
        others.forEach { controller.addUserScript($0) }
        controller.addUserScript(WKUserScript(source: src, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        webView.evaluateJavaScript(src, completionHandler: nil)
    }
}
