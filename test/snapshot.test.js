import test from "ava";
import { Store, autorun } from "../src/store";

test("creates snapshots", t => {
  const store = Store({ test: 1 });
  t.deepEqual(store("snapshot"), { test: 1 });
});
