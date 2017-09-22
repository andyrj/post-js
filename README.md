# post-js (Proxied Observable State Tree)
*WIP* This aims to be a a minimalist re-implementation of mobx-state-tree, currently depending on s-js and fast-json-patch.  I plan to remove these two dependencies as fast-json-patch pulls in some large dependencies, and if I get rid of s-js as a dependency I can get rid of some strange cases where equality gets screwed up storeing state in functions instead of just accessing via proxy.

This package utilizes Proxy, to create a "transparent" pojo-ish wrapper for s-js, so ie and opera mini are unsupported.

The main thing this package does not plan to have support for that is in mobx-state-tree would be the runtime type system.

Working on this is not high on my priorities and I wouldn't suggest anyone use this in any real way, it is still just an experiment.

Install
```
$ npm install --save post-js
```

```js
import { Store, autorun } from "post-js"

const store = Store(
  { // state: first param
    counter: 0, // by default primitives passed in will be made observable
    first: "Andy",
    last: "Johnson",
    list: [1,2,3,4,5], // array mutable methods are wrapped to maintain observability...
    fullName() { // methods passed to state are computed values
      return `${this.first} ${this.last}`;
    },
    fullCount() {
      return `${this.fullName}: ${this.counter}`;
    }
  },
  { // actions: second param to store is the actions object, all keys are turned into actions...
    updateData(firstName, lastName, count) {
      this.counter = count;
      this.first = firstName;
      this.last = lastName;
    }
  }
);

// after instantiation you can update your store via calling it as a function...
store("data", "test", "123");  // this will add the key { test: "123" }, to your stores state...
store("data", "stuff", 0, { observed: false }); // add unobserved data... 
store("action", "updateTest", function(str) { this.test = str; }); // this adds an action to your store
store("computed", "testCount", function() { return `${this.test}: ${this.counter}`; }) // addes computed value
/* nested store - recursive structure... */
store("store", "nested", { 
  state: { foo: "BAR" }, 
  actions: { 
    fizz: function(){ this.foo = "buzz"; } 
    }
  }
);

// equivalent to mobx autorun...
autorun(() => {
  console.log(store.fullName);
});

autorun(() => {
  console.log(store.fullCount);
});

// you can register to receive json patches
const fn = (patches) => console.log(patches);
store("register", fn);
// you can also unregister from the patch stream...
store("unregister", fn);

// actions are "atomic" in in that the changes are batched like actions in mobx...
store.updateData("Jon", "Doe", 10);

// you can retrieve the current snapshot of a store
// includes all observed/unobserved data and nested stores, skips computed/actions...
// haven't decided what to do with functions observed/unobserved stored in the tree...
// we could fn.toString() in snapshot/patch and in apply eval(strFn)...  but I'm hesitant to do so...
let snap = store("snapshot");

// will log all keys excluding actions
for (let v in store) {
  console.log(`${v}: ${v in store}`);
}

store("dispose"); // disposes of observables and delete's all keys for this store and all nested stores...

```

## License

post-js is MIT licensed. See [LICENSE](LICENSE.md).

