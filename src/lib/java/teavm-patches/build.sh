#!/usr/bin/env bash
# rebuilds public/java/teavm/0.16.0-jle1/ from the teavm-javac playground build at teavm.org/playground/3/.
#
#   compiler.wasm, compiler.wasm-runtime.js, compiler.wasm-deobfuscator.wasm   copied as is
#   runtime-classlib-teavm.bin   11 classes replaced (source_patches.py + JlePatcher.java)
#   compile-classlib-teavm.bin   regenerated from the patched runtime classlib with teavm-javac's
#                                StdlibConverter at 199bed0c (applies @Rename, so getMessage(),
#                                getClass(), toString() ... exist for javac again)
#
# needs: bash, curl, python3, a JDK 21+ (JAVA_HOME or javac on PATH). output is deterministic for a given JDK.
# usage: src/lib/java/teavm-patches/build.sh [work dir]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$(cd "$HERE/../../../.." && pwd)/public/java/teavm/0.16.0-jle1"
WORK="${1:-$(mktemp -d)}"
JAVA_BIN="${JAVA_HOME:+$JAVA_HOME/bin/}"
JAVAC="${JAVA_BIN}javac"
JAVA="${JAVA_BIN}java"
PY="python3 -I"

PLAYGROUND=https://teavm.org/playground/3
MAVEN=https://repo1.maven.org/maven2
TEAVM_SRC=https://raw.githubusercontent.com/konsoletyper/teavm/0.16.0/classlib/src/main/java
JAVAC_REPO=https://raw.githubusercontent.com/konsoletyper/teavm-javac/199bed0c353d944b8107b517fc1893c86afb83c2

mkdir -p "$WORK"/{upstream,jars,src,rt,patched,sdkin,tools,emu}
cd "$WORK"
echo "work dir: $WORK"

# 1. upstream playground assets, pinned by hash
fetch() { curl -sSfL --retry 3 -o "$2" "$1"; }
check() { echo "$2  $1" | shasum -a 256 -c - >/dev/null || { echo "hash mismatch: $1 (upstream changed?)"; exit 1; }; }
for f in compiler.wasm compiler.wasm-runtime.js compiler.wasm-deobfuscator.wasm compile-classlib-teavm.bin runtime-classlib-teavm.bin; do
  [ -f "upstream/$f" ] || fetch "$PLAYGROUND/$f" "upstream/$f"
done
check upstream/compiler.wasm 7f3828e4b7bddf5504dadebfc4016e40f4441e15ee0519071781813ba2ed3a4c
check upstream/compiler.wasm-runtime.js 9ff6a6771f698be00ab9d5c7b46d904350a8d4115dc0b409553f31ed66688a55
check upstream/compiler.wasm-deobfuscator.wasm af49c0a76f47a30be2b23a74ffed502717b72019d871566841e66e754e5865e0
check upstream/compile-classlib-teavm.bin e80ae10423a39290c5f20b6bb6da34d21c3ad0a75cd8dbdda4998d2813045e15
check upstream/runtime-classlib-teavm.bin ea670e71967eda93828cb894c1741a8ed2e94b3422eb99cb9eccec0de67daaa8

# 2. compile-time jars (annotations and helpers the classlib refers to), checked against maven's sha1
for a in org/ow2/asm/asm/9.8/asm-9.8 org/teavm/teavm-core/0.16.0/teavm-core-0.16.0 \
         org/teavm/teavm-interop/0.16.0/teavm-interop-0.16.0 org/teavm/teavm-platform/0.16.0/teavm-platform-0.16.0 \
         org/teavm/teavm-jso-impl/0.16.0/teavm-jso-impl-0.16.0 org/teavm/teavm-jso/0.16.0/teavm-jso-0.16.0 \
         org/teavm/teavm-jso-apis/0.16.0/teavm-jso-apis-0.16.0; do
  jar="jars/$(basename "$a").jar"
  [ -f "$jar" ] || fetch "$MAVEN/$a.jar" "$jar"
  [ "$(shasum -a 1 "$jar" | cut -d' ' -f1)" = "$(curl -sSfL "$MAVEN/$a.jar.sha1" | cut -c1-40)" ] || { echo "sha1 mismatch: $jar"; exit 1; }
done
ASM=jars/asm-9.8.jar

# 3. sources: TeaVM 0.16.0 classlib files we patch, teavm-javac's converter + javac bootstrap stubs
for f in java/text/TDecimalFormatSymbols java/util/TFormatter java/lang/TThread; do
  mkdir -p "src/org/teavm/classlib/$(dirname $f)"
  fetch "$TEAVM_SRC/org/teavm/classlib/$f.java" "src/org/teavm/classlib/$f.java"
done
mkdir -p tools/org/teavm/javac
for f in StdlibConverter ArchiveBuilder; do
  fetch "$JAVAC_REPO/compiler/src/main/java/org/teavm/javac/$f.java" "tools/org/teavm/javac/$f.java"
done
for f in invoke/TMethodHandle invoke/TMethodHandles invoke/TMethodType invoke/TStringConcatFactory invoke/TTypeDescriptor \
         runtime/TObjectMethods runtime/TSwitchBootstraps; do
  mkdir -p "emu/src/org/teavm/classlib/java/lang/$(dirname $f)"
  fetch "$JAVAC_REPO/compiler/src/classlibEmu/java/org/teavm/classlib/java/lang/$f.java" "emu/src/org/teavm/classlib/java/lang/$f.java"
done

# 4. patch the runtime classlib
$PY "$HERE/archive.py" extract upstream/runtime-classlib-teavm.bin rt
$PY "$HERE/source_patches.py" src
CP="rt:$(ls jars/teavm-*.jar | tr '\n' ':')"
rm -rf patched && mkdir patched
"$JAVAC" --release 11 -nowarn -proc:none -cp "$CP" -d patched $(find src -name '*.java')
mkdir -p tools/classes
"$JAVAC" -nowarn -cp "$ASM" -d tools/classes "$HERE/JlePatcher.java" tools/org/teavm/javac/*.java
"$JAVA" -cp "tools/classes:$ASM" JlePatcher rt patched
mkdir -p "$OUT"
$PY "$HERE/archive.py" replace upstream/runtime-classlib-teavm.bin patched "$OUT/runtime-classlib-teavm.bin"

# 5. regenerate the javac SDK from the patched runtime classlib
rm -rf sdkin && mkdir -p sdkin emu/classes
$PY "$HERE/archive.py" extract "$OUT/runtime-classlib-teavm.bin" sdkin org/teavm/classlib/,org/threeten/,org/teavm/jso/
"$JAVAC" -nowarn -d emu/classes $(find emu/src -name '*.java')
"$JAVA" -cp "tools/classes:$ASM" org.teavm.javac.StdlibConverter sdk-raw.bin sdkin emu/classes
$PY "$HERE/archive.py" merge-sdk upstream/compile-classlib-teavm.bin sdk-raw.bin "$OUT/compile-classlib-teavm.bin"

# 6. the rest is unchanged
cp upstream/compiler.wasm upstream/compiler.wasm-runtime.js upstream/compiler.wasm-deobfuscator.wasm "$OUT/"
echo "done: $OUT"
(cd "$OUT" && shasum -a 256 *)
