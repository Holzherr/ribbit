import AppKit
import WebKit

/// JSON message bridge between web/notes and the engine. Wire format mirrors web/notes/src/bridge/types.ts.
/// Up:   window.webkit.messageHandlers.ribbit.postMessage({id, type, payload})
/// Down: ribbit.receive({id, ok, payload, error}) for replies, ribbit.receive({type, payload}) for events.
@MainActor
final class Bridge: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?
    private weak var app: AppDelegate?
    private var tickTimer: Timer?

    static let encoder: JSONEncoder = { let e = JSONEncoder(); e.dateEncodingStrategy = .iso8601; return e }()
    static let decoder: JSONDecoder = { let d = JSONDecoder(); d.dateDecodingStrategy = .iso8601; return d }()

    init(app: AppDelegate) { self.app = app; super.init() }

    // MARK: WKScriptMessageHandler
    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let id = body["id"] as? String, let type = body["type"] as? String else { return }
        let payload = body["payload"]
        Task { @MainActor in
            do {
                let reply = try await self.handle(type: type, payload: payload)
                self.emit(["id": id, "ok": true, "payload": reply])
            } catch {
                self.emit(["id": id, "ok": false, "error": error.localizedDescription])
            }
        }
    }

    // MARK: events
    func send<T: Encodable>(event: String, payload: T) {
        guard let data = try? Self.encoder.encode(payload), let json = String(data: data, encoding: .utf8) else { return }
        js("ribbit.receive({type: \(Self.quote(event)), payload: \(json)})")
    }

    private func emit(_ dict: [String: Any]) {
        guard JSONSerialization.isValidJSONObject(dict), let data = try? JSONSerialization.data(withJSONObject: dict), let json = String(data: data, encoding: .utf8) else {
            NSLog("bridge: could not serialise \(dict)")
            return
        }
        js("ribbit.receive(\(json))")
    }

    private func js(_ script: String) { webView?.evaluateJavaScript(script, completionHandler: nil) }

    /// A JSON string literal for `s` (quotes and escapes included).
    private static func quote(_ s: String) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: s, options: .fragmentsAllowed), let q = String(data: data, encoding: .utf8) else { return "\"\"" }
        return q
    }

    // MARK: dispatch
    private func handle(type: String, payload: Any?) async throws -> Any {
        guard let app else { throw BridgeError.gone }
        switch type {
        case "notes.list":
            return try jsonArray(Store.shared.notes.map { var n = $0; n.segments = []; return n })
        case "notes.get":
            return try json(try find(payload))
        case "notes.update":
            var note = try find(payload)
            let patch = (payload as? [String: Any])?["patch"] as? [String: Any] ?? [:]
            if let v = patch["title"] as? String { note.title = v }
            if let v = patch["jots"] as? String { note.jots = v }
            if let v = patch["enhanced"] as? String { note.enhanced = v }
            if let v = patch["template"] as? String { note.template = v }
            if let v = patch["speakerNames"] as? [String: String] { note.speakerNames = v }
            if let v = patch["attendees"] as? [[String: Any]] { note.attendees = v.compactMap { d in (d["name"] as? String).map { Attendee(name: $0, email: d["email"] as? String) } } }
            Store.shared.upsert(note)
            send(event: "note.updated", payload: note)
            return try json(note)
        case "notes.delete":
            Store.shared.delete(try find(payload))
            return "ok"
        case "session.start":
            let p = payload as? [String: Any]
            let meeting = app.meeting
            // MeetingRecorder.start() returns silently when it can't record, leaving currentNoteID on the
            // previous note, so name the reason up front and verify a new recording afterwards.
            if meeting.isRecording { throw BridgeError.message("Can't start: already recording") }
            if meeting.isProcessing { throw BridgeError.message("Can't start: still processing the last note") }
            if meeting.dictationActive() { throw BridgeError.message("Can't start: dictation is active") }
            let previousID = meeting.currentNoteID
            let existingIDs = Set(Store.shared.notes.map(\.id))
            meeting.start()
            guard meeting.isRecording, let id = meeting.currentNoteID, id != previousID, var note = Store.shared.notes.first(where: { $0.id == id }) else {
                // start() stores a new failed note, without recording, when it can't create the audio files.
                let failed = Store.shared.notes.first { !existingIDs.contains($0.id) }
                if let failed { send(event: "note.updated", payload: failed) }
                throw BridgeError.message("Can't start: \(failed?.error ?? "the recorder did not start")")
            }
            if let t = p?["title"] as? String, !t.isEmpty { note.title = t }
            if let e = p?["calendarEventID"] as? String { note.calendarEventID = e }
            Store.shared.upsert(note)
            startTicks()
            return ["noteId": id.uuidString]
        case "session.stop":
            app.meeting.stop()
            stopTicks()
            return "ok"
        case "session.status":
            return ["recording": app.meeting.isRecording, "processing": app.meeting.isProcessing, "noteId": app.meeting.currentNoteID?.uuidString ?? NSNull(), "elapsed": app.meeting.elapsed] as [String: Any]
        case "export.copy":
            let note = try find(payload)
            let what = (payload as? [String: Any])?["what"] as? String ?? "enhanced"
            let text = what == "transcript" ? NoteProcessor.transcriptText(note) : what == "jots" ? note.jots : (note.enhanced.isEmpty ? note.summary : note.enhanced)
            NSPasteboard.general.clearContents(); NSPasteboard.general.setString(text, forType: .string)
            return "ok"
        case "settings.get":
            return settingsDict()
        case "settings.set":
            let p = payload as? [String: Any] ?? [:]
            if let v = p["speechEngine"] as? String { app.selectEngine(v) }
            if let v = p["summaryEngine"] as? String { UserDefaults.standard.set(v, forKey: "summaryEngine") }
            if let v = p["showFrog"] as? Bool { if v { app.panel.show() } else { app.panel.orderOut(nil) } }
            return settingsDict()
        case "window.close":
            app.notesWindow.hide()
            return "ok"
        case "calendar.upcoming", "calendar.authorize", "enhance.run", "chat.ask":
            throw BridgeError.message("\(type) is not implemented yet")
        default:
            NSLog("bridge: unknown command \(type)")
            throw BridgeError.message("Unknown command \(type)")
        }
    }

    private func settingsDict() -> [String: Any] {
        ["speechEngine": UserDefaults.standard.string(forKey: "engine") ?? "apple",
         "summaryEngine": UserDefaults.standard.string(forKey: "summaryEngine") ?? "claude",
         "hasClaudeKey": Summarizer.hasClaudeKey,
         "calendarEnabled": false,
         "callDetection": [String: Bool](),
         "showFrog": app?.panel.isVisible ?? true]
    }

    private func find(_ payload: Any?) throws -> Note {
        guard let s = (payload as? [String: Any])?["id"] as? String, let id = UUID(uuidString: s), let n = Store.shared.notes.first(where: { $0.id == id }) else { throw BridgeError.message("note not found") }
        return n
    }

    // MARK: ticks while recording
    private func startTicks() {
        stopTicks()
        tickTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, let app = self.app, app.meeting.isRecording, let id = app.meeting.currentNoteID else { self?.stopTicks(); return }
                self.emit(["type": "session.tick", "payload": ["noteId": id.uuidString, "elapsed": app.meeting.elapsed, "level": Double(app.recorder.level)] as [String: Any]])
            }
        }
    }
    private func stopTicks() { tickTimer?.invalidate(); tickTimer = nil }

    // MARK: JSON helpers (Encodable -> Foundation object, so it can sit inside the reply dict)
    private func json<T: Encodable>(_ v: T) throws -> Any { try JSONSerialization.jsonObject(with: Self.encoder.encode(v)) }
    private func jsonArray<T: Encodable>(_ v: [T]) throws -> Any { try JSONSerialization.jsonObject(with: Self.encoder.encode(v)) }

    enum BridgeError: LocalizedError {
        case gone, message(String)
        var errorDescription: String? { switch self { case .gone: return "app is gone"; case .message(let m): return m } }
    }
}
