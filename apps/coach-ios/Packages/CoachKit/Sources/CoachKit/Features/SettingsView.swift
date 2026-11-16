import SwiftUI

struct SettingsView: View {
    @Environment(CoachModel.self) private var model
    @State private var confirmLogout = false
    var body: some View {
        Form {
            Section {
                Label {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(model.user?.displayName ?? "教练").font(.headline)
                        Text(model.user?.venueName ?? "").font(.subheadline).foregroundStyle(.secondary)
                    }
                } icon: { Image(systemName: "person.crop.circle.fill").font(.largeTitle).foregroundStyle(.blue) }
                .padding(.vertical, 8)
            }
            Section("场馆") {
                NavigationLink { CoursePackagesView() } label: {
                    Label("课程包", systemImage: "square.stack.3d.up")
                }.accessibilityIdentifier("settings.packages")
                LabeledContent("环境", value: model.isDemo ? "演示 · 本机数据" : "正式环境")
            }
            Section("关于") {
                LabeledContent("Infini Coach", value: "0.1.0 (1)")
                LabeledContent("界面语言", value: "简体中文")
            }
            Section {
                Button(model.isDemo ? "退出演示" : "退出登录", role: .destructive) { confirmLogout = true }
                    .disabled(model.controlsLocked || model.authenticating)
                    .accessibilityIdentifier("settings.logout")
            }
        }
        .navigationTitle("设置")
        .confirmationDialog("退出当前账号？", isPresented: $confirmLogout, titleVisibility: .visible) {
            Button("确认退出", role: .destructive) { Task { await model.logout() } }
            Button("取消", role: .cancel) {}
        } message: { Text("不影响网页版登录和正在运行的课程。") }
    }
}

struct CoursePackagesView: View {
    @Environment(CoachModel.self) private var model
    @State private var selected: CoursePackage?
    @State private var loading = false
    var body: some View {
        List {
            Section {
                if loading && model.packages == nil { ProgressView("加载课程包…") }
                else if model.packages?.all.isEmpty != false { ContentUnavailableView("未绑定课程包", systemImage: "square.stack.3d.up") }
                ForEach(model.packages?.all ?? []) { package in
                    Button { selected = package } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 5) {
                                Text(package.name).foregroundStyle(.primary)
                                if let description = package.description, !description.isEmpty { Text(description).font(.caption).foregroundStyle(.secondary) }
                            }
                            Spacer()
                            if package.id == model.packages?.activeCoursePackageId { Image(systemName: "checkmark").fontWeight(.semibold) }
                        }.padding(.vertical, 4)
                    }
                    .disabled(model.controlsLocked || package.id == model.packages?.activeCoursePackageId || model.playback?.isActive == true)
                    .accessibilityIdentifier("package.\(package.id)")
                }
                if model.controlsLocked { ProgressView("正在切换…") }
            } footer: {
                Text(model.playback?.isActive == true ? "请先结束当前课程，再切换课程包。" : "切换后场馆电视会重新同步课表。")
            }
        }
        .navigationTitle("课程包").navigationBarTitleDisplayMode(.inline)
        .task { loading = true; await model.loadPackages(); loading = false }
        .refreshable { await model.loadPackages() }
        .confirmationDialog("切换课程包", isPresented: Binding(get: { selected != nil }, set: { if !$0 { selected = nil } }), titleVisibility: .visible) {
            if let selected {
                Button("切换到 \(selected.name)") { self.selected = nil; Task { await model.switchPackage(selected) } }
            }
            Button("取消", role: .cancel) { selected = nil }
        } message: { Text(model.isDemo ? "仅切换本机演示数据。" : "将更新场馆正在使用的课程包。") }
    }
}
