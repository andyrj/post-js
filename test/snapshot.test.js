import test from "ava";

test("creates snapshots", t => {
  const store = store({ test: 1 });
  t.deepEqual(store("snapshot"), { test: 1 });
});
