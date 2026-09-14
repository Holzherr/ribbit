import AppKit
import AVFoundation
import ServiceManagement
import Speech
import SwiftUI

// MARK: - palette
extension Color {
    static let petBG = Color(red: 1.00, green: 0.953, blue: 0.973)
    static let petAccent = Color(red: 1.00, green: 0.498, blue: 0.690)
    static let petAccentSoft = Color(red: 1.00, green: 0.82, blue: 0.90)
    static let petInk = Color(red: 0.227, green: 0.145, blue: 0.251)
    static let petMuted = Color(red: 0.56, green: 0.44, blue: 0.54)
    static func speaker(_ id: String) -> Color {
        switch id {
        case "me": return .petAccent
        case "s1": return Color(red: 0.50, green: 0.72, blue: 1.00)
        case "s2": return Color(red: 0.66, green: 0.55, blue: 1.00)
        case "s3": return Color(red: 1.00, green: 0.72, blue: 0.42)
        default: return Color(red: 0.42, green: 0.85, blue: 0.78)
        }
    }
}

struct Card: ViewModifier {
    func body(content: Content) -> some View {
        content.padding(16)
            .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(.white))
            .shadow(color: Color.petAccent.opacity(0.10), radius: 12, y: 5)
    }
}
extension View { func card() -> some View { modifier(Card()) } }

struct Pill: ButtonStyle {
    var filled = true
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: .semibold, design: .rounded))
            .padding(.horizontal, 14).padding(.vertical, 8)
            .background(Capsule().fill(filled ? Color.petAccent : Color.petAccentSoft.opacity(0.6)))
            .foregroundStyle(filled ? .white : Color.petInk)
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.spring(duration: 0.25), value: configuration.isPressed)
    }
}

struct SectionTitle: View {
    var text: String
    var body: some View {
        Text(text.uppercased()).font(.system(size: 10.5, weight: .bold, design: .rounded)).tracking(1.2).foregroundStyle(Color.petMuted)
    }
}

// MARK: - window
final class HubPanel: NSPanel {
    var onCancel: (() -> Void)?
    override var canBecomeKey: Bool { true }
    override func cancelOperation(_ sender: Any?) { onCancel?() }
}

@MainActor
final class HubController {
    private weak var app: AppDelegate?
    private let panel: HubPanel
    static let size = NSSize(width: 460, height: 620)

    init(app: AppDelegate) {
        self.app = app
        panel = HubPanel(contentRect: NSRect(origin: .zero, size: Self.size),
                         styleMask: [.borderless, .nonactivatingPanel],
                         backing: .buffered, defer: false)
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.isMovableByWindowBackground = true
        panel.level = .floating
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.animationBehavior = .utilityWindow
        let root = HubView(onEngineChange: { [weak app] id in app?.selectEngine(id) }, onOpenNotes: { [weak app] in app?.notesWindow.show() }, onClose: { [weak self] in self?.hide() })
            .environmentObject(Store.shared)
            .environmentObject(app.meeting)
        let host = NSHostingView(rootView: root)
        host.wantsLayer = true
        host.layer?.cornerRadius = 24
        host.layer?.masksToBounds = true
        panel.contentView = host
        panel.onCancel = { [weak self] in self?.hide() }
        // click anywhere outside: close, like a popover. Ignore our own child windows (rename popover).
        NotificationCenter.default.addObserver(forName: NSWindow.didResignKeyNotification, object: panel, queue: .main) { [weak self] _ in
            DispatchQueue.main.async {
                guard let self, self.panel.isVisible else { return }
                if let k = NSApp.keyWindow, k === self.panel || k.parent === self.panel { return }
                if self.panel.childWindows?.contains(where: { $0.isKeyWindow }) == true { return }
                self.hide()
            }
        }
    }

    func toggle() {
        if panel.isVisible && panel.isKeyWindow { hide(); return }
        show()
    }

    var isVisible: Bool { panel.isVisible }

    func hide() { panel.orderOut(nil) }

    func show() {
        guard let app else { return }
        let pet = app.panel.frame
        var origin = NSPoint(x: pet.minX - Self.size.width - 8, y: pet.minY)
        if let screen = app.panel.screen ?? NSScreen.main {
            let f = screen.visibleFrame
            if origin.x < f.minX { origin.x = pet.maxX + 8 }
            origin.y = max(f.minY, min(origin.y, f.maxY - Self.size.height))
            origin.x = max(f.minX, min(origin.x, f.maxX - Self.size.width))
        }
        panel.setFrameOrigin(origin)
        panel.makeKeyAndOrderFront(nil)
        panel.makeFirstResponder(nil)
        NSLog("HUBFRAME \(NSStringFromRect(panel.frame))")
    }
}

// MARK: - root
struct HubView: View {
    var onEngineChange: (String) -> Void
    var onOpenNotes: () -> Void
    var onClose: () -> Void
    @State private var tab = ["notes": 0, "detail": 0, "words": 1, "mind": 2, "me": 3][ProcessInfo.processInfo.environment["VOICEPET_DEMO_TAB"] ?? "notes"] ?? 0
    @Namespace private var ns

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                tabs
                Spacer(minLength: 0)
                Button(action: onClose) {
                    Image(systemName: "xmark").font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.petMuted)
                        .frame(width: 30, height: 30)
                        .background(Circle().fill(Color.petAccentSoft.opacity(0.45)))
                }
                .buttonStyle(.plain).help("Close (Esc)")
            }
            .padding(.horizontal, 16).padding(.top, 16).padding(.bottom, 6)
            Group {
                switch tab {
                case 0: NotesLaunchView(onOpen: onOpenNotes)
                case 1: WordsView()
                case 2: MindView()
                default: MeView(onEngineChange: onEngineChange)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(width: HubController.size.width, height: HubController.size.height)
        .background(Color.petBG)
        .foregroundStyle(Color.petInk)
        .font(.system(size: 13, design: .rounded))
    }

    var tabs: some View {
        HStack(spacing: 2) {
            ForEach(Array(["Notes", "Words", "Mind", "Me"].enumerated()), id: \.offset) { i, name in
                Button {
                    withAnimation(.spring(duration: 0.35, bounce: 0.25)) { tab = i }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: ["note.text", "textformat.abc", "brain", "sparkles"][i]).font(.system(size: 12, weight: .bold))
                        Text(name)
                    }
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .padding(.horizontal, 11).padding(.vertical, 8)
                    .foregroundStyle(tab == i ? .white : Color.petInk)
                    .background {
                        if tab == i { Capsule().fill(Color.petAccent).matchedGeometryEffect(id: "pill", in: ns) }
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(Capsule().fill(Color.petAccentSoft.opacity(0.45)))
    }
}

// MARK: - Notes
struct NotesLaunchView: View {
    var onOpen: () -> Void
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "note.text").font(.system(size: 28, weight: .bold)).foregroundStyle(Color.petAccent)
            Text("Notes live in their own window now.").font(.system(size: 14, weight: .semibold, design: .rounded))
            Button("Open Ribbit notes") { onOpen() }.buttonStyle(Pill(filled: true))
        }.frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Words
struct WordsView: View {
    @EnvironmentObject var store: Store
    @State private var newWord = ""
    @State private var heard = ""
    @State private var meant = ""
    @State private var fixingID: UUID?
    @State private var fixText = ""
    @State private var copiedID: UUID?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 10) {
                    SectionTitle(text: "Teach me a word")
                    HStack {
                        TextField("A name, a product, an acronym…", text: $newWord)
                            .textFieldStyle(.plain).padding(10)
                            .background(RoundedRectangle(cornerRadius: 12).fill(Color.petBG))
                            .onSubmit { store.addWord(newWord); newWord = "" }
                        Button { store.addWord(newWord); newWord = "" } label: { Image(systemName: "plus").font(.system(size: 13, weight: .bold)) }
                            .buttonStyle(Pill())
                    }
                    if store.vocabulary.words.isEmpty {
                        Text("Nothing yet. I'll also suggest names I keep hearing.").font(.system(size: 11.5, design: .rounded)).foregroundStyle(Color.petMuted)
                    } else {
                        Flow(spacing: 6) {
                            ForEach(store.vocabulary.words, id: \.self) { w in
                                Chip(text: w, color: .petAccent) { store.removeWord(w) }
                            }
                        }
                    }
                }.card()

                if !store.suggestions.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        SectionTitle(text: "I keep hearing these")
                        Flow(spacing: 6) {
                            ForEach(store.suggestions, id: \.self) { w in
                                HStack(spacing: 4) {
                                    Button { store.addWord(w) } label: {
                                        HStack(spacing: 4) { Image(systemName: "plus").font(.system(size: 9, weight: .bold)); Text(w) }
                                    }.buttonStyle(Pill(filled: false))
                                    Button { store.ignoreSuggestion(w) } label: { Image(systemName: "xmark").font(.system(size: 9, weight: .bold)).foregroundStyle(Color.petMuted) }.buttonStyle(.plain)
                                }
                            }
                        }
                    }.card()
                }

                VStack(alignment: .leading, spacing: 10) {
                    SectionTitle(text: "When I say… write…")
                    HStack(spacing: 8) {
                        TextField("Ana", text: $heard).textFieldStyle(.plain).padding(10).background(RoundedRectangle(cornerRadius: 12).fill(Color.petBG))
                        Image(systemName: "arrow.right").foregroundStyle(Color.petMuted)
                        TextField("Anna", text: $meant).textFieldStyle(.plain).padding(10).background(RoundedRectangle(cornerRadius: 12).fill(Color.petBG))
                            .onSubmit { store.addReplacement(heard: heard, meant: meant); heard = ""; meant = "" }
                        Button { store.addReplacement(heard: heard, meant: meant); heard = ""; meant = "" } label: { Image(systemName: "plus").font(.system(size: 13, weight: .bold)) }.buttonStyle(Pill())
                    }
                    ForEach(store.vocabulary.replacements) { r in
                        HStack {
                            Text(r.heard).foregroundStyle(Color.petMuted)
                            Image(systemName: "arrow.right").font(.system(size: 10)).foregroundStyle(Color.petMuted)
                            Text(r.meant).fontWeight(.semibold)
                            Spacer()
                            Button { store.removeReplacement(r) } label: { Image(systemName: "xmark").font(.system(size: 10, weight: .bold)).foregroundStyle(Color.petMuted) }.buttonStyle(.plain)
                        }
                    }
                }.card()

                if !store.dictations.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        SectionTitle(text: "Recent · copy, or fix one and I'll learn")
                        ForEach(store.dictations.prefix(8)) { d in
                            VStack(alignment: .leading, spacing: 6) {
                                HStack(alignment: .top) {
                                    Text(d.date.formatted(date: .omitted, time: .shortened)).font(.system(size: 10.5, design: .rounded)).foregroundStyle(Color.petMuted).frame(width: 52, alignment: .leading)
                                    if fixingID == d.id {
                                        TextField("", text: $fixText, axis: .vertical).textFieldStyle(.plain)
                                            .onSubmit { store.learnFix(original: d.text, edited: fixText, dictationID: d.id); fixingID = nil }
                                    } else {
                                        Text(d.text).lineLimit(3).textSelection(.enabled)
                                    }
                                    Spacer(minLength: 4)
                                    Button {
                                        NSPasteboard.general.clearContents()
                                        NSPasteboard.general.setString(d.text, forType: .string)
                                        copiedID = d.id
                                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { if copiedID == d.id { copiedID = nil } }
                                    } label: { Image(systemName: copiedID == d.id ? "checkmark.circle.fill" : "doc.on.doc").font(.system(size: 11, weight: .bold)).foregroundStyle(Color.petAccent) }
                                    .buttonStyle(.plain).help("Copy")
                                    Button {
                                        if fixingID == d.id { store.learnFix(original: d.text, edited: fixText, dictationID: d.id); fixingID = nil }
                                        else { fixingID = d.id; fixText = d.text }
                                    } label: { Image(systemName: fixingID == d.id ? "checkmark" : "pencil").font(.system(size: 11, weight: .bold)).foregroundStyle(Color.petAccent) }
                                    .buttonStyle(.plain).help("Fix a word and I'll learn it")
                                }
                                Divider().opacity(0.3)
                            }
                        }
                    }.card()
                }
            }
            .padding(.horizontal, 16).padding(.bottom, 16).padding(.top, 8)
        }
    }
}

struct Chip: View {
    var text: String
    var color: Color
    var remove: () -> Void
    var body: some View {
        HStack(spacing: 6) {
            Text(text).font(.system(size: 12, weight: .semibold, design: .rounded))
            Button(action: remove) { Image(systemName: "xmark").font(.system(size: 8, weight: .bold)) }.buttonStyle(.plain).opacity(0.6)
        }
        .padding(.horizontal, 10).padding(.vertical, 6)
        .background(Capsule().fill(color.opacity(0.14)))
        .foregroundStyle(Color.petInk)
    }
}

struct Flow: Layout {
    var spacing: CGFloat = 8
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        layout(proposal.width ?? 360, subviews).size
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let l = layout(bounds.width, subviews)
        for (i, p) in l.points.enumerated() {
            subviews[i].place(at: CGPoint(x: bounds.minX + p.x, y: bounds.minY + p.y), proposal: .unspecified)
        }
    }
    private func layout(_ width: CGFloat, _ subviews: Subviews) -> (size: CGSize, points: [CGPoint]) {
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0, pts: [CGPoint] = []
        for s in subviews {
            let sz = s.sizeThatFits(.unspecified)
            if x + sz.width > width, x > 0 { x = 0; y += rowH + spacing; rowH = 0 }
            pts.append(CGPoint(x: x, y: y))
            x += sz.width + spacing; rowH = max(rowH, sz.height)
        }
        return (CGSize(width: width, height: y + rowH), pts)
    }
}

// MARK: - Mind
struct MindView: View {
    @ObservedObject var mind = Mind.shared
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Hold right ⌥ Option and say things like: remember that my sister is called Anna. Or: remind me at four to call the dentist.")
                    .foregroundStyle(Color.petMuted).font(.system(size: 12, design: .rounded)).padding(.horizontal, 4)

                VStack(alignment: .leading, spacing: 10) {
                    SectionTitle(text: "Reminders")
                    if mind.reminders.isEmpty { Text("None yet.").foregroundStyle(Color.petMuted).font(.system(size: 12, design: .rounded)) }
                    ForEach(mind.reminders.sorted { ($0.due ?? .distantFuture) < ($1.due ?? .distantFuture) }) { r in
                        HStack(alignment: .top, spacing: 10) {
                            Button { var x = r; x.done.toggle(); mind.update(x) } label: {
                                Image(systemName: r.done ? "checkmark.circle.fill" : "circle").foregroundStyle(Color.petAccent)
                            }.buttonStyle(.plain)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(r.text).strikethrough(r.done).foregroundStyle(r.done ? Color.petMuted : Color.petInk)
                                if let d = r.due { Text(d.formatted(date: .abbreviated, time: .shortened)).font(.system(size: 11, design: .rounded)).foregroundStyle(Color.petMuted) }
                            }
                            Spacer()
                            Button { mind.remove(r) } label: { Image(systemName: "xmark").font(.system(size: 10, weight: .bold)).foregroundStyle(Color.petMuted) }.buttonStyle(.plain)
                        }
                    }
                }.card()

                VStack(alignment: .leading, spacing: 10) {
                    SectionTitle(text: "What it remembers about you")
                    if mind.facts.isEmpty { Text("Nothing yet. It learns from conversations.").foregroundStyle(Color.petMuted).font(.system(size: 12, design: .rounded)) }
                    ForEach(mind.facts, id: \.self) { f in
                        HStack(alignment: .top) {
                            Circle().fill(Color.petAccent).frame(width: 6, height: 6).padding(.top, 6)
                            Text(f)
                            Spacer()
                            Button { mind.forget(f) } label: { Image(systemName: "xmark").font(.system(size: 10, weight: .bold)).foregroundStyle(Color.petMuted) }.buttonStyle(.plain)
                        }
                    }
                }.card()

                HStack { Spacer(); Button("Forget everything") { mind.forgetEverything(); (NSApp.delegate as? AppDelegate)?.brain.forget() }.buttonStyle(Pill(filled: false)) }
            }
            .padding(.horizontal, 16).padding(.bottom, 16).padding(.top, 8)
        }
    }
}

// MARK: - Me
struct MeView: View {
    var onEngineChange: (String) -> Void
    @AppStorage("engine") private var engine = "apple"
    @AppStorage("summaryEngine") private var summaryEngine = "claude"
    @AppStorage("launchAtLogin") private var launchAtLogin = false
    @AppStorage("sounds") private var sounds = true
    @AppStorage("wander") private var wander = true
    @AppStorage("voiceOn") private var voiceOn = true
    @AppStorage("voiceReadBack") private var voiceReadBack = false
    @AppStorage("voiceName") private var voiceName = "Bubbles"
    @AppStorage("brainOn") private var brainOn = true
    @AppStorage("chattiness") private var chattiness = "some"
    @AppStorage("brainModel") private var brainModel = Brain.defaultTier
    @State private var brainStatus = (NSApp.delegate as? AppDelegate)?.brain.status ?? "off"
    @State private var claudeKey = ""
    @State private var keySaved = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 10) {
                    Image(systemName: "hand.raised.fingers.spread").font(.system(size: 16)).foregroundStyle(Color.petAccent)
                    Text("Hold **fn** and talk. Let go and I'll type it wherever your cursor is.")
                        .foregroundStyle(Color.petMuted).font(.system(size: 12.5, design: .rounded))
                }
                .padding(.horizontal, 4)

                VStack(alignment: .leading, spacing: 10) {
                    SectionTitle(text: "Ears")
                    choice("Apple, on this Mac", "apple", engine) { engine = $0; onEngineChange($0) }
                    choice("Parakeet v3, on this Mac", "parakeet", engine) { engine = $0; onEngineChange($0) }
                }.card()

                VStack(alignment: .leading, spacing: 10) {
                    SectionTitle(text: "Note writer")
                    choice("Claude", "claude", summaryEngine) { summaryEngine = $0 }
                    HStack(spacing: 8) {
                        SecureField("sk-ant-… paste an Anthropic API key", text: $claudeKey)
                            .textFieldStyle(.plain).padding(10)
                            .background(RoundedRectangle(cornerRadius: 12).fill(Color.petBG))
                            .onSubmit { saveKey() }
                        Button(keySaved ? "Saved" : "Save") { saveKey() }.buttonStyle(Pill(filled: !keySaved))
                    }
                    Text(Summarizer.hasClaudeKey ? "Key is in your Keychain. Only the transcript text is sent to Claude, never audio." : "Get a key at console.anthropic.com. Only the transcript text is sent to Claude, never audio.")
                        .font(.system(size: 11, design: .rounded)).foregroundStyle(Color.petMuted)
                    choice(Summarizer.appleAvailable ? "Apple Intelligence, on this Mac" : "Apple Intelligence (off in System Settings)", "apple", summaryEngine) { summaryEngine = $0 }
                }.card()

                VStack(alignment: .leading, spacing: 10) {
                    SectionTitle(text: "Permissions")
                    permRow("Microphone", ok: AVCaptureDevice.authorizationStatus(for: .audio) == .authorized, url: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone")
                    permRow("Speech recognition", ok: SFSpeechRecognizer.authorizationStatus() == .authorized, url: "x-apple.systempreferences:com.apple.preference.security?Privacy_SpeechRecognition")
                    permRow("Accessibility (fn key + typing)", ok: Permissions.accessibilityTrusted, url: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
                    permRow("System audio (hear your call)", ok: nil, url: "x-apple.systempreferences:com.apple.preference.security?Privacy_AudioCapture")
                    if !Permissions.accessibilityTrusted {
                        Text("Shows as granted but I still can't type? Remove VoicePet from the Accessibility list with the minus button, then add it again.")
                            .font(.system(size: 11.5, design: .rounded)).foregroundStyle(.orange)
                    }
                    if Permissions.fnKeyDoesSomethingElse {
                        Text("Your fn key also opens emoji/dictation. Set it to Do Nothing in System Settings › Keyboard.")
                            .font(.system(size: 11.5, design: .rounded)).foregroundStyle(.orange)
                    }
                }.card()

                VStack(alignment: .leading, spacing: 10) {
                    SectionTitle(text: "Personality")
                    Toggle("Has a mind of its own (on-device model, 1.1 GB once)", isOn: $brainOn).toggleStyle(.switch).controlSize(.small)
                        .onChange(of: brainOn) { _, _ in (NSApp.delegate as? AppDelegate)?.applyBrainPref() }
                    if brainOn {
                        HStack(spacing: 6) {
                            ForEach([("quiet", "Quiet"), ("some", "Some"), ("lots", "Chatty")], id: \.0) { id, label in
                                Button(label) { chattiness = id }.buttonStyle(Pill(filled: chattiness == id))
                            }
                        }
                        Flow(spacing: 6) {
                            ForEach(Brain.models, id: \.id) { m in
                                Button { brainModel = m.id; (NSApp.delegate as? AppDelegate)?.applyBrainPref() } label: {
                                    Text("\(m.label) · \(m.gb, specifier: "%.0f") GB\(Brain.isDownloaded(m) ? "" : " ↓")")
                                }.buttonStyle(Pill(filled: brainModel == m.id))
                            }
                        }
                        Text(brainStatus == "ready" ? "Brain is ready. Hold right ⌥ Option and talk to it." : "Brain: \(brainStatus)")
                            .font(.system(size: 11, design: .rounded)).foregroundStyle(brainStatus == "ready" ? Color.petMuted : .orange)
                    }
                }.card()
                .onAppear { (NSApp.delegate as? AppDelegate)?.brain.onStatus = { s in brainStatus = s } }

                VStack(alignment: .leading, spacing: 10) {
                    SectionTitle(text: "Voice")
                    Toggle("Talks back", isOn: $voiceOn).toggleStyle(.switch).controlSize(.small)
                    if voiceOn {
                        Flow(spacing: 6) {
                            ForEach(PetVoice.voices, id: \.self) { v in
                                Button(v) { voiceName = v; (NSApp.delegate as? AppDelegate)?.voice.test() }
                                    .buttonStyle(Pill(filled: voiceName == v))
                            }
                        }
                        Toggle("Reads my words back after typing them", isOn: $voiceReadBack).toggleStyle(.switch).controlSize(.small)
                        Text("Tap a voice to hear it.").font(.system(size: 11, design: .rounded)).foregroundStyle(Color.petMuted)
                    }
                }.card()

                VStack(alignment: .leading, spacing: 10) {
                    SectionTitle(text: "Manners")
                    Toggle("Sounds", isOn: $sounds).toggleStyle(.switch).controlSize(.small)
                        .onChange(of: sounds) { _, _ in (NSApp.delegate as? AppDelegate)?.applySoundsPref() }
                    Toggle("Wanders around the screen", isOn: $wander).toggleStyle(.switch).controlSize(.small)
                        .onChange(of: wander) { _, _ in (NSApp.delegate as? AppDelegate)?.applyWanderPref() }
                    Toggle("Wake up with my Mac", isOn: $launchAtLogin).toggleStyle(.switch).controlSize(.small)
                        .onChange(of: launchAtLogin) { _, v in
                            do { v ? try SMAppService.mainApp.register() : try SMAppService.mainApp.unregister() } catch { NSLog("login item: \(error)") }
                        }
                }.card()

                HStack { Spacer(); Button("Goodbye") { NSApp.terminate(nil) }.buttonStyle(Pill(filled: false)) }
            }
            .padding(.horizontal, 16).padding(.bottom, 16).padding(.top, 8)
        }
        .onAppear { claudeKey = Keychain.get("anthropic") ?? "" }
    }

    func saveKey() {
        Keychain.set(claudeKey.trimmingCharacters(in: .whitespacesAndNewlines), account: "anthropic")
        keySaved = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { keySaved = false }
    }

    func choice(_ label: String, _ id: String, _ current: String, _ set: @escaping (String) -> Void) -> some View {
        Button { set(id) } label: {
            HStack {
                Image(systemName: current == id ? "largecircle.fill.circle" : "circle").foregroundStyle(Color.petAccent)
                Text(label)
                Spacer()
            }
        }.buttonStyle(.plain)
    }

    func permRow(_ label: String, ok: Bool?, url: String) -> some View {
        HStack {
            Image(systemName: ok == true ? "checkmark.circle.fill" : (ok == false ? "circle" : "circle.dotted")).foregroundStyle(ok == true ? Color.petAccent : Color.petMuted)
            Text(label)
            Spacer()
            Button("Open") { if let u = URL(string: url) { NSWorkspace.shared.open(u) } }.buttonStyle(.plain).foregroundStyle(Color.petMuted).font(.system(size: 11.5, weight: .semibold, design: .rounded))
        }
    }
}
