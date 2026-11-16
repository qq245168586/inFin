import SwiftUI

struct CourseDetailView: View {
    @Environment(CoachModel.self) private var model
    let scheduleID: EntityID
    @State private var pendingAction: ControlAction?
    private var schedule: CourseSchedule? { model.schedules.first { $0.id == scheduleID } }
    var body: some View {
        Group {
            if let schedule {
                List {
                    Section {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(schedule.courseName).font(.title2.bold())
                            Label("\(CourseClock.timeLabel(schedule)) · \(Int(schedule.duration ?? 0)) 分钟", systemImage: "clock")
                                .foregroundStyle(.secondary)
                            if let description = schedule.description, !description.isEmpty { Text(description).font(.subheadline) }
                            Text(schedule.version ?? "").font(.caption.monospaced()).foregroundStyle(.secondary)
                        }.padding(.vertical, 6)
                    }
                    Section {
                        LabeledContent("课程状态", value: model.state(for: schedule)?.label ?? "未开始")
                        ForEach(availableActions(schedule)) { action in
                            Button(role: action == .terminate ? .destructive : nil) { pendingAction = action } label: {
                                Label(action.title, systemImage: action.symbol)
                            }
                            .disabled(model.controlsLocked)
                            .accessibilityIdentifier("control.\(action.rawValue)")
                        }
                        if model.controlsLocked { HStack { ProgressView(); Text("正在同步…").foregroundStyle(.secondary) } }
                        if let notice = model.notice { Text(notice).font(.footnote).foregroundStyle(.secondary) }
                    } header: { Text(model.isDemo ? "演示控制" : "TV 控制") }
                    footer: { Text(model.isDemo ? "不会向真实场馆发送指令。" : "场馆：\(model.user?.venueName ?? "")") }

                    ForEach(schedule.actionSections) { section in
                        Section(section.title) {
                            ForEach(section.actions) { action in
                                NavigationLink(value: action) {
                                    HStack(spacing: 12) {
                                        ActionThumbnail(action: action).frame(width: 76, height: 52).clipShape(RoundedRectangle(cornerRadius: 6))
                                        VStack(alignment: .leading, spacing: 5) {
                                            Text(action.name).font(.body.weight(.medium))
                                            if let station = action.station { Text("站点 \(station)").font(.caption).foregroundStyle(.secondary) }
                                        }
                                    }.padding(.vertical, 4)
                                }.accessibilityIdentifier("action.\(action.id)")
                            }
                        }
                    }
                    if schedule.actionSections.isEmpty { Section { ContentUnavailableView("暂无动作信息", systemImage: "figure.strengthtraining.functional") } }
                }
                .refreshable { await model.refresh() }
                .confirmationDialog(pendingAction?.title ?? "确认操作", isPresented: Binding(get: { pendingAction != nil }, set: { if !$0 { pendingAction = nil } }), titleVisibility: .visible) {
                    if let action = pendingAction {
                        Button("确认\(action.title)", role: action == .terminate ? .destructive : nil) {
                            pendingAction = nil
                            Task { await model.control(action, schedule: schedule) }
                        }
                    }
                    Button("取消", role: .cancel) { pendingAction = nil }
                } message: {
                    Text(model.isDemo ? "仅改变本机演示状态。" : "此操作会控制「\(model.user?.venueName ?? "当前场馆")」的电视。")
                }
            } else {
                ContentUnavailableView("课程已变更", systemImage: "calendar.badge.exclamationmark", description: Text("返回课表重新选择课程。"))
            }
        }
        .navigationTitle("课程详情").navigationBarTitleDisplayMode(.inline)
    }
    private func availableActions(_ schedule: CourseSchedule) -> [ControlAction] {
        switch model.state(for: schedule)?.state {
        case "RUNNING", "SCHEDULED": [.plan, .pause, .terminate]
        case "PAUSED": [.plan, .resume, .terminate]
        case "PREVIEW": [.plan, .start, .terminate]
        default: [.preview, .start, .plan]
        }
    }
}
