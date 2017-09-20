import test from "ava";
import { Store, autorun } from "../src/store";

test("creates snapshots", t => {
  const store = Store({ test: 1 });
  t.deepEqual(store("snapshot"), { test: 1 });
});

test("creates snapshots for nested stores", t => {
  const store = Store({ foo: "BAR", nested: { test: 1 } });
  t.deepEqual(store("snapshot"), { foo: "BAR", nested: { test: 1 } });
});

test("generates patches", t => {
  const store = Store({ test: 1 });
  let count = 0;
  function patchHandler(patch) {
    count++;
  }
  store("register", patchHandler);
  store.test = 10;
  t.is(count, 1);
  store("unregister", patchHandler);
  store.test = 1;
  t.is(count, 1);
  t.throws(() => store("unregister", patchHandler));
});
