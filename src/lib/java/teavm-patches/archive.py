# teavm-javac class library archives (*.bin) are gzip of repeated records:
#   u16 name length, name (utf-8), i32 data length, data
# usage:
#   archive.py extract <archive> <dir> [prefix,prefix,...]   write .class entries to <dir>
#   archive.py replace <archive> <classes dir> <out>          swap in every class under <classes dir>
#   archive.py merge-sdk <original sdk> <regenerated sdk> <out>
#       regenerated entries, but original bytes for the javac bootstrap stubs (java/lang/invoke,
#       java/lang/runtime, module-info), which the converter fix doesn't touch
#   archive.py list <archive>
import gzip
import io
import os
import struct
import sys


def read_archive(path):
    data = gzip.open(path).read()
    p, out = 0, {}
    while p < len(data):
        (n,) = struct.unpack('>h', data[p:p + 2])
        p += 2
        name = data[p:p + n].decode()
        p += n
        (ln,) = struct.unpack('>i', data[p:p + 4])
        p += 4
        out[name] = data[p:p + ln]
        p += ln
    return out


def write_archive(path, entries):
    buf = io.BytesIO()
    for name, data in entries:
        nb = name.encode()
        buf.write(struct.pack('>h', len(nb)))
        buf.write(nb)
        buf.write(struct.pack('>i', len(data)))
        buf.write(data)
    with open(path, 'wb') as f:
        f.write(gzip.compress(buf.getvalue(), compresslevel=9, mtime=0))


def main(argv):
    cmd = argv[1]
    if cmd == 'extract':
        arc, out = read_archive(argv[2]), argv[3]
        keep = tuple(argv[4].split(',')) if len(argv) > 4 else None
        n = 0
        for k, v in arc.items():
            if not k.endswith('.class') or (keep and not k.startswith(keep)):
                continue
            p = os.path.join(out, k)
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, 'wb') as f:
                f.write(v)
            n += 1
        print(f'extracted {n} classes')
    elif cmd == 'replace':
        arc, root, out = read_archive(argv[2]), argv[3], argv[4]
        repl = {}
        for d, _, files in os.walk(root):
            for f in files:
                if f.endswith('.class'):
                    p = os.path.join(d, f)
                    with open(p, 'rb') as fh:
                        repl[os.path.relpath(p, root)] = fh.read()
        missing = [k for k in repl if k not in arc]
        if missing:
            raise SystemExit('not in archive: ' + ', '.join(missing))
        write_archive(out, [(k, repl.get(k, v)) for k, v in arc.items()])
        print(f'replaced {len(repl)} classes')
    elif cmd == 'merge-sdk':
        original, regen, out = read_archive(argv[2]), read_archive(argv[3]), argv[4]
        if set(original) != set(regen):
            raise SystemExit('regenerated sdk has a different class list than the original')
        keep = lambda k: k.startswith(('java/lang/invoke/', 'java/lang/runtime/')) or k == 'module-info.class'
        write_archive(out, [(k, original[k] if keep(k) else v) for k, v in regen.items()])
        changed = sorted(k for k in regen if not keep(k) and regen[k] != original[k])
        print(f'sdk: {len(regen)} entries, {len(changed)} changed: ' + ', '.join(c[:-6] for c in changed))
    elif cmd == 'list':
        for k, v in read_archive(argv[2]).items():
            print(len(v), k)
    else:
        raise SystemExit('unknown command ' + cmd)


if __name__ == '__main__':
    main(sys.argv)
