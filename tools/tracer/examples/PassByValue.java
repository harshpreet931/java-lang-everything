public class PassByValue {
    static class Box {
        int value;

        Box(int value) {
            this.value = value;
        }
    }

    static void swap(int a, int b) {
        int temp = a;
        a = b;
        b = temp;
    }

    static void fill(Box box) {
        box.value = 99;
    }

    static void replace(Box box) {
        box = new Box(-1);
    }

    public static void main(String[] args) {
        int a = 1;
        int b = 2;
        swap(a, b);
        System.out.println(a + " " + b);

        Box box = new Box(7);
        fill(box);
        replace(box);
        System.out.println(box.value);
    }
}
