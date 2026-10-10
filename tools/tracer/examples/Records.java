public class Records {
    sealed interface Shape permits Circle, Square {}

    record Circle(double radius) implements Shape {}

    record Square(double side) implements Shape {}

    static double area(Shape shape) {
        return switch (shape) {
            case Circle(double r) -> 3 * r * r;
            case Square(double side) -> side * side;
        };
    }

    public static void main(String[] args) {
        Shape a = new Circle(1.5);
        Shape b = new Square(2.0);
        double total = area(a) + area(b);
        System.out.println(a);
        System.out.println("total = " + total);
    }
}
