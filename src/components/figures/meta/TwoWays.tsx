"use client";

import { useState } from "react";
import { Row, Words } from "./kit";

// mapstruct vs lombok, side by side. both outputs are real: mapstruct 1.6.3 and lombok
// 1.18.48 run with javac 25. CarMapperImpl.java is trimmed (the @Generated header);
// Person.class is `javap -p` output. lombok's Unsafe warning is the one javac printed.

type Tool = "mapstruct" | "lombok";

function Box({ title, sub, tone, children }: { title: string; sub: string; tone?: "hot" | "live" | "meta"; children: React.ReactNode }) {
  return (
    <div
      className="min-w-0 rounded-md bg-well px-3 py-2.5"
      style={{ boxShadow: `inset 0 0 0 1px ${tone ? `var(--${tone})` : "var(--line-2)"}` }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-12 text-hi">{title}</span>
        <span className="text-11" style={{ color: tone ? `var(--${tone})` : "var(--faint)" }}>
          {sub}
        </span>
      </div>
      <pre className="mt-1.5 overflow-x-auto text-11 leading-[1.6] whitespace-pre text-ink">{children}</pre>
    </div>
  );
}

const Arrow = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 py-1 pl-3 text-11 text-faint">
    <span className="text-ref">↓</span>
    {label}
  </div>
);

export function TwoWays() {
  const [tool, setTool] = useState<Tool>("mapstruct");

  return (
    <div>
      <Row k="tool =" w="7ch">
        <Words options={[{ v: "mapstruct", label: "mapstruct (by the rules)" }, { v: "lombok", label: "lombok (around them)" }]} value={tool} onChange={setTool} label="tool" />
      </Row>

      {tool === "mapstruct" ? (
        <div className="mt-4 flex flex-col">
          <Box title="CarMapper.java" sub="you wrote this">
            {`@Mapper
public interface CarMapper {
    @Mapping(target = "seatCount", source = "numberOfSeats")
    CarDto toDto(Car car);
}`}
          </Box>
          <Arrow label="MappingProcessor reads it through javax.lang.model (public API), round 1" />
          <Box title="gen/CarMapperImpl.java" sub="a new file" tone="hot">
            {`public class CarMapperImpl implements CarMapper {
    @Override
    public CarDto toDto(Car car) {
        if ( car == null ) {
            return null;
        }
        int seatCount = 0;
        String make = null;
        seatCount = car.numberOfSeats();
        make = car.make();
        CarDto carDto = new CarDto( make, seatCount );
        return carDto;
    }
}`}
          </Box>
          <Arrow label="compiled in round 2 like any other source file" />
          <Box title="target/classes" sub="nothing hidden" tone="live">
            {`CarMapper.class  CarMapperImpl.class  Car.class  CarDto.class`}
          </Box>
        </div>
      ) : (
        <div className="mt-4 flex flex-col">
          <Box title="Person.java" sub="you wrote this">
            {`@Getter
public class Person {
    private String name;
    private int age;
}`}
          </Box>
          <Arrow label="lombok casts javac's environment to its internal class and grabs the syntax tree" />
          <Box title="javac's in-memory AST (com.sun.tools.javac.tree)" sub="edited in place" tone="meta">
            <span>{`JCClassDecl Person
├── JCVariableDecl name
├── JCVariableDecl age
`}</span>
            <span className="text-hot">{`├── JCMethodDecl getName()   ← injected
└── JCMethodDecl getAge()    ← injected`}</span>
          </Box>
          <Arrow label="javac compiles the modified tree. no source file ever contains getName()" />
          <Box title="javap -p Person" sub="methods with no source" tone="live">
            {`public class Person {
  private java.lang.String name;
  private int age;
  public Person();
  public java.lang.String getName();
  public int getAge();
}`}
          </Box>
          <pre className="mt-3 overflow-x-auto rounded-md px-3 py-2 text-11 leading-[1.6] whitespace-pre text-dead shadow-[inset_0_0_0_1px_var(--line)]">
            {`$ javac -cp lombok-1.18.48.jar --processor-path lombok-1.18.48.jar Person.java
WARNING: A terminally deprecated method in sun.misc.Unsafe has been called
WARNING: sun.misc.Unsafe::objectFieldOffset has been called by lombok.permit.Permit`}
          </pre>
        </div>
      )}

      <p className="mt-4 min-h-[5em] font-serif text-17 leading-[1.6] text-ink" aria-live="polite">
        {tool === "mapstruct"
          ? "the processor API lets you create new files and nothing else. mapstruct turns your interface into an implementation you can open, read and step through in a debugger. a typo in a property name is a compile error, not a runtime surprise."
          : "the public API can't modify Person. so lombok reaches past it into javac's private classes and rewrites the tree before bytecode is generated. getting in now takes sun.misc.Unsafe, which is why javac 25 prints that warning, and why a new JDK usually needs a new lombok release."}
      </p>
    </div>
  );
}
