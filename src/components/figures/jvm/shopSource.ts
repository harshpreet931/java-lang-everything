// the program behind <ClassLifecycle>, exactly as it was compiled and run on jdk 25.
export const SHOP_SOURCE = `class Base {
    static { System.out.println("Base <clinit>"); }
}

class Price extends Base {
    static int tax = 18;
    static { System.out.println("Price <clinit>"); }
}

public class Shop {
    public static void main(String[] args) {
        System.out.println("main starts");
        Price[] none = new Price[2];
        System.out.println("made an array");
        System.out.println("tax = " + Price.tax);
    }
}`;
