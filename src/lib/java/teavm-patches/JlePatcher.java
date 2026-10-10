import java.nio.file.Files;
import java.nio.file.Path;
import org.objectweb.asm.AnnotationVisitor;
import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassVisitor;
import org.objectweb.asm.ClassWriter;
import org.objectweb.asm.Label;
import org.objectweb.asm.MethodVisitor;
import org.objectweb.asm.Opcodes;
import org.objectweb.asm.Type;

// bytecode patches for TeaVM classlib classes whose snapshot differs from the 0.16.0 tag source,
// so recompiling them from source isn't safe. usage: JlePatcher <classes root in> <classes root out>
public class JlePatcher implements Opcodes {
    static final String LANG = "org/teavm/classlib/java/lang/";

    public static void main(String[] args) throws Exception {
        Path in = Path.of(args[0]);
        Path out = Path.of(args[1]);
        addSum(in, out, "TInteger", "(II)I", ILOAD, 1, IADD, IRETURN);
        addSum(in, out, "TLong", "(JJ)J", LLOAD, 2, LADD, LRETURN);
        addSum(in, out, "TFloat", "(FF)F", FLOAD, 1, FADD, FRETURN);
        addSum(in, out, "TDouble", "(DD)D", DLOAD, 2, DADD, DRETURN);
        patchMath(in, out);
    }

    static byte[] read(Path root, String name) throws Exception {
        return Files.readAllBytes(root.resolve(LANG + name + ".class"));
    }

    static void write(Path root, String name, byte[] data) throws Exception {
        Path p = root.resolve(LANG + name + ".class");
        Files.createDirectories(p.getParent());
        Files.write(p, data);
        System.out.println("patched " + LANG + name);
    }

    // Integer.sum and friends (missing from this TeaVM snapshot, used all the time with streams and Map.merge)
    static void addSum(Path in, Path out, String cls, String desc, int load, int slot, int add, int ret)
            throws Exception {
        ClassReader reader = new ClassReader(read(in, cls));
        ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
        boolean[] exists = { false };
        reader.accept(new ClassVisitor(ASM9, writer) {
            @Override
            public MethodVisitor visitMethod(int access, String name, String d, String sig, String[] ex) {
                if (name.equals("sum") && d.equals(desc)) {
                    exists[0] = true;
                }
                return super.visitMethod(access, name, d, sig, ex);
            }

            @Override
            public void visitEnd() {
                if (!exists[0]) {
                    MethodVisitor mv = super.visitMethod(ACC_PUBLIC | ACC_STATIC, "sum", desc, null, null);
                    mv.visitCode();
                    mv.visitVarInsn(load, 0);
                    mv.visitVarInsn(load, slot);
                    mv.visitInsn(add);
                    mv.visitInsn(ret);
                    mv.visitMaxs(0, 0);
                    mv.visitEnd();
                }
                super.visitEnd();
            }
        }, 0);
        write(out, cls, writer.toByteArray());
    }

    static void patchMath(Path in, Path out) throws Exception {
        String math = LANG + "TMath";
        ClassReader reader = new ClassReader(read(in, "TMath"));
        ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
        reader.accept(new ClassVisitor(ASM9, writer) {
            @Override
            public MethodVisitor visitMethod(int access, String name, String desc, String sig, String[] ex) {
                // dropped here, re-added in visitEnd
                if (name.equals("round") && (desc.equals("(D)J") || desc.equals("(F)I"))) {
                    return null;
                }
                if (name.equals("log10") && desc.equals("(D)D")) {
                    return null;
                }
                return super.visitMethod(access, name, desc, sig, ex);
            }

            @Override
            public void visitEnd() {
                roundDouble(math);
                roundFloat(math);
                log10();
                super.visitEnd();
            }

            // java's Math.round: closest long, ties toward positive infinity, NaN -> 0.
            // TeaVM had (long) (a + signum(a) * 0.5), which gives -3 for -2.5 and 1 for 0.49999999999999994.
            void roundDouble(String owner) {
                MethodVisitor mv = super.visitMethod(ACC_PUBLIC | ACC_STATIC, "round", "(D)J", null, null);
                mv.visitCode();
                Label notNaN = new Label();
                Label done = new Label();
                mv.visitVarInsn(DLOAD, 0);
                mv.visitVarInsn(DLOAD, 0);
                mv.visitInsn(DCMPL);
                mv.visitJumpInsn(IFEQ, notNaN);
                mv.visitInsn(LCONST_0);
                mv.visitInsn(LRETURN);
                mv.visitLabel(notNaN);
                mv.visitFrame(F_NEW, 1, new Object[] { DOUBLE }, 0, new Object[0]);
                mv.visitVarInsn(DLOAD, 0);
                mv.visitMethodInsn(INVOKESTATIC, owner, "floor", "(D)D", false);
                mv.visitVarInsn(DSTORE, 2);
                mv.visitVarInsn(DLOAD, 2);
                mv.visitInsn(D2L);
                mv.visitVarInsn(LSTORE, 4);
                mv.visitVarInsn(DLOAD, 0);
                mv.visitVarInsn(DLOAD, 2);
                mv.visitInsn(DSUB);
                mv.visitLdcInsn(0.5);
                mv.visitInsn(DCMPL);
                mv.visitJumpInsn(IFLT, done);
                mv.visitVarInsn(LLOAD, 4);
                mv.visitLdcInsn(Long.MAX_VALUE);
                mv.visitInsn(LCMP);
                mv.visitJumpInsn(IFEQ, done);
                mv.visitVarInsn(LLOAD, 4);
                mv.visitInsn(LCONST_1);
                mv.visitInsn(LADD);
                mv.visitVarInsn(LSTORE, 4);
                mv.visitLabel(done);
                mv.visitFrame(F_NEW, 3, new Object[] { DOUBLE, DOUBLE, LONG }, 0, new Object[0]);
                mv.visitVarInsn(LLOAD, 4);
                mv.visitInsn(LRETURN);
                mv.visitMaxs(0, 0);
                mv.visitEnd();
            }

            void roundFloat(String owner) {
                MethodVisitor mv = super.visitMethod(ACC_PUBLIC | ACC_STATIC, "round", "(F)I", null, null);
                mv.visitCode();
                Label notNaN = new Label();
                Label done = new Label();
                mv.visitVarInsn(FLOAD, 0);
                mv.visitVarInsn(FLOAD, 0);
                mv.visitInsn(FCMPL);
                mv.visitJumpInsn(IFEQ, notNaN);
                mv.visitInsn(ICONST_0);
                mv.visitInsn(IRETURN);
                mv.visitLabel(notNaN);
                mv.visitFrame(F_NEW, 1, new Object[] { FLOAT }, 0, new Object[0]);
                mv.visitVarInsn(FLOAD, 0);
                mv.visitInsn(F2D);
                mv.visitMethodInsn(INVOKESTATIC, owner, "floor", "(D)D", false);
                mv.visitVarInsn(DSTORE, 1);
                mv.visitVarInsn(DLOAD, 1);
                mv.visitInsn(D2I);
                mv.visitVarInsn(ISTORE, 3);
                mv.visitVarInsn(FLOAD, 0);
                mv.visitInsn(F2D);
                mv.visitVarInsn(DLOAD, 1);
                mv.visitInsn(DSUB);
                mv.visitLdcInsn(0.5);
                mv.visitInsn(DCMPL);
                mv.visitJumpInsn(IFLT, done);
                mv.visitVarInsn(ILOAD, 3);
                mv.visitLdcInsn(Integer.MAX_VALUE);
                mv.visitJumpInsn(IF_ICMPEQ, done);
                mv.visitIincInsn(3, 1);
                mv.visitLabel(done);
                mv.visitFrame(F_NEW, 3, new Object[] { FLOAT, DOUBLE, INTEGER }, 0, new Object[0]);
                mv.visitVarInsn(ILOAD, 3);
                mv.visitInsn(IRETURN);
                mv.visitMaxs(0, 0);
                mv.visitEnd();
            }

            // log10 straight from JS Math.log10 (exact for powers of ten), declared like TMath.sqrt
            void log10() {
                MethodVisitor mv = super.visitMethod(ACC_PUBLIC | ACC_STATIC | ACC_NATIVE, "log10", "(D)D", null, null);
                AnnotationVisitor gen = mv.visitAnnotation("Lorg/teavm/backend/javascript/spi/GeneratedBy;", true);
                gen.visit("value", Type.getObjectType(LANG + "MathNativeGenerator"));
                gen.visitEnd();
                AnnotationVisitor imp = mv.visitAnnotation("Lorg/teavm/interop/Import;", true);
                imp.visit("module", "teavmMath");
                imp.visit("name", "log10");
                imp.visitEnd();
                mv.visitAnnotation("Lorg/teavm/interop/Unmanaged;", true).visitEnd();
                mv.visitEnd();
            }
        }, 0);
        write(out, "TMath", writer.toByteArray());
    }
}
