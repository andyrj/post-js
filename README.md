# post-js (Proxied Observable State Tree)
[![npm version](https://badge.fury.io/js/post-js.svg)](https://badge.fury.io/js/post-js)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/35f30cca20ad498f9da397cdb8e3c2bf)](https://www.codacy.com/app/andyrjohnson82/post-js?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=andyrj/post-js&amp;utm_campaign=Badge_Grade)
[![Codacy Badge](https://api.codacy.com/project/badge/Coverage/35f30cca20ad498f9da397cdb8e3c2bf)](https://www.codacy.com/app/andyrjohnson82/post-js?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=andyrj/post-js&amp;utm_campaign=Badge_Coverage)
[![Build Status](https://travis-ci.org/andyrj/post-js.svg?branch=master)](https://travis-ci.org/andyrj/post-js)

*WIP* This aims to be a minimalist re-implementation of mobx-state-tree.

PENDING:
1. refactor Store.{regsiter,unregister}, replace with Store.{addEventListener,removeEventListener} and create events for action/patch/restore...
2. get test coverage back to 100/100

This package utilizes Proxy, to create a "transparent" pojo-ish observable state tree.

The main thing this package does not plan to have support for that is in mobx-state-tree would be the runtime type system.

Install
```
$ npm install --save post-js
```

```js
import {
  Store,
  unobserved,
  autorun,
  action,
  computed,
  observable
} from "post-js";

const store = Store(
  { // state: first param
    counter: 0, // by default primitives will be made observable
    first: "Andy",
    last: "Johnson",
    list: [1,2,3,4,5], // array mutable methods are wrapped via proxy to maintain observability...
    fullName(ctx) { // methods passed to state are computed values
      return `${ctx.first} ${ctx.last}`;
    },
    fullCount(ctx) {
      return `${ctx.fullName}: ${ctx.counter}`;
    }
  },
  { // actions: second param to store is the actions object, all keys will be either 
    // functions (allowing for async) or actions, actions will have ctx supplied, so
    // when using an action that first parameter will be removed from your call
    updateData: action((ctx, firstName, lastName, count) => {
      ctx.counter = count;
      ctx.first = firstName;
      ctx.last = lastName;
    }),
    asyncUpdate: (ctx, firstName, lastName, count) => {
      // using setTimeout as an example of some type of async code...
      setTimeout(() => {
        ctx.updateData(firstName, lastName, count);
      }, 3000);
    }
  }
);

// transparently adds and removes values to the proxied observable store...
store.test = "123"; // default creates an observable value
store.test2 = unobserved("456"); // escape hatch for unobserved values
store.updateTest2 = action((ctx, val) => { ctx.test2 = val; });
store.asyncTest2 = () => {
  // you can do whatever async code you like in a normal function
  // when you are ready to update your store's data simply call a sync action
  setTimeout(() => {
    // if add an async action after init, you need to reference
    // your store/nested store instead of relying on context being
    // provided to your function as the first parameter of your function...
    store.updateTest2("pretend I fetched this from a DB/http req");
  }, 3000);
};

// equivalent to mobx autorun...
const fullNameDisposer = autorun(() => {
  console.log(store.fullName);
});

const fullCountDisposer = autorun(() => {
  console.log(store.fullCount);
});

// you can register to receive json patches
const fn = patches => console.log(patches);
store.register(fn);
store.test = "test123"; // will console.log() -> [{ op: "add", path: "/test", value: "test123" }]
// you can also unregister from the patch stream...
store.unregister(fn);

// actions are "atomic" in in that the changes are batched like actions in mobx...
// so autorun is de-glitched and guaranteed to not be stale...
store.updateData("Jon", "Doe", 10);

// you can retrieve the current snapshot of a store
// the snapshot will include all observables/unobserveds for store and all of nested stores
// non-serializable portions of the store such as functions and computed values
// are not included in the snapshot...
console.log(store.snapshot);

// will log all keys excluding actions and functions...
for (let v in store.snapshot) {
  console.log(`${v}: ${v in store}`);
}

fullNameDisposer(); // autoruns can be disposed to remove observable references and prevent further execution
fullCountDisposer();
store.dispose(); // disposes of observables and delete's all keys for this store and all nested stores...

// you can also use the observable primitives directly without the pojo proxy wrapper
const first = observable("Andy");
const last = observable("Johnson");
const counter = observable(0);
const fullName = computed(() => `${first()} ${last()}`);
const fullCount = computed(() => `${fullName()}: ${counter()}`);

const plainFullNameDisposer = autorun(() => {
  console.log(fullName());
});
const plainFullCountDisposer = autorun(() => {
  console.log(fullCount());
});

// unbatched updates
// will trigger autoruns for each statement below...
counter(1);
first("Jon");
last("Doe");

// batched updates via actions
// first param in action needs to be provided as it will be replaced
// with the undefined context and shouldn't be used...
const updateFull = action((ctx, firstName, lastName, count) => {
  first(firstName);
  last(lastName);
  counter(count);
});

// will trigger one run of each of the above active autoruns
updateFull("Andy", "Johnson", 9001);

// you can manually dispose of autoruns and computed values
plainFullNameDisposer();
plainFullCountDisposer();
fullName.dispose();
fullCount.dispose();
```

## License

post-js is MIT licensed. See [LICENSE](LICENSE.md).

