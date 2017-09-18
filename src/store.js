import S from "s-js";
import * as fastJsonPatch from "fast-json-patch";

function isData(fn) {
  return fn.toString().startsWith("function data(value)");
}

function isComputation(fn) {
  return fn.toString().startsWith("function computation()");
}

const arrayMutators = [
  "splice",
  "push",
  "unshift",
  "pop",
  "shift",
  "copyWithin",
  "reverse"
];

export function Store(state, actions) {
  const store = function() {};
  const stateKeys = [];
  const disposers = {};
  const proxy = new Proxy(store, {
    get: function(target, name) {
      if (name in target) {
        if (typeof target[name] === "function") {
          if (isData(target[name])) {
            let val = target[name]();
            if (Array.isArray(val)) {
              arrayMutators.forEach(key => {
                val[key] = function() {
                  const res = Array.prototype[key].apply(this, arguments);
                  target[name](val);
                  return res;
                };
              });
              return val;
            } else {
              return val;
            }
          } else if (isComputation(target[name])) {
            return target[name]();
          } else {
            return target[name];
          }
        }
      } else {
        if (name in actions) {
          return actions[name];
        } else {
          return undefined;
        }
      }
    },
    set: function(target, name, value) {
      if (name in target) {
        if (typeof target[name] === "function") {
          if (isData(target[name])) {
            target[name](value);
          } else if (isComputation(target[name])) {
            return false;
          }
        } else {
          target[name] = value;
        }
        return true;
      } else {
        // breaking from pojo behavior, changes made through apply
        return false;
      }
    },
    has: function(target, name) {
      // we only want for..in loops to operate on state, not actions...
      if (stateKeys.indexOf(name) > -1) {
        return true;
      } else {
        return false;
      }
    },
    ownKeys: function(target) {
      return Reflect.ownKeys(target).filter(k => {
        return (
          stateKeys.indexOf(k) > -1 ||
          k === "caller" ||
          k === "prototype" ||
          k === "arguments"
        );
      });
    },
    /* eslint-disable complexity */
    apply: function(target, context, args) {
      // function to modify the observable...
      //store("data", "key", value, {observed=false});
      //store("action", "key", fn);
      //store("computed", "key", fn);
      //store("store", "key", {state: {}, actions: {}});
      //store("dispose")
      const t = args[0];
      const key = args[1];
      const val = args[2];
      const opts = args[3];
      switch (t) {
        case "data":
          stateKeys.push(key);
          if (opts && opts.observed === false) {
            target[key] = val;
          } else {
            // default to observable data...
            target[key] = S.data(val);
          }
          break;
        case "action":
          const fn = val;
          target[key] = function() {
            const actionArgs = arguments;
            S.freeze(() => {
              fn.apply(proxy, actionArgs);
            });
          };
          break;
        case "computed":
          stateKeys.push(key);
          const comp = val.bind(proxy);
          S.root(dispose => {
            target[key] = S(comp);
            disposers[key] = dispose;
          });
          break;
        case "store":
          const s = val.state || {};
          const a = val.actions || {};
          target[key] = Store(s, a);
          disposers[key] = () => target[key]("dispose");
          break;
        case "dispose":
          disposers.forEach(key => disposers[key]());
          target.forEach(key => delete target[key]);
          break;
        default:
          throw new RangeError(
            "type must be one of the following: data, dispose, action, computed, store"
          );
      }
      /* eslint-enable complexity */
    },
    deleteProperty: function(target, name) {
      // handle removing observer stuff for this key if needed..
      if (name in target) {
        if (name in disposers) {
          disposers[name]();
        }
        delete target[name];
        return true;
      } else {
        return false;
      }
    }
  });

  // attach data and computations to proxy...
  Object.keys(state).forEach(key => {
    //proxy[key] = state[key];
    const val = state[key];
    const t = typeof val;
    switch (t) {
      case "function":
        // computed
        proxy("computed", key, val);
        break;
      case "object":
        if (!Array.isArray(state[key])) {
          // nested store
          proxy("store", key, { state: val });
          break;
        }
      // fallthrough to add array as data...
      default:
        // add rest as data...
        proxy("data", key, val);
        break;
    }
  });

  Object.keys(actions).forEach(key => {
    proxy("action", key, actions[key]);
  });

  return proxy;
}

/*
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
    updateData(firstName, lastName, count) {
      this.counter = count;
      this.first = firstName;
      this.last = lastName;
    }
  }
);

S.root(() => {
  S(() => {
    console.log(store.fullName);
  });
  S(() => {
    console.log(store.fullCount);
  });
});

// not working right yet...
store.updateData("Jon", "Doe", 10);

// will log all keys excluding actions
for (let v in store) {
  console.log(`${v}: ${v in store}`);
}
*/
