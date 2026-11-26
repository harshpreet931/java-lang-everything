# third-party notices

java.lang.everything is MIT licensed. some files we ship were made by other people under other licenses. they're listed here, one section per thing. add a section when you add something.

---

## in-browser java compiler (`public/java/teavm/0.16.0-jle1/`)

the "run" button compiles and runs java in your browser with [teavm-javac](https://github.com/konsoletyper/teavm-javac): OpenJDK's `javac` and the [TeaVM](https://teavm.org) compiler, both compiled to WebAssembly. the files come from the teavm-javac playground build at `https://teavm.org/playground/3/` (TeaVM 0.16.0, javac from jdk25u). two of them were patched by us, see "modifications" below.

| file | what it is | license |
| --- | --- | --- |
| `compiler.wasm` | javac + TeaVM, compiled to WasmGC | Apache-2.0 (TeaVM, teavm-javac) and GPL-2.0-only WITH Classpath-exception-2.0 (OpenJDK javac) |
| `compiler.wasm-runtime.js` | TeaVM's JS loader for WasmGC modules | Apache-2.0 |
| `compiler.wasm-deobfuscator.wasm` | TeaVM's stack trace deobfuscator | Apache-2.0 |
| `runtime-classlib-teavm.bin` | TeaVM's java class library (what compiled programs link against) | Apache-2.0, plus the bundled third-party code listed below |
| `compile-classlib-teavm.bin` | API stubs of that class library that javac compiles against | Apache-2.0 |

### TeaVM

- Copyright Alexey Andreev and TeaVM contributors. https://github.com/konsoletyper/teavm
- licensed under the Apache License, Version 2.0: https://www.apache.org/licenses/LICENSE-2.0
- TeaVM's NOTICE file:

  > This product includes software developed by Alexey Andreev (http://teavm.org).
  >
  > This product includes software developed by The Apache Software Foundation (http://www.apache.org/).
  >
  > This product includes software developed by Joda.org (http://www.joda.org/).

### teavm-javac

- Copyright Alexey Andreev. https://github.com/konsoletyper/teavm-javac
- the repository has no LICENSE file at its root (GitHub shows no license). its README says: "This project is licensed under the Apache License 2.0", so we treat it as Apache-2.0.

### OpenJDK javac

- `compiler.wasm` contains the `jdk.compiler` module (javac) from OpenJDK 25 update releases, compiled to bytecode and then to WebAssembly by teavm-javac. no OpenJDK source is shipped in this repo.
- Copyright Oracle and/or its affiliates and OpenJDK contributors.
- licensed under the GNU General Public License, version 2, with the Classpath Exception: https://openjdk.org/legal/gplv2+ce.html
- corresponding source: https://github.com/openjdk/jdk25u, revision `6c48f4ed707bf0b15f9b6098de30db8aae6fa40f` (the revision pinned in teavm-javac's `gradle.properties`), directory `src/jdk.compiler`. teavm-javac's build scripts that turn it into `compiler.wasm` are at https://github.com/konsoletyper/teavm-javac.

### code and data bundled inside TeaVM's class library

`runtime-classlib-teavm.bin` (and the API stubs derived from it) include:

- **ThreeTen-Backport** (`org.threeten.bp`, used for `java.time`). Copyright (c) 2007-present, Stephen Colebourne & Michael Nascimento Santos. All rights reserved. BSD 3-Clause:

  > Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
  >
  > - Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
  > - Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
  > - Neither the name of JSR-310 nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
  >
  > THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

- **JZlib** 1.1.3 (`com.jcraft.jzlib`). Copyright (c) 2000-2011 ymnk, JCraft,Inc. All rights reserved. BSD-style license (https://github.com/ymnk/jzlib/blob/master/LICENSE.txt):

  > Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
  >
  > 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
  > 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
  > 3. The names of the authors may not be used to endorse or promote products derived from this software without specific prior written permission.
  >
  > THIS SOFTWARE IS PROVIDED ``AS IS'' AND ANY EXPRESSED OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL JCRAFT, INC. OR ANY CONTRIBUTORS TO THIS SOFTWARE BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
- **Unicode Character Database and CLDR data** (`UnicodeData.txt`, `cldr-json.zip`, used for `Character` and locale formatting). Copyright Unicode, Inc. Unicode License v3: https://www.unicode.org/license.txt
- **time zone data** (`tz/cache`), derived from the IANA tz database, which is in the public domain: https://www.iana.org/time-zones
- parts of TeaVM's class library derive from Apache Harmony (Apache-2.0, The Apache Software Foundation) and Joda-Time (Apache-2.0, Joda.org), as stated in TeaVM's NOTICE above.

### modifications

per section 4(b) of the Apache License: we changed these files. `compiler.wasm`, `compiler.wasm-runtime.js` and `compiler.wasm-deobfuscator.wasm` are byte-for-byte the upstream files.

- `runtime-classlib-teavm.bin`: 11 classes replaced to fix bugs in that TeaVM build. `DecimalFormatSymbols.clone()` no longer uses the broken WasmGC `Object.clone()` (this fixed every `%f`), `Formatter` supports `%n`, does not let `%%` consume an argument and rounds `%f` half up, `Thread.join()` can no longer hang on a finished thread and unnamed threads are called `Thread-N`, `Math.round` rounds ties toward positive infinity and `Math.log10` uses the platform's `log10`, and `Integer/Long/Float/Double.sum` were added.
- `compile-classlib-teavm.bin`: regenerated from the patched class library with teavm-javac's `StdlibConverter` at commit `199bed0c353d944b8107b517fc1893c86afb83c2` ("apply `@Rename` annotation properly"). without it javac could not see `getMessage()`, `getClass()`, `toString()` and others.

the patches and a script that rebuilds both files from the upstream ones are in `src/lib/java/teavm-patches/`. they are under the same Apache-2.0 license as the files they patch.

---

## fonts

the site self-hosts these from `src/fonts/` through `next/font/local`, each folder with its OFL.txt. `src/fonts/geist-symbols/` holds the full upstream Geist and Geist Mono variable builds, loaded only for arrows and maths signs the latin subsets lack (a `unicode-range` face). the share images use static copies in `src/assets/fonts/` (Redaction 400, Redaction 20 400, Piazzolla 400 italic, Geist Mono 400, Departure Mono 400) with their licences beside them; those copies have the GSUB table removed so the og renderer can read them. none of these fonts declares a reserved font name, so the OFL allows the modified copies.

| font | copyright | license |
| --- | --- | --- |
| [Redaction](https://github.com/jeremymickel/Redaction) (incl. Redaction 20) | Copyright 2019 The Redaction Project Authors | SIL Open Font License 1.1 |
| [Piazzolla](https://github.com/huertatipografica/piazzolla) | Copyright 2018 The Piazzolla Project Authors | SIL Open Font License 1.1 |
| [Geist, Geist Mono, Geist Pixel](https://github.com/vercel/geist-font) | Copyright 2024, 2026 The Geist Project Authors | SIL Open Font License 1.1 |
| [Departure Mono](https://departuremono.com) | Copyright 2022-2024 Helena Zhang | SIL Open Font License 1.1 |

the SIL Open Font License 1.1: https://openfontlicense.org.
