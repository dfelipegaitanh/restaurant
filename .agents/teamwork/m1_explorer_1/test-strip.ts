interface TestPerson {
  name: string;
  age: number;
}
const p: TestPerson = { name: "Bogota POS", age: 1 };
console.log(`Node 22 Strip Types Works: ${p.name} v${p.age}`);
