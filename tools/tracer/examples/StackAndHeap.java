public class StackAndHeap {
    static class Point {
        int x;
        int y;

        Point(int x, int y) {
            this.x = x;
            this.y = y;
        }
    }

    static void moveRight(Point p, int dx) {
        p.x = p.x + dx;
    }

    public static void main(String[] args) {
        int count = 3;
        double ratio = 1.5;
        String name = "origin";
        int[] scores = {90, 75, 60};
        Point p = new Point(1, 2);
        moveRight(p, count);
        System.out.println(name + " moved to " + p.x);
        p = new Point(10, 20);
        scores[0] = 100;
        System.out.println("done");
    }
}
