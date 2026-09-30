#!/bin/bash
# ARCHER AI — Android APK build (manual pipeline, no Gradle/SDK-manager needed)
# aapt2 (resources) → javac (11) → d8 (dex) → package → zipalign → apksigner
set -euo pipefail

W=/home/z/my-project/scripts/apkbuild
DL=$W/dl
OUT=/home/z/my-project/client/public/downloads
mkdir -p "$OUT" "$W/bt" "$W/platform" "$W/classes" "$W/dex"

# ---- 0. toolchain -----------------------------------------------------------
[ -f "$DL/bt34.zip" ] || { echo "missing bt34.zip"; exit 1; }
[ -f "$DL/platform34.zip" ] || { echo "missing platform34.zip"; exit 1; }
unzip -oq "$DL/bt34.zip" -d "$W/bt"
unzip -oq "$DL/platform34.zip" -d "$W/platform"
BT=$(find "$W/bt" -maxdepth 1 -type d ! -path "$W/bt" | head -1)
AJ=$(find "$W/platform" -name android.jar | head -1)
echo "build-tools: $BT"
echo "android.jar: $AJ"
[ -x "$BT/aapt2" ] || { echo "aapt2 not found"; exit 1; }

# ---- 1. resources -----------------------------------------------------------
"$BT/aapt2" compile --dir "$W/app/res" -o "$W/res.zip"
"$BT/aapt2" link -o "$W/base.apk" -I "$AJ" \
  --manifest "$W/app/AndroidManifest.xml" \
  -R "$W/res.zip" --auto-add-overlay

# ---- 2. java → dex ----------------------------------------------------------
# d8 from build-tools 35 (newer R8) — JDK 21 javac emits MethodParameters
# attributes that crash the R8 bundled with build-tools <= 34
javac --release 11 -classpath "$AJ" -d "$W/classes" \
  "$W/app/java/ai/archer/assistant/MainActivity.java"

D8=$(find "$W/bt35x" -name d8 -type f | head -1)
[ -n "$D8" ] || { echo "d8 (bt35) not found"; exit 1; }
"$D8" --release --lib "$AJ" --min-api 24 \
  --output "$W/dex" $(find "$W/classes" -name '*.class')

# ---- 3. package + align + sign ----------------------------------------------
(cd "$W/dex" && zip -uj "$W/base.apk" classes.dex)
"$BT/zipalign" -f -p 4 "$W/base.apk" "$W/aligned.apk"

KS=$W/archer.keystore
[ -f "$KS" ] || keytool -genkeypair -keystore "$KS" -alias archer \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass archer123456 -keypass archer123456 \
  -dname "CN=ARCHER AI, O=ARCHER"

"$BT/apksigner" sign --ks "$KS" --ks-pass pass:archer123456 \
  --key-pass pass:archer123456 \
  --out "$OUT/ARCHER.apk" "$W/aligned.apk"

"$BT/apksigner" verify "$OUT/ARCHER.apk" && echo "APK SIGNATURE OK"
ls -la "$OUT"
