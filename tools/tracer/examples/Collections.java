import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class Collections {
    public static void main(String[] args) {
        List<String> names = new ArrayList<>();
        names.add("ada");
        names.add("linus");
        names.add("grace");
        names.remove("linus");

        Map<String, Integer> ages = new HashMap<>();
        ages.put("ada", 36);
        ages.put("grace", 85);
        int age = ages.get("ada");
        ages.put("ada", age + 1);

        System.out.println(names + " " + ages);
    }
}
