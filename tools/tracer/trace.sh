#!/usr/bin/env bash
# usage: tools/tracer/trace.sh path/to/Main.java [--max-steps N] [--include-statics] [--hide-args] > Main.trace.json
# needs a JDK 21+ (set JAVA_HOME, or have java on PATH). see README.md.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -n "${JAVA_HOME:-}" ]]; then
  java="$JAVA_HOME/bin/java"
else
  java="$(command -v java || true)"
fi
if [[ -z "$java" || ! -x "$java" ]]; then
  echo "trace.sh: no java found. set JAVA_HOME to a JDK 21+" >&2
  exit 2
fi

# source-launcher mode: Tracer.java is compiled in memory on every run (about a second), no build step
exec "$java" --add-modules jdk.jdi "$here/Tracer.java" "$@"
