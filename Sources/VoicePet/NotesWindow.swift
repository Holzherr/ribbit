import AppKit
import WebKit

/// The Ribbit notes window: a normal resizable window hosting web/notes over the bridge.
@MainActor
final class NotesWindow: NSObject, WKNavigationDelegate, WKUIDelegate, NSWindowDelegate {
    let bridge: Bridge
    private let window: NSWindow
    private let webView: WKWebView
    private weak var app: AppDelegate?
    private var pageLoaded = false
    private var afterPageLoad: [() -> Void] = []

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

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        pageLoaded = true
        let pending = afterPageLoad; afterPageLoad = []
        pending.forEach { $0() }
    }
}

// MARK: - Debug: --bridge-selftest
// Only reached from AppDelegate when the --bridge-selftest flag is present. Drives real round trips
// through window.webkit.messageHandlers.ribbit and prints one `SELFTEST ok|fail <name>` line per check.
extension NotesWindow {
    func runSelfTest(completion: @escaping (Bool) -> Void) {
        guard pageLoaded else { afterPageLoad.append { [weak self] in self?.runSelfTest(completion: completion) }; return }
        webView.callAsyncJavaScript(Self.selfTestJS, arguments: [:], in: nil, in: .page) { result in
            switch result {
            case .success(let value):
                let r = value as? [String: Any]
                (r?["lines"] as? [String] ?? []).forEach { print($0) }
                completion(r?["ok"] as? Bool ?? false)
            case .failure(let error):
                print("SELFTEST fail script: \((error as NSError).userInfo["WKJavaScriptExceptionMessage"] ?? error.localizedDescription)")
                completion(false)
            }
        }
    }

    private static let selfTestJS = """
    const lines = []; let ok = true;
    const pass = name => lines.push('SELFTEST ok ' + name);
    const fail = (name, detail) => { ok = false; lines.push('SELFTEST fail ' + name + ': ' + detail); };
    const waitStart = Date.now();
    while (!window.ribbit && Date.now() - waitStart < 10000) await new Promise(r => setTimeout(r, 50));
    if (!window.ribbit) return { ok: false, lines: ['SELFTEST fail page: window.ribbit never appeared (readyState ' + document.readyState + ')'] };
    lines.push('SELFTEST info window.ribbit ready after ' + (Date.now() - waitStart) + ' ms');
    const pending = new Map(); let seq = 0;
    const original = window.ribbit.receive;
    window.ribbit.receive = m => {
      const p = m && typeof m.id === 'string' ? pending.get(m.id) : undefined;
      if (p) { pending.delete(m.id); p(m); }
      original(m);
    };
    const call = (type, payload) => new Promise((resolve, reject) => {
      const id = 'selftest-' + (++seq);
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('no reply to ' + type)); }, 5000);
      pending.set(id, m => { clearTimeout(timer); resolve(m); });
      window.webkit.messageHandlers.ribbit.postMessage({ id, type, payload });
    });
    const check = async (name, fn) => { try { const d = await fn(); d === true ? pass(name) : fail(name, d); } catch (e) { fail(name, e.message); } };
    let notes = [];
    let settings = null;
    try {
      await check('notes.list', async () => {
        const r = await call('notes.list');
        if (!r.ok) return 'error ' + r.error;
        notes = r.payload;
        if (!Array.isArray(notes) || notes.length < 2) return 'expected >= 2 notes, got ' + JSON.stringify(notes).slice(0, 200);
        const bad = notes.find(n => !Array.isArray(n.segments) || n.segments.length !== 0);
        return bad ? 'note ' + bad.id + ' has segments ' + JSON.stringify(bad.segments).slice(0, 200) : true;
      });
      const first = notes[0];
      await check('notes.get', async () => {
        if (!first) return 'no note to get';
        const r = await call('notes.get', { id: first.id });
        if (!r.ok) return 'error ' + r.error;
        const n = r.payload;
        if (n.id !== first.id) return 'id ' + n.id + ' != ' + first.id;
        if (typeof n.title !== 'string' || !n.title) return 'empty title';
        return Array.isArray(n.segments) ? true : 'segments is not an array';
      });
      await check('notes.update', async () => {
        if (!first) return 'no note to update';
        const renamed = first.title + ' (selftest)';
        const r1 = await call('notes.update', { id: first.id, patch: { title: renamed } });
        if (!r1.ok || r1.payload.title !== renamed) return 'rename returned ' + JSON.stringify(r1).slice(0, 200);
        const r2 = await call('notes.update', { id: first.id, patch: { title: first.title } });
        return r2.ok && r2.payload.title === first.title ? true : 'restore returned ' + JSON.stringify(r2).slice(0, 200);
      });
      await check('settings.get', async () => {
        const r = await call('settings.get');
        if (!r.ok) return 'error ' + r.error;
        settings = r.payload;
        return typeof settings.speechEngine === 'string' && typeof settings.showFrog === 'boolean' ? true : 'got ' + JSON.stringify(settings);
      });
      await check('settings.set', async () => {
        if (!settings) return 'no settings to set';
        const r = await call('settings.set', { summaryEngine: settings.summaryEngine });
        if (!r.ok) return 'error ' + r.error;
        return r.payload.summaryEngine === settings.summaryEngine ? true : 'summaryEngine ' + r.payload.summaryEngine + ' != ' + settings.summaryEngine;
      });
      await check('session.status', async () => {
        const r = await call('session.status');
        if (!r.ok) return 'error ' + r.error;
        const s = r.payload;
        if (s.recording !== false) return 'expected recording:false, got ' + JSON.stringify(s);
        return typeof s.elapsed === 'number' ? true : 'elapsed is not a number: ' + JSON.stringify(s);
      });
      await check('unknown command', async () => {
        const r = await call('nope.nope');
        return r.ok === false ? true : 'expected ok:false, got ' + JSON.stringify(r);
      });
      await check('note.deleted event accepted', async () => {
        window.ribbit.receive({ type: 'note.deleted', payload: { id: 'nope' } });
        return true;
      });
      await new Promise(r => setTimeout(r, 1500));
      await check('sidebar renders bridge data', async () => {
        if (!first) return 'no note title to look for';
        return document.body.innerText.includes(first.title) ? true : 'body text lacks "' + first.title + '": ' + document.body.innerText.slice(0, 200);
      });
    } finally {
      window.ribbit.receive = original;
    }
    return { ok, lines };
    """
}
