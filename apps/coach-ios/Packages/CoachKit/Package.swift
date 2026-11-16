// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "CoachKit",
    platforms: [.iOS(.v17)],
    products: [.library(name: "CoachKit", targets: ["CoachKit"])],
    dependencies: [
        .package(url: "https://github.com/Alamofire/Alamofire.git", exact: "5.10.2"),
        .package(url: "https://github.com/onevcat/Kingfisher.git", exact: "8.3.2")
    ],
    targets: [
        .target(name: "CoachKit", dependencies: ["Alamofire", "Kingfisher"])
    ]
)
