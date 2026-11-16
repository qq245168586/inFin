import SwiftUI

public struct CoachRootView: View {
    @State private var model = CoachModel()
    @Environment(\.scenePhase) private var scenePhase
    public init() {}
    public var body: some View {
        Group {
            if model.restoring {
                ProgressView("正在恢复登录…")
            } else if model.user != nil {
                TabView {
                    NavigationStack { ScheduleListView() }
                        .id(model.packages?.activeCoursePackageId)
                        .tabItem { Label("课表", systemImage: "calendar") }
                    NavigationStack { ScreensView() }
                        .tabItem { Label("设备", systemImage: "tv") }
                    NavigationStack { SettingsView() }
                        .tabItem { Label("设置", systemImage: "gearshape") }
                }
            } else {
                NavigationStack { LoginView() }
            }
        }
        .environment(model)
        .environment(\.timeZone, CourseClock.calendar.timeZone)
        .tint(.blue)
        .task { await model.restore() }
        .task(id: scenePhase) {
            guard scenePhase == .active else { return }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(10))
                guard !Task.isCancelled else { return }
                await model.refreshPlayback()
            }
        }
        .alert("操作未完成", isPresented: Binding(get: { model.errorMessage != nil }, set: { if !$0 { model.errorMessage = nil } })) {
            Button("知道了", role: .cancel) { model.errorMessage = nil }
        } message: { Text(model.errorMessage ?? "") }
    }
}

private struct LoginView: View {
    @Environment(CoachModel.self) private var model
    @State private var username = ""
    @State private var password = ""
    @FocusState private var focus: Field?
    private enum Field { case username, password }

    var body: some View {
        Form {
            Section {
                Label {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("INFINI").font(.title2.bold())
                        Text("教练工作台").foregroundStyle(.secondary)
                    }
                } icon: {
                    Image(systemName: "figure.strengthtraining.functional")
                        .font(.largeTitle).foregroundStyle(.blue).frame(width: 56, height: 64)
                }
                .padding(.vertical, 12)
            }
            Section {
                TextField("账号", text: $username)
                    .textContentType(.username).textInputAutocapitalization(.never).autocorrectionDisabled()
                    .focused($focus, equals: .username).submitLabel(.next).onSubmit { focus = .password }
                    .accessibilityIdentifier("login.username")
                SecureField("密码", text: $password)
                    .textContentType(.password).focused($focus, equals: .password).submitLabel(.go)
                    .onSubmit { signIn() }.accessibilityIdentifier("login.password")
                Button(action: signIn) {
                    HStack {
                        Text("登录")
                        Spacer()
                        if model.authenticating { ProgressView() }
                        else { Image(systemName: "arrow.right") }
                    }
                }
                .disabled(username.trimmingCharacters(in: .whitespaces).isEmpty || password.isEmpty || model.authenticating)
            } header: { Text("场馆账号") } footer: {
                Text("正式环境 · 登录后控制绑定场馆的电视")
            }
            if let error = model.loginError {
                Section { Label(error, systemImage: "exclamationmark.triangle").foregroundStyle(.red) }
            }
            Section {
                Button { Task { await model.enterDemo() } } label: {
                    Label("体验演示", systemImage: "play.circle")
                }
                .accessibilityIdentifier("login.demo")
                .disabled(model.authenticating)
            } footer: { Text("演示不会控制真实电视。") }
        }
        .navigationTitle("Infini Coach")
    }
    private func signIn() {
        guard !username.trimmingCharacters(in: .whitespaces).isEmpty, !password.isEmpty else { return }
        focus = nil
        Task {
            await model.login(username: username, password: password)
            if model.user != nil { password = "" }
        }
    }
}
