import AppKit
import WebKit

/// The Ribbit notes window: a normal resizable window hosting web/notes over the bridge.
@MainActor
final class NotesWindow: NSObject, WKNavigationDelegate, WKUIDelegate, NSWindowDelegate {
    let bridge: Bridge
    private let window: NSWindow
    private let webView: WKWebView
    private weak var app: AppDelegate?

    init(app: AppDelegate) {
        self.app = app
        bridge = Bridge(app: app)
        let cfg = WKWebViewConfiguration()
        cfg.preferences.setValue(true, forKey: "developerExtrasEnabled")
        cfg.userContentController.add(bridge, name: "ribbit")
        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 960, height: 640), configuration: cfg)
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 960, height: 640), styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView], backing: .buffered, defer: false)
        super.init()
        bridge.webView = webView
        window.title = "Ribbit Notes"
        window.titlebarAppearsTransparent = true
        window.minSize = NSSize(width: 720, height: 480)
        window.isReleasedWhenClosed = false
        window.contentView = webView
        window.delegate = self
        window.setFrameAutosaveName("RibbitNotes")
        webView.navigationDelegate = self
        webView.uiDelegate = self
        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "notes") {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else {
            NSLog("notes/index.html missing from bundle")
        }
    }

    var isVisible: Bool { window.isVisible }
    func show() { NSApp.activate(ignoringOtherApps: true); window.center(); if window.frameAutosaveName.isEmpty == false { window.setFrameUsingName("RibbitNotes") }; window.makeKeyAndOrderFront(nil) }
    func hide() { window.orderOut(nil) }

    // window.prompt() support for the speaker rename stopgap.
    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = NSAlert(); alert.messageText = prompt
        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 240, height: 24)); field.stringValue = defaultText ?? ""
        alert.accessoryView = field; alert.addButton(withTitle: "OK"); alert.addButton(withTitle: "Cancel")
        alert.window.initialFirstResponder = field
        completionHandler(alert.runModal() == .alertFirstButtonReturn ? field.stringValue : nil)
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool { hide(); return false }
}
