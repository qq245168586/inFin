import SwiftUI

struct ScheduleListView: View {
    @Environment(CoachModel.self) private var model
    @State private var datePicker = false
    @State private var draftDate = Date()

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Label(model.user?.venueName ?? "场馆", systemImage: "building.2")
                            .font(.subheadline.weight(.medium))
                        Spacer()
                        if model.isDemo { Text("演示").font(.caption.bold()).foregroundStyle(.orange) }
                    }
                    Text(model.selectedDate, format: .dateTime.month().day().weekday().locale(Locale(identifier: "zh_CN")))
                        .font(.title2.bold())
                }
                .padding(.vertical, 4)
                HStack {
                    Button { shiftDay(-1) } label: { Image(systemName: "chevron.left").frame(width: 32, height: 32) }
                        .accessibilityLabel("前一天")
                    Spacer()
                    Button("今天") { Task { await model.selectDate(Date()) } }
                    Spacer()
                    Button { shiftDay(1) } label: { Image(systemName: "chevron.right").frame(width: 32, height: 32) }
                        .accessibilityLabel("后一天")
                }.buttonStyle(.borderless)
            }
            if let session = model.playback, session.isActive {
                Section("场馆当前状态") {
                    Label {
                        VStack(alignment: .leading) {
                            Text(session.courseName ?? "当前课程")
                            Text(session.label).font(.caption).foregroundStyle(.secondary)
                        }
                    } icon: { Image(systemName: "dot.radiowaves.left.and.right").foregroundStyle(.green) }
                }
            }
            Section("\(model.schedules.count) 节课程") {
                if model.loading && model.schedules.isEmpty {
                    HStack { Spacer(); ProgressView("加载课表…"); Spacer() }.padding()
                } else if model.schedules.isEmpty {
                    ContentUnavailableView("当天暂无课程", systemImage: "calendar", description: Text("选择其他日期或下拉刷新。"))
                } else {
                    ForEach(model.schedules) { schedule in
                        NavigationLink(value: schedule.id) {
                            HStack(alignment: .top, spacing: 16) {
                                Text(CourseClock.timeLabel(schedule))
                                    .font(.headline.monospacedDigit()).foregroundStyle(.blue).frame(width: 56, alignment: .leading)
                                VStack(alignment: .leading, spacing: 7) {
                                    Text(schedule.courseName).font(.headline)
                                    Text("\(Int(schedule.duration ?? 0)) 分钟 · \(schedule.actionCount) 个动作")
                                        .font(.subheadline).foregroundStyle(.secondary)
                                    if let state = model.state(for: schedule), state.isActive {
                                        Text(state.label).font(.caption.bold()).foregroundStyle(.green)
                                    } else if let topic = schedule.topic, !topic.isEmpty {
                                        Text(topic).font(.caption).foregroundStyle(.secondary)
                                    }
                                }
                            }.padding(.vertical, 8)
                        }
                        .accessibilityIdentifier("schedule.\(schedule.id)")
                    }
                }
            }
        }
        .navigationTitle("课表")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { draftDate = model.selectedDate; datePicker = true } label: { Image(systemName: "calendar.badge.clock") }
                    .accessibilityLabel("选择日期").accessibilityIdentifier("schedule.date")
            }
        }
        .refreshable { await model.refresh() }
        .navigationDestination(for: EntityID.self) { CourseDetailView(scheduleID: $0) }
        .navigationDestination(for: ActionItem.self) { ActionDetailView(action: $0) }
        .sheet(isPresented: $datePicker) {
            NavigationStack {
                DatePicker("课程日期", selection: $draftDate, displayedComponents: .date)
                    .datePickerStyle(.graphical).padding()
                    .environment(\.timeZone, CourseClock.calendar.timeZone)
                    .navigationTitle("选择日期").navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) { Button("取消") { datePicker = false } }
                        ToolbarItem(placement: .confirmationAction) {
                            Button("完成") { datePicker = false; Task { await model.selectDate(draftDate) } }
                        }
                    }
            }
            .presentationDetents([.medium, .large])
        }
    }
    private func shiftDay(_ value: Int) {
        guard let day = CourseClock.calendar.date(byAdding: .day, value: value, to: model.selectedDate) else { return }
        Task { await model.selectDate(day) }
    }
}
