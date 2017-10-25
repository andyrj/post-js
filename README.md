# post-js (Proxied Observable State Tree)
[![npm version](https://badge.fury.io/js/post-js.svg)](https://badge.fury.io/js/post-js)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/35f30cca20ad498f9da397cdb8e3c2bf)](https://www.codacy.com/app/andyrjohnson82/post-js?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=andyrj/post-js&amp;utm_campaign=Badge_Grade)
[![Codacy Badge](https://api.codacy.com/project/badge/Coverage/35f30cca20ad498f9da397cdb8e3c2bf)](https://www.codacy.com/app/andyrjohnson82/post-js?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=andyrj/post-js&amp;utm_campaign=Badge_Coverage)
[![Build Status](https://travis-ci.org/andyrj/post-js.svg?branch=master)](https://travis-ci.org/andyrj/post-js)

*WIP* This aims to be a a minimalist re-implementation of mobx-state-tree.

PENDING:
1. JSON ref - to emulate graph with state tree
2. finish observable array and patch emission code
3. get test coverage back to 100/100 with change back to implicit observable state with escape hatch via. unobserved(val) 

This package utilizes Proxy, to create a "transparent" pojo-ish observable state tree.

The main thing this package does not plan to have support for that is in mobx-state-tree would be the runtime type system.

Install
```
$ npm install --save post-js
```

```js
import { Store, autorun } from "post-js"

const store = Store(
  { // state: first param
    counter: 0, // by default primitives will be made observable
    first: "Andy",
    last: "Johnson",
    list: [1,2,3,4,5], // array mutable methods are wrapped via proxy to maintain observability...
    fullName() { // methods passed to state are computed values
      return `${this.first} ${this.last}`;
    },
    fullCount() {
      return `${this.fullName}: ${this.counter}`;
    }
  },
  { // actions: second param to store is the actions object, all keys will be either 
    //functions (allowing for async) or actions, they will all be bind(store), or action.context(store) automatically...
    updateData: action(function(firstName, lastName, count) {
      this.counter = count;
      this.first = firstName;
      this.last = lastName;
    })
  }
);

// transparently adds and removes values to the proxied observable store...
store.test = "123"; // default creates an observable value
store.test2 = unobserved("456"); // escape hatch for unobserved values
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

