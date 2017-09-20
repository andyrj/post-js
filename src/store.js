import S from "s-js";
import * as fastJsonPatch from "fast-json-patch";

function isKey(name, keys) {
  // inefficient check...  we are storing array of keys for this now...
  //return fn.toString().startsWith("function data(value)");
  return keys.indexOf(name) > -1;
}

/*
function isArray(arr) {
  return !!arr && arr.constructor === Array;
}

function isObject(obj) {
  return !!obj && obj.constructor === Object;
}
*/

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

function extendArray(val, theSetter) {
  const arrHandler = {
    get: function(target, name) {
      // wrap mutating functions...
      if (arrayMutators.indexOf(name) > -1) {
        return function() {
          // you need to delay the set of this value just like SArray... save mutation to temp first...
          let tmp = target.slice(0); // get clone of array
          const res = Array.prototype[name].apply(tmp, arguments);
          theSetter(tmp);
          return res;
        };
      }
      return target[name];
    }
  };
  return new Proxy(val, arrHandler);
}

function addData(key, val, opts, store, local) {
  const unobserved = local.unobserved;
  const observed = local.observed;
  if (opts && opts.observed === false) {
    unobserved.push(key);
    store[key] = val;
  } else {
    observed.push(key);
    store[key] = S.data(val);
  }
}

function addAction(key, val, opts, local) {
  const proxy = local.proxy;
  const fn = val;
  local.actions[key] = function() {
    const actionArgs = arguments;
    S.freeze(() => {
      fn.apply(proxy, actionArgs);
    });
  };
}

function addComputed(key, val, opts, store, local) {
  const proxy = local.proxy;
  const computed = local.computed;
  const disposers = local.disposers;
  computed.push(key);
  const comp = val.bind(proxy);
  S.root(dispose => {
    store[key] = S(comp);
    disposers[key] = dispose;
  });
}

function addStore(key, val, store, local) {
  const stores = local.stores;
  const disposers = local.disposers;
  stores.push(key);
  const s = val.state || {};
  const a = val.actions || {};
  store[key] = Store(s, a);
  disposers[key] = () => {
    store[key]("dispose");
  };
}

function dispose(store, local) {
  const disposers = local.disposers;
  Object.keys(disposers).forEach(key => {
    disposers[key]();
  });
  Object.keys(store).forEach(key => {
    delete store[key];
  });
  Object.keys(local.actions).forEach(key => {
    delete local.actions[key];
  });
  const p = local.proxy;
  local = {
    proxy: p,
    computed: [],
    observed: [],
    unobserved: [],
    stores: [],
    actions: {},
    snapshot: undefined,
    snapshotDisposer: undefined,
    disposers: {}
  };
  return local;
}

function addToStore(name, value, p) {
  if (typeof value === "function") {
    if (value.length === 0) {
      p("computed", name, value);
    } else {
      //p("action", name, value);
      throw new RangeError(
        "Cannot add actions implicitly, please call store api directly"
      );
    }
  } else if (
    Array.isArray(value) ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    p("data", name, value);
  } else {
    p("store", name, { state: value });
  }
  return true;
}

export function Store(state, actions) {
  state = state || {};
  actions = actions || {};
  let local = {
    proxy: undefined,
    computed: [],
    observed: [],
    unobserved: [],
    stores: [],
    actions,
    snapshot: undefined,
    snapshotDisposer: undefined,
    registered: S.data([]), // fills with "patch => {}""
    disposers: {}
  };
  /* eslint-disable complexity */
  const store = function(t, key, val, opts) {
    if (key) {
      isKeyConflict(key, store);
    }

    if (t === "data") {
      addData(key, val, opts, store, local);
    } else if (t === "action") {
      addAction(key, val, opts, local);
    } else if (t === "computed") {
      addComputed(key, val, opts, store, local);
    } else if (t === "store") {
      addStore(key, val, store, local);
    } else if (t === "snapshot") {
      return local.snapshot();
    } else if (t === "register") {
      // overloading use of key... not monomorphic for sure lol...
      let reged = local.registered();
      reged.push(key);
      local.registered(reged);
    } else if (t === "unregister") {
      let reged = local.registered();
      let index = reged.indexOf(key);
      if (index > -1) {
        reged.splice(index, 1);
      } else {
        throw new RangeError(
          "function passed to unregister was not previously registered..."
        );
      }
      local.registered(reged);
    } else if (t === "dispose") {
      local = dispose(store, local);
    } else {
      throw new RangeError(
        "type must be one of the following: data, dispose, action, computed, store, snapshot, register, unregister"
      );
    }
  };
  /* eslint-enable complexity */
  local.proxy = new Proxy(store, {
    get: function(target, name) {
      if (name in target) {
        if (typeof target[name] === "function") {
          if (isKey(name, local.observed)) {
            let val = target[name]();
            if (Array.isArray(val)) {
              val = extendArray(val, target[name]);
              return val;
            } else {
              return val;
            }
          } else if (isKey(name, local.computed)) {
            return target[name]();
          } else {
            return target[name];
          }
        } else {
          return target[name];
        }
      } else {
        if (name in local.actions) {
          return local.actions[name];
        } else {
          return undefined;
        }
      }
    },
    set: function(target, name, value) {
      if (name in target) {
        if (typeof target[name] === "function") {
          if (isKey(name, local.observed)) {
            target[name](value);
          } else if (isKey(name, local.unobserved)) {
            target[name] = value;
          } else {
            local.disposers[name]();
            delete local.disposers[name];
            delete target[name];
            return addToStore(name, value, local.proxy);
          }
        } else {
          target[name] = value;
        }
        return true;
      } else {
        return addToStore(name, value, local.proxy);
      }
    },
    has: function(target, name) {
      // we only want for..in loops to enumerate data/computed, not actions
      if (
        local.computed.indexOf(name) > -1 ||
        local.observed.indexOf(name) > -1 ||
        local.unobserved.indexOf(name) > -1 ||
        local.stores.indexOf(name) > -1
      ) {
        return true;
      } else {
        return false;
      }
    },
    ownKeys: function(target) {
      return Reflect.ownKeys(target).filter(k => {
        return (
          local.computed.indexOf(k) > -1 ||
          local.observed.indexOf(k) > -1 ||
          local.unobserved.indexOf(k) > -1 ||
          local.stores.indexOf(k) > -1 ||
          k === "caller" ||
          k === "prototype" ||
          k === "arguments"
        );
      });
    },
    deleteProperty: function(target, name) {
      if (name in local.actions) {
        return delete local.actions[name];
      } else if (name in target) {
        if (name in local.disposers) {
          local.disposers[name]();
          delete local.disposers[name];
        }
        if (local.observed.indexOf(name) > -1) {
          local.observed = local.observed.filter(key => key !== name);
        }
        if (local.computed.indexOf(name) > -1) {
          local.computed = local.computed.filter(key => key !== name);
        }
        if (local.stores.indexOf(name) > -1) {
          local.stores = local.stores.filter(key => key !== name);
        }
        return delete target[name];
      } else {
        return false;
      }
    }
  });

  // attach data and computations to proxy...
  Object.keys(state).forEach(key => {
    const val = state[key];
    if (typeof val === "function") {
      local.proxy("computed", key, val);
    } else if (
      Array.isArray(val) ||
      typeof val === "number" ||
      typeof val === "string"
    ) {
      local.proxy("data", key, val);
    } else {
      local.proxy("store", key, { state: val });
    }
  });

  Object.keys(actions).forEach(key => {
    local.proxy("action", key, actions[key]);
  });

  // add computed snapshot
  S.root(dispose => {
    local.snapshotDisposer = dispose;
    local.snapshot = S(() => {
      let snap = {};
      let stateKeys = local.observed.concat(local.unobserved); // only interested in state, not computed/actions
      stateKeys.forEach(key => {
        snap[key] = local.proxy[key];
      });
      // also get the snapshots for nested stores...
      local.stores.forEach(store => {
        snap[store] = local.proxy[store]("snapshot");
      });
      return snap;
    });
  });

  let lastSnap;
  autorun(() => {
    if (local.registered().length === 0) {
      lastSnap = local.snapshot(); // if no one is watching for patches don't generate them...
    } else {
      let nextSnap = local.snapshot();
      const patch = fastJsonPatch.compare(lastSnap, nextSnap);
      if (patch.length > 0) {
        local.registered().forEach(notify => notify(patch));
      }
      // update last snap...
      lastSnap = nextSnap;
    }
  });

  return local.proxy;
}
