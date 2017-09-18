# post-js (Proxied Observable State Tree)
This is a minimalist re-implementation of mobx-state-tree using s-js and fast-json-patch.  Currently this package itself is approx. 1kB min-zipped, deps: s-js(2kB), fast-json-patch(4kB) ~= 7kB vs mobx-state-tree (29kB).  The other benefit would be the performance of s-js, if you compare react / react-mobx to vanilla / surplus(backed by s-js) in the [js-framework-benchmark](https://rawgit.com/krausest/js-framework-benchmark/master/webdriver-ts-results/table.html)

![js-framework-perf screenshot](https://github.com/andyrj/post-js/raw/master/Screenshot-20170917.png "Rough State Management Overhead Comparison")
Eventually I will make a better performance comparison between this library and mobx-state-tree but the above screenshot should give you a rough idea of the difference that should be expected in memory use and compute overhead.

This package utilizes Proxy, to create a "transparent" pojo-ish wrapper for s-js, so ie and opera mini are unsupported.

The main thing this package does not plan to have support for that is in mobx-state-tree would be the runtime type system.

* NOTE: snapshot/patch/restore type functionality are not yet added, but will be shortly... (will be adding example youtube video of redux-devtools integrating with this library once that these are added)

Install
```
$ npm install --save post-js
```

```js
import Store, { autorun } from "post-js"

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

// actions are "atomic" in in that the changes are batched like actions in mobx...
store.updateData("Jon", "Doe", 10);

// will log all keys excluding actions
for (let v in store) {
  console.log(`${v}: ${v in store}`);
}

store("dispose"); // disposes of observables and delete's all keys for this store and all nested stores...

```

## License

post-js is MIT licensed. See [LICENSE](LICENSE.md).

