import test from "ava";
import { Store, autorun } from "../src/store";

test("add data via pojo set", t => {
  const store = Store({}, {});
  store.test = 0;
  t.is(store.test, 0);
});

test("add computed via pojo set", t => {
  const store = Store(
    {
      first: "Andy",
      last: "Johnson"
    },
    {}
  );
  store.fullName = function() {
    return `${this.first} ${this.last}`;
  };
  t.is(store.fullName, "Andy Johnson");
});

test("add action via pojo throws", t => {
  const store = Store();
  t.throws(() => {
    store.fizzbuzz = function(stuff) {
      this.foo = stuff;
    };
  });
});

test("add store via pojo set", t => {
  const store = Store();
  store.foo = { test: 1 };
  t.is(store.foo.test, 1);
});

test("allows subStore to be added with no state or actions", t => {
  const store = Store({}, {});
  store("store", "test", {});
  t.is(typeof store.test === "function", true);
});

test("key conflicts throw", t => {
  const store = Store({ test: 1 }, {});
  t.throws(() => store("action", "test", function(){})); // eslint-disable-line
  t.throws(() => store("data", "test", "str"));
  t.throws(() => store("computed", "test", function() {})); // eslint-disable-line
  t.throws(() => store("store", "test", { state: {} }));
});

test("subStore added after init", t => {
  const store = Store({}, {});

  store("store", "test", { state: { foo: "BAR" } });

  t.is(store.test.foo, "BAR");
  store.test.foo = "123";
  t.is(store.test.foo, "123");
});

test("add computed after init", t => {
  const store = Store(
    {
      first: "Andy",
      last: "Johnson"
    },
    {}
  );
  store("computed", "fullName", function() {
    return `${this.first} ${this.last}`;
  });

  t.is(store.fullName, "Andy Johnson");
});

test("add data after init", t => {
  const store = Store({}, {});
  store("data", "test", 1);
  t.is(store.test, 1);
});

test("add action after init", t => {
  const store = Store({ counter: 0 }, {});
  store("action", "increment", function() {
    this.counter = this.counter + 1;
  });

  t.is(store.counter, 0);
  store.increment();
  t.is(store.counter, 1);
});
