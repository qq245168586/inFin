#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
DEVICE="${COACH_IOS_SIMULATOR_ID:-$(xcrun simctl list devices available -j | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{const d=Object.values(JSON.parse(s).devices).flat().filter(d=>d.name.startsWith("iPhone"));const v=d.find(d=>d.state==="Booted")||d[0];if(!v)process.exit(1);console.log(v.udid)})')}"
mkdir -p .derivedData/TestResults
exec xcodebuild -workspace InfiniCoach.xcworkspace -scheme InfiniCoach \
  -destination "platform=iOS Simulator,id=$DEVICE" \
  -derivedDataPath .derivedData \
  -resultBundlePath ".derivedData/TestResults/$(date +%Y%m%d-%H%M%S).xcresult" \
  -parallel-testing-enabled NO test "$@"
