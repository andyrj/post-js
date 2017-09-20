import test from "ava";
import { Store, autorun } from "../src/store";

test("basic first level stores", t => {
  const store = Store(
    {
      test: "123",
      foo: "BAR",
      test1: null,
      sym: Symbol(),
      b: true,
      u: undefined
    },
    {}
  );

  t.is(store.test, "123");
  t.is(store.foo, "BAR");

  store.test = "321";
  t.is(store.test, "321");

  store.foo = "fizzbuzz";
  t.is(store.foo, "fizzbuzz");

  t.is(store.test1, null);
  t.is(typeof store.sym === "symbol", true);
  t.is(store.b, true);
  t.is(store.u, undefined);
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

test("throws on invalid store action types", t => {
  const store = Store({}, {});
  t.throws(() => store("foobar"));
});

test("replace data with store after init", t => {
  const store = Store({ test: "123" });
  t.is(store.test, "123");
  store.test = { foo: "BAR" };
  t.is(store.test.foo, "BAR");
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

test("arrays should not mutate immediately in actions", t => {
  const init = [1, 2, 3];
  const store = Store(
    {
      arr: [1, 2, 3]
    },
    {
      doSplice() {
        this.arr.splice(0, 0, 0);
        let res = true;
        this.arr.forEach((v, i) => {
          if (v !== init[i]) {
            res = false;
          }
        });
        t.is(res, true);
      }
    }
  );

  store.doSplice();
  t.is(store.arr[0], 0);
});

test("default values for Store arguments", t => {
  const store = Store();
  store.test = 0;
  t.is(store.test, 0);
});

test("set computed to string should work", t => {
  const store = Store();
  store.first = "Andy";
  store.last = "Johnson";
  store.fullName = function() {
    return `${this.first} ${this.last}`;
  };
  store.fullName = "Test";
  t.is(store.fullName, "Test");
});

test("set store to string should work", t => {
  const store = Store();
  store.nested = { foo: "BAR" };
  store.nested = "fizzbuzz";
  t.is(store.nested, "fizzbuzz");
});
