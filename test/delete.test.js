import test from "ava";
import { Store, autorun } from "../src/store";

test("delete subStore", t => {
  const store = Store({ test: { foo: 0 } }, {});

  t.is(store.test.foo, 0);
  delete store["test"];
  t.throws(() => store.test.foo);
});

test("delete data", t => {
  const store = Store({ test: 1 }, {});
  t.is(store.test, 1);
  delete store["test"];
  t.is(store.test, undefined);
});

test("delete computed", t => {
  const store = Store(
    {
      first: "Andy",
      last: "Johnson",
      fullName() {
        return `${this.first} ${this.last}`;
      }
    },
    {}
  );
  t.is(store.fullName, "Andy Johnson");
  delete store["fullName"];
  t.is(store.fullName, undefined);
});

test("throw when try to delete key not available on store", t => {
  const store = Store({}, {});
  t.throws(() => {
    delete store["test"];
  });
});

test("delete action", t => {
  const store = Store(
    {
      counter: 0
    },
    {
      increment() {
        this.counter = this.counter + 1;
      }
    }
  );

  delete store["increment"];
  t.is(store.increment, undefined);
  t.throws(() => store.increment());
});

test("dispose", t => {
  const store = Store(
    {
      counter: 0,
      first: "Andy",
      last: "Johnson",
      fullName() {
        return `${this.first} ${this.last}`;
      },
      fullCount() {
        return `${this.fullName}: ${this.counter}`;
      }
    },
    {
      increment() {
        this.counter = this.counter + 1;
      }
    }
  );

  t.is(store.fullCount, "Andy Johnson: 0");
  store("dispose");
  t.is(store.fullCount, undefined);
  t.throws(() => store.increment());
});
