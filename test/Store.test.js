import test from "ava";
import { Store, observable, computed, action } from "../src";
import { Add } from "../src/json";

test("store should throw if given state and action with overlapping key", t => {
  t.throws(() => {
    const store = Store(
      {
        test: "test"
      },
      {
        test() {}
      }
    );
  });
});

test("Store should work with no parameters", t => {
  const store = Store();
  store.test = observable("Test");
  t.is(store.test, "Test");
});

test("Store should allow observables to be accessed as though they are vanilla js objects", t => {
  const store = Store({
    first: observable("Andy"),
    last: observable("Johnson")
  });

  t.is(store.first, "Andy");
  t.is(store.last, "Johnson");
});

test("Store should allow unobserved data access and update like normal", t => {
  const store = Store({
    first: "Andy"
  });
  t.is(store.first, "Andy");
  store.first = "test";
  t.is(store.first, "test");
});

test("Store should replace observable transparently", t => {
  const store = Store({
    first: observable("Andy")
  })
  t.is(store.first, "Andy");
  store.first = observable("Test");
  t.is(store.first, "Test");
  store.first = "boom";
  t.is(store.first, "boom");
});

test("Store should replace computed values transparently", t => {
  const store = Store({
    first: "Andy",
    last: "Johnson",
    fullName: function() {
      return `${this.first} ${this.last}`;
    }
  });
  store.fullName = computed(function() {
    return `${this.first} ${this.first}`;
  }, store);

  t.is(store.fullName, "Andy Andy");
});

test("Store should return undefined when trying to access key that has not been set", t => {
  const store = Store({});
  t.is(store.test, undefined);
});

test("Store should work with delete", t => {
  const store = Store({
    first: observable("Andy"),
    last: observable("Johnson"),
    fullName() {
      return `${this.first} ${this.last}`;
    },
    unob: "test"
  });
  t.is(store.first, "Andy");
  t.is(store.last, "Johnson");
  t.is(store.fullName, "Andy Johnson");
  t.is(store.unob, "test");
  delete store.last;
  delete store.first;
  delete store.fullName;
  delete store.unob;
  t.is(store.first, undefined);
  t.is(store.last, undefined);
  t.is(store.fullName, undefined);
  t.is(store.unob, undefined);
});

test("Store should throw if you try to delete non-existent key", t => {
  const store = Store({});
  t.throws(() => {
    delete store.boom;
  });
});

test("Store should allow updating observable and unobservable values transparently", t => {
  const store = Store({
    test: observable("test"),
    unob: "123"
  });
  t.is(store.test, "test");
  t.is(store.unob, "123");
  store.test = observable("foobar");
  t.is(store.test, "foobar");
  store.test = "boom";
  t.is(store.test, "boom");
  store.unob = "456";
  t.is(store.unob, "456");
});

test("Store actions should be able to mutate state", t => {
  const store = Store(
    {
      count: 0
    },
    {
      increment: action(function() {
        this.count++;
      })
    }
  );
  store.increment();
  t.is(store.count, 1);
});

test("Store should only iterate observable, computed, and pojo non-function keys", t => {
  const store = Store(
    {
      a: "a",
      b: observable("b"),
      c: function() {
        return `${this.a} + ${this.b}`;
      }
    },
    {
      d: action(function() {}),
      e: () => {}
    }
  );
  let valid = true;
  for (let prop in store) {
    if (prop === "d" || prop === "e") {
      valid = false;
    }
  }
  t.is(valid, true);
});

test("Store should allow observable to be set to undefined", t => {
  const store = Store({ a: observable("a") });
  store.a = undefined;
  t.is(store.a, undefined);
});

test("Store should automatically provide this context to computed values", t => {
  const store = Store({
    a: "a",
    b: observable("b"),
    c: function() {
      return `${this.a} + ${this.b}`;
    }
  });
  t.is(store.c, "a + b");
});

test("Store in operator on pojo/observable/computed/store values only", t => {
  const store = Store(
    {
      a: "a",
      b: observable("b"),
      c: function() {
        return `${this.a} + ${this.b}`;
      }
    },
    {
      d: action(() => {}),
      e: () => {}
    }
  );
  t.is("a" in store, true);
  t.is("b" in store, true);
  t.is("c" in store, true);
  t.is("d" in store, false);
  t.is("e" in store, false);
  t.is("f" in store, false);
  t.is("__type" in store, false);
  t.is("snapshot" in store, false);
  t.is(store.__type, 2);
  t.is(typeof store.snapshot, "object");
});

test("Store snapshots", t => {
  const store = Store(
    {
      a: "a",
      b: observable("b"),
      c: function() {
        return `${this.a} + ${this.b}`;
      }
    },
    {
      d: action(() => {}),
      e: () => {}
    }
  );
  const snap = store.snapshot;
  t.deepEqual(snap, { a: "a", b: "b" });
  store.restore({ a: "b", b: "a" });
  const snap2 = store.snapshot;
  t.deepEqual(snap2, { a: "b", b: "a" });
});

test("Store should allow register and unregister for patch emissions", t => {
  const store = Store({
    test: observable("test")
  });
  let count = 0;
  const patchHandler = patches => {
    count++;
  };
  store.register(patchHandler);
  store.register(patchHandler);
  store.test = "test123";
  store.unregister(patchHandler);
  store.unregister(patchHandler);
  t.is(count, 1);
});

test("Store should allow explicitly provided nested stores", t => {
  const store1 = Store(
    {
      test: "stuff"
    },
    {},
    ["nested"]
  );
  const store = Store({
    nested: store1
  });
  t.deepEqual(store.snapshot, { nested: { test: "stuff" } });
  store.restore({ nested: { test: "test" } });
  t.deepEqual(store.snapshot, { nested: { test: "test" } });
});

test("Store should apply patches", t => {
  const store = Store({ test: "test" });
  const patches = [Add(["test"], "test123")];
  store.patch(patches);
  t.is(store.test, "test123");
});
