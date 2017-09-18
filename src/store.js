import S from "s-js";
import * as fastJsonPatch from "fast-json-patch";

function isKey(name, keys) {
  // inefficient check...  we are storing array of keys for this now...
  //return fn.toString().startsWith("function data(value)");
  return keys.indexOf(name) > -1;
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

export function autorun(thunk) {
  S.root(() => S(thunk));
}

function isKeyConflict(key, store) {
  if (key in store) {
    throw new RangeError(
      `actions: ${key} conflicts with a key already present in state`
    );
  }
}

export default function Store(state, actions) {
  const store = function() {};
  let computedKeys = [];
  let snapKeys = [];
  let subStoreKeys = [];
  let disposers = {};
  const proxy = new Proxy(store, {
    get: function(target, name) {
      if (name in target) {
        if (typeof target[name] === "function") {
          if (isKey(name, snapKeys)) {
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
          } else if (isKey(name, computedKeys)) {
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
          if (isKey(name, snapKeys)) {
            target[name](value);
          } else if (isKey(name, subStoreKeys)) {
            return false; // should I handle replacing a subStore?
          } else if (isKey(name, computedKeys)) {
            return false;
          }
        } else {
          target[name] = value;
        }
        return true;
      } else {
        // breaking from pojo behavior, changes made through apply only
        return false;
      }
    },
    has: function(target, name) {
      // we only want for..in loops to operate on state, not actions...
      if (
        computedKeys.indexOf(name) > -1 ||
        snapKeys.indexOf(name) > -1 ||
        subStoreKeys.indexOf(name) > -1
      ) {
        return true;
      } else {
        return false;
      }
    },
    ownKeys: function(target) {
      return Reflect.ownKeys(target).filter(k => {
        return (
          computedKeys.indexOf(k) > -1 ||
          snapKeys.indexOf(k) > -1 ||
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
      if (key) {
        isKeyConflict(key, store);
      }
      switch (t) {
        case "data":
          snapKeys.push(key);
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
          computedKeys.push(key);
          const comp = val.bind(proxy);
          S.root(dispose => {
            target[key] = S(comp);
            disposers[key] = dispose;
          });
          break;
        case "store":
          subStoreKeys.push(key);
          const s = val.state || {};
          const a = val.actions || {};
          target[key] = Store(s, a);
          disposers[key] = () => {
            console.log(`disposing key ${key}`);
            target[key]("dispose");
          };
          break;
        case "dispose":
          Object.keys(disposers).forEach(key => {
            console.log(`disposing key ${key}`);
            disposers[key]();
          });
          Object.keys(target).forEach(key => {
            console.log(`deleting key ${key}`);
            delete target[key];
          });
          computedKeys = [];
          snapKeys = [];
          subStoreKeys = [];
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
          delete disposers[name];
        }
        delete target[name];
        if (snapKeys.indexOf(name) > -1) {
          snapKeys = snapKeys.filter(key => key !== name);
        }
        if (computedKeys.indexOf(name) > -1) {
          computedKeys = computedKeys.filter(key => key !== name);
        }
        if (subStoreKeys.indexOf(name) > -1) {
          subStoreKeys = subStoreKeys.filter(key => key !== name);
        }
        return true;
      } else {
        return false;
      }
    }
  });

  // attach data and computations to proxy...
  Object.keys(state).forEach(key => {
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
