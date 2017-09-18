import test from "ava";
import { Store, autorun } from "../src/store";

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

test("delete data", t => {
  const store = Store({ test: 1 }, {});
  t.is(store.test, 1);
  delete store["test"];
  t.is(store.test, undefined);
  t.throws(() => (store.test = 0));
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

test("add action after init", t => {
  const store = Store({ counter: 0 }, {});
  store("action", "increment", function() {
    this.counter = this.counter + 1;
  });

  t.is(store.counter, 0);
  store.increment();
  t.is(store.counter, 1);
});

test("delete action", t => {
  const store = Store({ counter: 0 }, {});
  store("action", "increment", function() {
    this.counter = this.counter + 1;
  });

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

test("throws on invalid store action types", t => {
  const store = Store({}, {});
  t.throws(() => store("foobar"));
});

test("unobserved data", t => {
  const store = Store({}, {});
  store("data", "test", 1, { observed: false });
  t.is(store.test, 1);
  store.test = 2;
  t.is(store.test, 2);
});

test("for..in returns proper keys (computed,observed,unobserved)", t => {
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

  t.is("counter" in store, true);
  t.is("fullName" in store, true);
  t.is("increment" in store, false);

  const keys = [];
  for (let k in store) {
    keys.push(k);
  }
  t.is(keys.indexOf("increment") === -1, true);
});

test("throw if set computed", t => {
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
  t.throws(() => (store.fullName = "Boom"));
});

test("throw if set subStore directly", t => {
  const store = Store(
    {
      nested: {
        foo: "BAR"
      }
    },
    {}
  );

  t.throws(() => (store.nested = {}));
});

test("observable arrays", t => {
  const store = Store(
    {
      arr: [1, 2, 3, 4]
    },
    {}
  );
  store.arr.push(5);
  let result = true;
  for (let i = 0; i < 5; i++) {
    if (store.arr[i] !== i + 1) {
      result = false;
    }
  }
  t.is(result, true);
});

test("key conflicts throw", t => {
  const store = Store({ test: 1 }, {});
  t.throws(() => store("action", "test", function(){})); // eslint-disable-line
});

test("autorun", t => {
  const store = Store({ test: 1 }, {});
  let count = 0;
  autorun(() => {
    const t = store.test;
    count++;
  });
  t.is(count, 1);
  store.test = 2;
  t.is(count, 2);
});

test("allows subStore to be added with no state or actions", t => {
  const store = Store({}, {});
  store("store", "test", {});
  t.is(typeof store.test === "function", true);
});

test("init state", t => {
  const store = Store(
    {
      str: "test",
      arr: [1],
      nested: {
        test: 1
      },
      comp: function() {
        return `${this.str}-${this.arr[0]}`;
      }
    },
    {}
  );
  store("data", "after", [2]);
  t.is(store.arr[0], 1);
  t.is(store.str, "test");
  t.is(store.comp, "test-1");
  t.is(store.nested.test, 1);
});
