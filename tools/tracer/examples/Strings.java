public class Strings {
    public static void main(String[] args) {
        String a = "hi";
        String b = "hi";
        String c = new String("hi");
        System.out.println(a == b);
        System.out.println(a == c);
        System.out.println(a.equals(c));

        String d = a + " there";
        String e = c.intern();
        System.out.println(d + " " + (a == e));
    }
}
