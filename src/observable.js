import { apply, Add, Remove } from "./json";

const stack = [];
let actions = 0;
const MAX_DEPTH = 100;
const OBSERVABLE = 0;
const COMPUTED = 1;
const STORE = 2;
const AUTORUN = 4;
const ACTION = 3;
let depth = MAX_DEPTH;
const transaction = { o: [], c: [], a: [] };
const patchQueue = [];

const arrayMutators = [
  "splice",
  "push",
  "unshift",
  "pop",
  "shift",
  "copyWithin",
  "reverse"
];

function notifyObservers(obs) {
  obs.forEach(o => {
    if (actions === 0) {
      o.run();
    } else {
      if (o.__type === COMPUTED) {
        const index = transaction.c.indexOf(o);
        if (index > -1) {
          transaction.c.splice(index, 1);
        }
        transaction.c.push(o);
      } else {
        const index = transaction.a.indexOf(o);
        if (index > -1) {
          transaction.a.splice(index, 1);
        }
        transaction.a.push(o);
      }
    }
  });
}

// TODO: need to pass path of the array...
function extendArray(val, observers) {
  const arrHandler = {
    get(target, name) {
      if (arrayMutators.indexOf(name) > -1) {
        return function() {
          const res = Array.prototype[name].apply(target, arguments);
          notifyObservers(observers);
          return res;
        };
      } else {
        return target[name];
      }
    },
    set(target, name, value) {
      if (target[name] != null) {
        if (target[name].__type === OBSERVABLE) {
          if (value != null && value.__type === OBSERVABLE) {
            target[name](value());
          } else {
            target[name](value);
          }
        } else {
          target[name] = value;
        }
      } else {
        if (isNaN(parseInt(name))) {
          return false;
        } else {
          target[name] = value;
        }
      }
      notifyObservers(observers);
      return true;
    }
  };
  return new Proxy(val, arrHandler);
}

function emitPatches(listeners = []) {
  if (actions === 0) {
    listeners.forEach(l => {
      l(patchQueue);
    });
    while (patchQueue.length > 0) {
      patchQueue.pop();
    }
  }
}

const nonIterableKeys = [
  "snapshot",
  "restore",
  "register",
  "unregister",
  "apply",
  "__type"
];

/**
 * Store - creates a proxy wrapper that allows observables to be used as if they
 * were plain javascript objects.
 * 
 * @export
 * @param {any} [state={}] - Object that defines your state/actions, 
 *   should be made of unobserved values, observables, computed, and actions.
 * @param {any} [path=[]] - Array of paths that lead to this Store...
 * @returns {store} Proxy to use observables/computed transparently as if POJO.
 */
export function Store(state = {}, actions = {}, path = []) {
  const local = {};
  let proxy;
  const listeners = [];
  const storeHandler = {
    get(target, name) {
      if (name in target) {
        if (
          target[name].__type === OBSERVABLE ||
          target[name].__type === COMPUTED
        ) {
          return target[name]();
        }
        return target[name];
      } else {
        return;
      }
    },
    set(target, name, value) {
      const v = value ? value.__type : undefined;
      if (v === COMPUTED || v === ACTION) {
        value.context(proxy);
      }
      if (name in target) {
        const t = target[name].__type;
        if (t === OBSERVABLE) {
          if (v === OBSERVABLE) {
            target[name](value());
          } else {
            target[name](value);
          }
        } else {
          if (t && target[name].dispose) {
            target[name].dispose();
          }
          target[name] = value;
        }
      } else {
        target[name] = value;
      }

      // create json patchs for observable and unobserved values...
      if (
        (!value.__type && typeof value !== "function") ||
        value.__type === OBSERVABLE
      ) {
        patchQueue.push(Add(path.concat(name), value));
        emitPatches(listeners);
      }

      return true;
    },
    deleteProperty(target, name) {
      if (name in target) {
        const t = target[name];
        if ((!t.__type && typeof t !== "function") || t.__type === OBSERVABLE) {
          patchQueue.push(Remove(path.concat(name)));
        }
        if (target[name].dispose != null) {
          target[name].dispose();
        }
        delete target[name];
        emitPatches(listeners);
        return true;
      } else {
        return false;
      }
    },
    has(target, name) {
      if (name in target && nonIterableKeys.indexOf(name) === -1) {
        const isFunc = typeof target[name] === "function";
        const type = target[name].__type;
        if (isFunc) {
          if (type < ACTION) {
            return true;
          } else {
            return false;
          }
        } else {
          return true;
        }
      } else {
        return false;
      }
    },
    ownKeys(target) {
      return Reflect.ownKeys(target).filter(k => {
        const type = target[k].__type;
        return (!type && typeof target[k] !== "function") || type < ACTION;
      });
    }
  };
  proxy = new Proxy(local, storeHandler);
  Object.keys(state).forEach(key => {
    const s = state[key];
    const t = s.__type;
    if (t === OBSERVABLE || typeof s !== "function") {
      local[key] = s;
    } else {
      local[key] = computed(s, proxy);
    }
  });
  Object.keys(actions).forEach(key => {
    const a = actions[key];
    const t = a.__type;
    if (key in local) {
      throw new RangeError("Key overlap between state and actions");
    }
    if (t === ACTION) {
      a.context(proxy);
      local[key] = a;
    } else {
      local[key] = a;
    }
  });
  proxy.snapshot = computed(() => {
    const result = {};
    const keys = Object.keys(local);
    keys.forEach(key => {
      const l = local[key];
      let val;
      if (l.__type) {
        const t = l.__type;
        if (t === OBSERVABLE) {
          console.log(l.__type);
          val = l();
        } else if (t === STORE) {
          console.log(l.__type);
          val = l.snapshot();
        }
      } else if (typeof l !== "function") {
        val = l;
      }
      if (val !== undefined) {
        console.log(key);
        result[key] = val;
      }
    });
    return result;
  });
  proxy.restore = action(snap => {
    Object.keys(snap).forEach(k => {
      const t = proxy[k].__type;
      const sn = snap[k];
      const s = typeof snap[k];
      if (t === OBSERVABLE) {
        proxy[k] = snap[k];
      } else if (t === STORE && s === "object" && sn !== null) {
        proxy[k].restore(sn);
      }
    });
  });
  proxy.register = function(handler) {
    if (listeners.indexOf(handler) === -1) {
      listeners.push(handler);
    }
  };
  proxy.unregister = function(handler) {
    const index = listeners.indexOf(handler);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
  proxy.apply = function(patches) {
    apply(proxy, patches);
  };
  proxy.__type = STORE;
  return proxy;
}

/**
 * action - Batches changes to observables and computed values so that 
 * they are computed without glitches and without triggering autoruns 
 * with stale data.
 * 
 * @export
 * @param {any} fn - the function that defines how to modify observables.
 * @param {any} context - the "this" context for this action.
 * @returns {action} function that runs mutations as a batched transaction.
 */
export function action(fn, context) {
  const func = function() {
    const args = arguments;
    actions++;
    fn.apply(context, args);
    if (actions === 1) {
      while (
        (transaction.o.length > 0 ||
          transaction.c.length > 0 ||
          transaction.a.length > 0) &&
        depth > 0
      ) {
        if (transaction.o.length > 0) {
          transaction.o.shift()();
        } else if (transaction.c.length > 0) {
          if (transaction.c.length === 1) {
            depth--;
          }
          transaction.c.shift().run();
        } else {
          transaction.a.shift().run();
        }
      }
      if (depth === 0) {
        console.warn("circular dependency detected");
      }
      depth = MAX_DEPTH;
    }
    actions--;
  };
  func.__type = ACTION;
  func.context = function(newContext) {
    context = newContext;
  };
  return func;
}

/**
 * observable - function that creates a new observable value that is stored 
 * in a function closure.
 * 
 * @export
 * @param {any} value - value to store in the observable. 
 * @returns {observable} function that can be used to set and get your 
 *   observed value.
 */
export function observable(value) {
  const observers = [];
  let disposed = false;
  if (Array.isArray(value)) {
    value = extendArray(value, observers);
  }
  const data = function(arg) {
    if (disposed) {
      return;
    }
    if (arg == null) {
      if (stack.length > 0) {
        stack[stack.length - 1].addDependency(data);
      }
      return value;
    } else {
      if (actions === 0) {
        if (Array.isArray(arg)) {
          value = extendArray(arg, observers);
        } else {
          value = arg;
        }
      } else {
        transaction.o.push(() => {
          if (Array.isArray(arg)) {
            value = extendArray(arg, observers);
          } else {
            value = arg;
          }
        });
      }
      notifyObservers(observers);
    }
  };
  data.__type = OBSERVABLE;
  data.sub = function(observer) {
    if (observers.indexOf(observer) === -1) {
      observers.push(observer);
    }
  };
  data.unsub = function(observer) {
    const index = observers.indexOf(observer);
    if (index > -1) {
      observers.splice(index, 1);
    }
  };
  data.dispose = function() {
    disposed = true;
    flush(observers);
  };
  data.hasObservers = function() {
    return observers.length > 0;
  };
  Object.freeze(data);
  return data;
}

/**
 * computed - creates a computed value that will automatically update
 * when the observables it depends upon are updated.  It will also
 * only evaluate on retrieval if not being actively observed.
 * 
 * @export
 * @param {any} thunk - function that determines the computed value.
 * @param {any} context - context for the thunk.
 * @returns {computed} function that can be used to retrieve the 
 *   latest computed value.
 */
export function computed(thunk, context) {
  const current = observable(undefined);
  let disposed = false;
  let init = true;
  let delayedReaction = null;
  function reaction() {
    const result = thunk.call(context);
    current(result);
  }
  const computation = function() {
    if (current.hasObservers() || init) {
      if (init) {
        init = false;
      }
      reaction();
    } else {
      delayedReaction = function() {
        reaction();
      };
    }
  };
  const dispose = autorun(computation, true);
  function wrapper() {
    if (arguments.length > 0) {
      throw new RangeError("computed values cannot be set arbitrarily");
    } else {
      if (disposed) {
        return;
      }
      if (delayedReaction != null) {
        delayedReaction();
        delayedReaction = null;
      }
      return current();
    }
  }
  wrapper.__type = COMPUTED;
  wrapper.dispose = function() {
    current.dispose();
    dispose();
    disposed = true;
  };
  wrapper.context = function(newContext) {
    context = newContext;
  };
  Object.freeze(wrapper);
  return wrapper;
}

function flush(arr) {
  while (arr.length > 0) {
    arr.pop();
  }
}

/**
 * autorun - thunk that is executed any time any of it's observable
 * or computed dependencies are updated.
 * 
 * @export
 * @param {any} thunk - function to execute that depends on 
 *   observables/computed values.
 * @param {boolean} [computed=false] - is used to determine if 
 *   this autorun is being used for a computed value.
 * @returns {dispose } function that can be used to dispose of this autorun.
 */
export function autorun(thunk, computed = false) {
  const observing = [];
  let disposed = false;
  const reaction = {
    addDependency(obs) {
      if (observing.indexOf(obs) === -1) {
        observing.push(obs);
      }
    },
    run() {
      if (!disposed) {
        stack.push(this);
        observing.splice(0).forEach(o => o.unsub(this));
        thunk();
        observing.forEach(o => o.sub(this));
        stack.pop(this);
      }
    },
    __type: computed ? COMPUTED : AUTORUN
  };
  reaction.run();
  return function() {
    disposed = true;
    observing.splice(0).forEach(o => o.unsub(this));
    flush(observing);
  };
}
