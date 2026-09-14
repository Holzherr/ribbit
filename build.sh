#!/usr/bin/env bash
# Builds web/ (three.js pet) and the Swift app, then assembles build/VoicePet.app
set -euo pipefail
cd "$(dirname "$0")"
(cd web && npm run build --silent)
(cd web/notes && npm run build --silent)
swift build -c release 2>&1 | grep -E "error|warning: var|Build complete" || true
# Assemble and sign in a non-iCloud-synced staging dir first: this repo lives under iCloud
# Drive (~/Documents), which re-attaches resource forks / Finder info to files as they're
# written there, and codesign refuses to sign a bundle containing them. Signing outside the
# synced tree sidesteps that; the already-signed bundle is then moved into place.
STAGE="$(mktemp -d)"
APP="$STAGE/VoicePet.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/web"
cp Resources/Info.plist "$APP/Contents/"
cp .build/release/VoicePet "$APP/Contents/MacOS/"
cp -R web/dist/. "$APP/Contents/Resources/web/"
mkdir -p "$APP/Contents/Resources/notes" && cp web/notes/dist/index.html "$APP/Contents/Resources/notes/"
# binary frameworks from dependencies (llama.cpp for the on-device brain)
mkdir -p "$APP/Contents/Frameworks"
for fw in $(find .build -type d -name "*.framework" -path "*macos*" 2>/dev/null; find .build/artifacts -type d -name "*.framework" 2>/dev/null); do
  name=$(basename "$fw"); [ -d "$APP/Contents/Frameworks/$name" ] || cp -R "$fw" "$APP/Contents/Frameworks/"
done
install_name_tool -add_rpath "@executable_path/../Frameworks" "$APP/Contents/MacOS/VoicePet" 2>/dev/null || true
# SwiftPM resource bundles from dependencies, if any
for b in .build/release/*.bundle; do [ -d "$b" ] && cp -R "$b" "$APP/Contents/Resources/"; done
# Strip iCloud/Finder detritus (resource forks, xattrs) that trips codesign when the repo
# sits under an iCloud-synced folder.
xattr -cr "$APP"
# Sign with the stable local identity if it exists (keeps macOS permission grants across rebuilds), else ad-hoc.
if security find-identity -v -p codesigning 2>/dev/null | grep -q "VoicePet Dev"; then
  codesign --force --deep --sign "VoicePet Dev" "$APP"
  echo "signed with VoicePet Dev"
else
  codesign --force --deep --sign - "$APP"
  echo "signed ad-hoc (permissions may reset on rebuild)"
fi
codesign --verify --deep --strict "$APP"
FINAL=build/VoicePet.app
rm -rf "$FINAL"
mkdir -p build
mv "$APP" "$FINAL"
rm -rf "$STAGE"
echo "Built $FINAL"
