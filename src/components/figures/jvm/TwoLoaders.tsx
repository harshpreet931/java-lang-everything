// same bytes, two loaders, two classes. the loader hashes are from the real run
// on jdk 25 (they change every run): the ClassCastException message printed
//   class Greeter cannot be cast to class Greeter (Greeter is in unnamed module of loader
//   java.net.URLClassLoader @71809907; Greeter is in unnamed module of loader java.net.URLClassLoader @158da8e)

const col = (hash: string, label: string, obj: boolean) => (
  <div className="flex min-w-0 flex-col items-stretch gap-0">
    <div className="rounded-md bg-well px-3 py-2 text-12 shadow-[inset_0_0_0_1px_var(--meta)]">
      <div className="text-meta">URLClassLoader</div>
      <div className="text-11 text-faint">@{hash}</div>
    </div>
    <div className="mx-auto h-6 w-px bg-line-2" aria-hidden />
    <div className="rounded-md bg-well px-3 py-2 text-12 shadow-[inset_0_0_0_1px_var(--line-2)]">
      <div className="text-hi">class Greeter</div>
      <div className="text-11 text-faint">{label}</div>
    </div>
    <div className="mx-auto h-6 w-px bg-line-2" aria-hidden />
    {obj ? (
      <div className="rounded-md bg-well px-3 py-2 text-12 shadow-[inset_0_0_0_1px_var(--line-2)]">
        <div className="flex items-center gap-1.5 text-ref">
          <span className="size-[7px] rounded-full bg-ref" aria-hidden />a Greeter object
        </div>
        <div className="text-11 text-faint">a.isInstance(it): true</div>
      </div>
    ) : (
      <div className="rounded-md px-3 py-2 text-12 shadow-[inset_0_0_0_1px_var(--dead)]">
        <div className="text-dead">b.cast(that object)</div>
        <div className="text-11 text-faint">b.isInstance(it): false</div>
      </div>
    )}
  </div>
);

export function TwoLoaders() {
  return (
    <div className="font-mono" role="img" aria-label="one Greeter.class file, loaded by two URLClassLoaders, becomes two different classes; an object of the first is not an instance of the second">
      <div className="mx-auto w-fit rounded-md bg-well px-4 py-2 text-center text-12 shadow-[inset_0_0_0_1px_var(--line-2)]">
        <div className="text-hi">Greeter.class</div>
        <div className="text-11 text-faint">one file, same bytes</div>
      </div>
      <div className="mx-auto h-3 w-px bg-line-2" aria-hidden />
      <div className="mx-auto grid max-w-[560px] grid-cols-2">
        <div className="ml-auto h-6 w-1/2 border-t border-l border-line-2" aria-hidden />
        <div className="mr-auto h-6 w-1/2 border-t border-r border-line-2" aria-hidden />
        <div className="pr-2">{col("71809907", "a: (Greeter, loader a)", true)}</div>
        <div className="pl-2">{col("158da8e", "b: (Greeter, loader b)", false)}</div>
      </div>
      <p className="mx-auto mt-4 max-w-[560px] text-center text-12 text-mute">
        a.getName().equals(b.getName()) <span className="text-live">true</span> · a == b <span className="text-dead">false</span>
      </p>
    </div>
  );
}
