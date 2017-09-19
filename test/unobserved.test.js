import test from "ava";
import { Store, autorun } from "../src/store";

test("unobserved data", t => {
  const store = Store({}, {});
  store("data", "test", 1, { observed: false });
  t.is(store.test, 1);
  store.test = 2;
  t.is(store.test, 2);
});

test("replace unobserved function", t => {
  const f1 = () => {};
  const f2 = () => {};
  const store = Store({}, {});
  store("data", "test", f1, { observed: false });
  t.is(store.test, f1);
  store.test = f2;
  t.is(store.test, f2);
});
