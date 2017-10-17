import test from "ava";
import {
  Add,
  Remove,
  Replace,
  Move,
  Copy,
  Test,
  apply
} from "../src/json";

test("Add outputs proper json patch add op", t => {
  const expected = { op: "add", path: "/a/b/c", value: "test" };
  t.deepEqual(Add(["a", "b", "c"], "test"), expected);
});

test("Remove outputs proper json patch remove op", t => {
  const expected = { op: "remove", path: "/a/b/c" };
  t.deepEqual(Remove(["a", "b", "c"]), expected);
});

test("Replace outputs proper json patch replace op", t => {
  const expected = { op: "replace", path: "/a/b/c", value: "test" };
  t.deepEqual(Replace(["a", "b", "c"], "test"), expected);
});

test("Move outputs proper json patch move op", t => {
  const expected = { op: "move", path: "/a/b/c", from: "/d/e/f" };
  t.deepEqual(Move(["d", "e", "f"], ["a", "b", "c"]), expected);
});

test("Copy outputs proper json patch copy op", t => {
  const expected = { op: "copy", path: "/a/b/c", from: "/d/e/f" };
  t.deepEqual(Copy(["d", "e", "f"], ["a", "b", "c"]), expected);
});

test("Test outputs proper json patch test op", t => {
  const expected = { op: "test", path: "/a/b/c", value: "test" };
  t.deepEqual(Test(["a", "b", "c"], "test"), expected);
});

test("apply should properly add", t => {
  const expected = {
    a: {
      b: {
        c: "test"
      }
    }
  };
  const initial = {
    a: {
      b: {}
    }
  };
  apply(initial, [Add(["a", "b", "c"], "test")]);
  t.deepEqual(initial, expected);
});

test("apply should properly add to array", t => {
  const expected = {
    a: {
      b: {
        c: [1, 2, 3]
      }
    }
  };
  const initial = {
    a: {
      b: {
        c: [1, 3]
      }
    }
  };
  apply(initial, [Add(["a", "b", "c", 1], 2)]);
  t.deepEqual(initial, expected); 
  t.is(apply(initial, [Add(["a", "b", "c", "d"], 3)]), false);
});

test("apply should properly remove", t => {
  const expected = {
    a: {
      b: {}
    }
  };
  const initial = {
    a: {
      b: {
        c: "test"
      }
    }
  };
  apply(initial, [Remove(["a", "b", "c"])]);
  t.deepEqual(initial, expected);
});

test("apply should properly remove from array", t => {
  const expected = {
    a: {
      b: {
        c: [1, 3]
      }
    }
  };
  const initial = {
    a: {
      b: {
        c: [1, 2, 3]
      }
    }
  };
  apply(initial, [Remove(["a", "b", "c", 1])]);
  t.deepEqual(initial, expected);
  t.is(apply(initial, [Remove(["a", "b", "c", "d"])]), false);
});

test("apply should properly replace", t => {
  const initial = {
    a: {
      b: {
        c: "test"
      }
    }
  };
  const expected = {
    a: {
      b: {
        c: "test1"
      }
    }
  };
  apply(initial, [Replace(["a", "b", "c"], "test1")]);
  t.deepEqual(initial, expected);
});

test("apply should properly move", t => {
  const initial = {
    a: {
      b: {
        c: "test"
      }
    }
  };
  const expected = {
    a: {
      b: {
        d: "test"
      }
    }
  };
  apply(initial, [Move(["a", "b", "c"], ["a", "b", "d"])]);
  t.deepEqual(initial, expected);
});

test("apply should properly copy", t => {
  const initial = {
    a: {
      b: {
        c: "test"
      }
    }
  };
  const expected = {
    a: {
      b: {
        c: "test",
        d: "test"
      }
    }
  };
  apply(initial, [Copy(["a", "b", "c"], ["a", "b", "d"])]);
  t.deepEqual(initial, expected);
});

test("apply should properly test", t => {
  const initial = {
    a: {
      b: {
        c: "test",
        d: ["1", "2", "3"],
        e: {},
        f: {
          g: {
            h: "test"
          }
        }
      }
    }
  };
  t.is(apply(initial, [Test(["a", "b", "c"], "test")]), true);
  t.is(apply(initial, [Test(["a", "b", "c"], "test1")]), false);
  t.is(apply(initial, [Test(["a", "b", "d"], ["1", "2", "3"])]), true);
  t.is(apply(initial, [Test(["a", "b", "d"], ["1", "2"])]), false);
  t.is(apply(initial, [Test(["a", "b", "d"], ["1", "2", "4"])]), false);
  t.is(apply(initial, [Test(["a", "b", "d"], 0)]), false);
  t.is(apply(initial, [Test(["a", "b", "e"], {})]), true);
  t.is(apply(initial, [Test(["a", "b", "e"], {boom: true})]), false);
  t.is(apply(initial, [Test(["a", "b", "f"], {g: { h: "test" }})]), true);
  t.is(apply(initial, [Test(["a", "b", "f"], {g: { h: "boom" }})]), false);
});

test("invalid patches should cause apply to throw", t => {
  t.throws(() => {
    apply({}, [{test: "woops"}]);
  });
  t.throws(() => {
    apply({}, [{op: "add", test: "woops"}]);
  });
  t.throws(() => {
    apply({}, [{op: "woops"}]);
  });
});
