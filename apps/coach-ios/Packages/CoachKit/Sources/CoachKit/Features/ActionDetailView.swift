import SwiftUI
import AVKit
import Combine
import Kingfisher
import CryptoKit

struct ActionThumbnail: View {
    @Environment(CoachModel.self) private var model
    let action: ActionItem
    @State private var image: UIImage?
    var body: some View {
        ZStack {
            Color(.secondarySystemGroupedBackground)
            if let image { Image(uiImage: image).resizable().scaledToFit() }
            else { Image(systemName: "figure.strengthtraining.functional").font(.title2).foregroundStyle(.secondary) }
        }
        .task(id: action) {
            image = nil
            guard !model.isDemo, let id = action.actionID else { return }
            let keySource = "\(model.user?.accountNamespace ?? "")|\(id)|\(action.video ?? "")"
            let key = SHA256.hash(data: Data(keySource.utf8)).map { String(format: "%02x", $0) }.joined()
            let cache = ImageCache.default
            cache.diskStorage.config.sizeLimit = 100 * 1024 * 1024
            cache.diskStorage.config.expiration = .days(7)
            cache.memoryStorage.config.totalCostLimit = 30 * 1024 * 1024
            let cached: UIImage? = await withCheckedContinuation { continuation in
                cache.retrieveImage(forKey: key) { result in continuation.resume(returning: try? result.get().image) }
            }
            if let cached { image = cached; return }
            guard let data = try? await model.thumbnail(id), !Task.isCancelled, let decoded = UIImage(data: data) else { return }
            image = decoded
            try? await cache.store(decoded, original: data, forKey: key)
        }
        .accessibilityHidden(true)
    }
}

@MainActor @Observable
private final class ActionPlayer {
    var player: AVPlayer?
    var failure: String?
    var loading = false
    @ObservationIgnored private var observation: AnyCancellable?
    @ObservationIgnored private var failureObserver: NSObjectProtocol?
    @ObservationIgnored private var timeout: Task<Void, Never>?

    func play(_ url: URL) {
        stop()
        failure = nil; loading = true
        let item = AVPlayerItem(url: url)
        let player = AVPlayer(playerItem: item)
        self.player = player
        observation = item.publisher(for: \.status).receive(on: DispatchQueue.main).sink { [weak self] status in
            guard let self else { return }
            if status == .readyToPlay { self.loading = false; self.timeout?.cancel(); player.play() }
            if status == .failed { self.fail() }
        }
        failureObserver = NotificationCenter.default.addObserver(forName: .AVPlayerItemFailedToPlayToEndTime, object: item, queue: .main) { [weak self] _ in
            Task { @MainActor in self?.fail() }
        }
        timeout = Task { [weak self] in
            try? await Task.sleep(for: .seconds(25))
            guard !Task.isCancelled, self?.loading == true else { return }
            self?.fail()
        }
    }
    private func fail() {
        stop(); failure = "视频加载失败，请检查网络后重试。"
    }
    func stop() {
        player?.pause(); player?.replaceCurrentItem(with: nil); player = nil
        observation?.cancel(); observation = nil
        if let failureObserver { NotificationCenter.default.removeObserver(failureObserver) }
        failureObserver = nil
        timeout?.cancel(); timeout = nil; loading = false
    }
}

struct ActionDetailView: View {
    let action: ActionItem
    @State private var playback = ActionPlayer()
    @Environment(\.scenePhase) private var scenePhase
    private var url: URL? { APIConfiguration().media(action.video) }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                ZStack {
                    Color.black
                    if let player = playback.player {
                        VideoPlayer(player: player).accessibilityIdentifier("action.player")
                        if playback.loading { ProgressView().tint(.white) }
                    } else {
                        ActionThumbnail(action: action)
                        if let url {
                            Button { playback.play(url) } label: {
                                Image(systemName: "play.circle.fill").font(.system(size: 60)).symbolRenderingMode(.palette).foregroundStyle(.white, .black.opacity(0.65))
                            }
                            .accessibilityLabel("播放动作视频").accessibilityIdentifier("action.play")
                        }
                    }
                }
                .aspectRatio(16 / 10, contentMode: .fit)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                VStack(alignment: .leading, spacing: 12) {
                    Text(action.name).font(.title2.bold())
                    if let station = action.station { Label("站点 \(station)", systemImage: "mappin.and.ellipse").foregroundStyle(.secondary) }
                    if let description = action.description, !description.isEmpty { Text(description) }
                    if url == nil { Label("暂无动作视频", systemImage: "video.slash").foregroundStyle(.secondary) }
                    if let failure = playback.failure {
                        Label(failure, systemImage: "exclamationmark.triangle").foregroundStyle(.red)
                        if let url { Button("重新加载") { playback.play(url) } }
                    }
                }
            }.padding()
        }
        .navigationTitle("动作详情").navigationBarTitleDisplayMode(.inline)
        .onDisappear { playback.stop() }
        .onChange(of: scenePhase) { _, phase in if phase != .active { playback.player?.pause() } }
    }
}
