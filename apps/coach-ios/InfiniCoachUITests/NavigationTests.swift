import XCTest

final class NavigationTests: XCTestCase {
    @MainActor func testNativeNavigationAndDemoControl() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing"]
        app.launch()
        let demo = app.buttons["login.demo"]
        XCTAssertTrue(demo.waitForExistence(timeout: 10))
        demo.tap()
        let schedule = app.buttons["schedule.101"]
        XCTAssertTrue(schedule.waitForExistence(timeout: 10))
        capture("01-schedule")
        schedule.tap()
        XCTAssertTrue(app.navigationBars["课程详情"].waitForExistence(timeout: 5))
        app.buttons["control.preview"].tap()
        app.buttons["确认进入预览"].tap()
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "预览中")).firstMatch.waitForExistence(timeout: 5))
        capture("02-course-detail")
        let action = app.buttons["action.group-0-1-0"]
        for _ in 0..<4 where !action.isHittable { app.swipeUp() }
        XCTAssertTrue(action.exists)
        action.tap()
        XCTAssertTrue(app.navigationBars["动作详情"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["徒手深蹲"].exists)
        capture("03-action-detail")
        app.navigationBars.buttons.element(boundBy: 0).tap()
        XCTAssertTrue(app.navigationBars["课程详情"].exists)
        app.tabBars.buttons["设备"].tap()
        XCTAssertTrue(app.buttons["screen.1"].waitForExistence(timeout: 5))
        capture("04-screens")
        app.buttons["screen.1"].tap()
        XCTAssertTrue(app.navigationBars["屏幕 1"].exists)
        app.tabBars.buttons["设置"].tap()
        app.buttons["settings.packages"].tap()
        XCTAssertTrue(app.navigationBars["课程包"].exists)
        XCTAssertTrue(app.buttons["package.1"].waitForExistence(timeout: 5))
        capture("05-packages")
    }
    @MainActor func testDateSheetAndEmptyDay() {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing"]
        app.launch()
        XCTAssertTrue(app.buttons["login.demo"].waitForExistence(timeout: 10))
        app.buttons["login.demo"].tap()
        XCTAssertTrue(app.buttons["schedule.date"].waitForExistence(timeout: 5))
        app.buttons["schedule.date"].tap()
        XCTAssertTrue(app.buttons["取消"].waitForExistence(timeout: 5))
        app.buttons["取消"].tap()
        app.buttons["后一天"].tap()
        XCTAssertTrue(app.staticTexts["当天暂无课程"].waitForExistence(timeout: 5))
        app.buttons["今天"].tap()
        XCTAssertTrue(app.buttons["schedule.101"].waitForExistence(timeout: 5))
    }
    @MainActor private func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name; attachment.lifetime = .keepAlways
        add(attachment)
    }
}
