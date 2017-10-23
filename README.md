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
    updateData: action(function(firstName, lastName, count) {
      this.counter = count;
      this.first = firstName;
      this.last = lastName;
    })
  }
);

// transparently adds and removes values to the proxied observable store...
store.test = "123"; // default sets an unobserved value
store.test2 = observable("456"); // explicitly set observable value
store.updateTest2 = action(function(val) { this.test2 = val; });
store.asyncUpdate = () => {
  // you can do whatever async code you like in a normal function
  // when you are ready to update your store's data simply call a sync action
  setTimeout(() => {
    this.updateTest2("pretend I fetched this from a DB/http req");
  }, 3000);
};

// equivalent to mobx autorun...
autorun(() => {
  console.log(store.fullName);
});

autorun(() => {
  console.log(store.fullCount);
});

// you can register to receive json patches
const fn = (patches) => console.log(patches);
store._register(fn);
// you can also unregister from the patch stream...
store._unregister(fn);

// actions are "atomic" in in that the changes are batched like actions in mobx...
// so autorun is de-glitched and guaranteed to not be stale...
store.updateData("Jon", "Doe", 10);

// you can retrieve the current snapshot of a store
// includes all observed/unobserved data and nested stores, skips computed/actions...
// haven't decided what to do with functions observed/unobserved stored in the tree...
// we could fn.toString() in snapshot/patch and in apply eval(strFn)...  but I'm hesitant to do so...
let snap = store._snapshot;

// will log all keys excluding actions and functions...
for (let v in store) {
  console.log(`${v}: ${v in store}`);
}

store._dispose()); // disposes of observables and delete's all keys for this store and all nested stores...

```

## License

post-js is MIT licensed. See [LICENSE](LICENSE.md).

