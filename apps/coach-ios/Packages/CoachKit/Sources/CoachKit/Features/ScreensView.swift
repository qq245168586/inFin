import SwiftUI

struct ScreensView: View {
    @Environment(CoachModel.self) private var model
    @State private var loading = false
    var body: some View {
        List {
            Section {
                LabeledContent("场馆", value: model.user?.venueName ?? "未绑定")
                LabeledContent("在线设备", value: "\(model.screens.filter(\.online).count) / \(model.screens.count)")
            }
            Section("电视") {
                if loading && model.screens.isEmpty { ProgressView("加载设备…") }
                else if model.screens.isEmpty { ContentUnavailableView("暂无设备", systemImage: "tv") }
                ForEach(model.screens) { screen in
                    NavigationLink {
                        Form {
                            Section("状态") {
                                LabeledContent("连接", value: screen.online ? "在线" : "离线")
                                LabeledContent("播放", value: screen.playbackState ?? "未知")
                                LabeledContent("版本", value: screen.appVersion ?? "未知")
                            }
                            Section("缓存") {
                                LabeledContent("文件", value: "\(screen.cacheFileCount ?? 0)")
                                LabeledContent("大小", value: ByteCountFormatter.string(fromByteCount: Int64(screen.cacheBytes ?? 0), countStyle: .file))
                            }
                            Section("设备标识") { Text(screen.deviceId).font(.footnote.monospaced()).textSelection(.enabled) }
                        }
                        .navigationTitle("屏幕 \(screen.screenNumber)").navigationBarTitleDisplayMode(.inline)
                    } label: {
                        HStack(spacing: 14) {
                            Image(systemName: "tv").foregroundStyle(screen.online ? .green : .secondary).font(.title2).frame(width: 36)
                            VStack(alignment: .leading, spacing: 5) {
                                Text("屏幕 \(screen.screenNumber)").font(.headline)
                                Text(screen.appVersion ?? "未知版本").font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(screen.online ? "在线" : "离线").font(.subheadline).foregroundStyle(screen.online ? .green : .secondary)
                        }.padding(.vertical, 6)
                    }.accessibilityIdentifier("screen.\(screen.screenNumber)")
                }
            }
        }
        .navigationTitle("设备")
        .task { loading = true; await model.loadScreens(); loading = false }
        .refreshable { await model.loadScreens() }
    }
}
