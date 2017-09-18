import test from "ava";
import Store, { autorun } from "../src/store";

test("basic first level stores", t => {
  const store = Store(
    {
      test: "123",
      foo: "BAR"
    },
    {}
  );

  t.is(store.test, "123");
  t.is(store.foo, "BAR");

  store.test = "321";
  t.is(store.test, "321");

  store.foo = "fizzbuzz";
  t.is(store.foo, "fizzbuzz");
});

test("nested stores", t => {
  const store = Store(
    {
      test: "123",
      nested: {
        foo: "BAR"
      }
    },
    {}
  );

  t.is(store.test, "123");
  t.is(store.nested.foo, "BAR");

  store.test = "321";
  t.is(store.test, "321");

  store.nested.foo = "fizzbuzz";
  t.is(store.nested.foo, "fizzbuzz");
});

test("actions", t => {
  const store = Store(
    {
      test: 1
    },
    {
      increment: function() {
        this.test++;
      }
    }
  );
  store.increment();
  t.is(store.test, 2);
});

test("subStore added after init", t => {
  const store = Store({}, {});

  store("store", "test", { state: { foo: "BAR" } });

  t.is(store.test.foo, "BAR");
  store.test.foo = "123";
  t.is(store.test.foo, "123");
});

test("delete subStore", t => {
  const store = Store({ test: { foo: 0 } }, {});

  t.is(store.test.foo, 0);
  delete store["test"];
  t.throws(() => store.test.foo);
});

