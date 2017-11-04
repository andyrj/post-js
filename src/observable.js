import { apply, Add, Remove } from "./json";
import {
  MAX_DEPTH,
  UNOBSERVED,
  OBSERVABLE,
  STORE,
  COMPUTED,
  ACTION,
  AUTORUN,
  REF,
  ARRAY
} from "./constants";

const stack = [];
let actions = 0;
let depth = MAX_DEPTH;
const transaction = { o: [], c: [], a: [] };
let reconciling = false;
const arrayPatches = {}; // LUT for observable array patch emission

const arrayMutators = [
  "splice",
  "push",
  "unshift",
  "pop",
  "shift",
  "copyWithin",
  "reverse"
];

export function unobserved(value) {
  const wrapper = function() {
    return value;
  };
  wrapper.type = UNOBSERVED;
  return wrapper;
}

function notifyObservers(observers) {
  observers.forEach(observer => {
    if (actions === 0) {
      observer.run();
    } else {
      if (observer.type === COMPUTED) {
        const index = transaction.c.indexOf(observer);
        if (index > -1) {
          transaction.c.splice(index, 1);
        }
        transaction.c.push(observer);
      } else {
        const index = transaction.a.indexOf(observer);
        if (index > -1) {
          transaction.a.splice(index, 1);
        }
        transaction.a.push(observer);
      }
    }
  });
}

const arrayNonIterableKeys = ["type", "patchSymbol"];

function extendArray(val, observers) {
  let proxy;
  let init = true;
  const arrHandler = {
    get(target, name) {
      if (arrayMutators.indexOf(name) > -1) {
        return function() {
          // TODO: push patches for each mutator function to arrayPatches[proxy.patchSymbol]
          const result = Array.prototype[name].apply(target, arguments);
          notifyObservers(observers);
          return result;
        };
      } else {
        return target[name];
      }
    },
    set(target, name, value) {
      if (name in target) {
        if (target[name].type === OBSERVABLE) {
          // TODO: push add patch to arrayPatches[proxy.patchSymbol]
          if (value != null && value.type === OBSERVABLE) {
            target[name](value());
          } else {
            target[name](value);
          }
        } else {
          target[name] = value;
        }
      } else {
        if (isNaN(parseInt(name)) && !init) {
          return false;
        } else {
          target[name] = value;
        }
      }
      notifyObservers(observers);
      return true;
    },
    deleteProperty(target, name) {
      // prevent deletion of private keys, type and patchSymbol,
      // removing them would break patch emission
      if (name in target && arrayNonIterableKeys.indexOf(name) === -1) {
        // TODO: push remove patch to arrayPatches[proxy.patchSymbol]
        return delete target[name];
      } else {
        return false;
      }
    },
    ownKeys(target) {
      // prevent iterating type and patchSymbol, which are
      // primarily private variables for use with Store...
      return Reflect.ownKeys(target).filter(key => {
        return arrayNonIterableKeys.indexOf(key) === -1;
      });
    }
  };
  proxy = new Proxy(val, arrHandler);
  proxy.type = ARRAY;
  proxy.patchSymbol = Symbol();
  arrayPatches[proxy.patchSymbol] = []; // initialize LUT entry for this observable array
  init = false;
  return proxy;
}

let actionPatchEmitter;
function emitPatches(listeners, queue) {
  if (actions === 0) {
    listeners.forEach(listener => {
      listener(queue);
    });
    while (queue.length > 0) {
      queue.pop();
    }
  } else {
    actionPatchEmitter = function() {
      listeners.forEach(listener => {
        listener(queue);
      });
      while (queue.length > 0) {
        queue.pop();
      }
      actionPatchEmitter = undefined;
    };
  }
}

const nonIterableKeys = [
  "snapshot",
  "restore",
  "register",
  "unregister",
  "patch",
  "parent",
  "type",
  "dispose"
];

/**
 * Store - creates a proxy wrapper that allows observables to be used as if they
 * were plain javascript objects.
 * 
 * @export
 * @param {any} [state={}] - Object that defines your state/actions, 
 *   should be made of unobserved values, observables, computed, and actions.
 * @param {any} [actions={}] - Object declaring functions, and actions for store
 * @param {Store} - Parent Store, used for json refs and nested stores
 * @returns {Store} Proxy to use observables/computed transparently as if POJO.
 */
export function Store(state = {}, actions = {}, parent) {
  const local = {};
  let proxy;
  const listeners = [];
  const patchQueue = [];
  const observed = observable([]);
  const unobserved = observable([]);
  const stores = observable([]);
  let storeInit = true;
  function addKey(name, value) {
    if (nonIterableKeys.indexOf(name) > -1) {
      return;
    }
    const type = value != null ? value.type : undefined;
    if (!type && typeof value !== "function") {
      unobserved().push(name);
    } else if (type === STORE) {
      stores().push(name);
    } else if (type === OBSERVABLE) {
      observed().push(name);
    }
  }
  function removeKey(name) {
    if (nonIterableKeys.indexOf(name) > -1) {
      return;
    }
    const ob = observed();
    const un = unobserved();
    const st = stores();
    const indexOb = ob.indexOf(name);
    const indexUn = un.indexOf(name);
    const indexSt = st.indexOf(name);
    if (indexOb > -1) {
      ob.splice(indexOb, 1);
    }
    if (indexUn > -1) {
      un.splice(indexUn, 1);
    }
    if (indexSt > -1) {
      st.splice(indexSt, 1);
    }
  }
  const storeHandler = {
    get(target, name) {
      if (name in target) {
        if (
          target[name] != null &&
          (target[name].type === OBSERVABLE || target[name].type === COMPUTED)
        ) {
          return target[name]();
        }
        return target[name];
      } else {
        return;
      }
    },
    set(target, name, value) {
      const valueType = value != null ? value.type : undefined;
      if (valueType === COMPUTED || valueType === ACTION) {
        value.context(proxy);
      }
      const entry = target[name];
      const type = entry != null ? entry.type : undefined;
      if (nonIterableKeys.indexOf(name) > -1 && !storeInit) {
        return false;
      }
      if (name in target) {
        if (valueType === OBSERVABLE && type === OBSERVABLE) {
          value = value(); // unwrap nested observables to avoid observable(observable("stuff"))
        }
        if (type === OBSERVABLE) {
          target[name](value);
        } else {
          if (type && typeof entry.dispose === "function") {
            entry.dispose(); // clean up if setting existing key that is COMPUTED or STORE
            removeKey(name);
          }
          target[name] = value;
        }
      } else {
        if (
          typeof value !== "function" &&
          valueType === undefined &&
          valueType !== UNOBSERVED
        ) {
          if (typeof value === "object" && value !== null) {
            value = Store(value, proxy); // by default upgrade objects to nested stores...
          } else {
            value = observable(value); // by default upgrade values to observables
          }
        } else if (valueType === UNOBSERVED) {
          value = value(); // unwrap unobserved values...
        }
        addKey(name, value);
        target[name] = value;
      }
      return true;
    },
    deleteProperty(target, name) {
      if (name in target && nonIterableKeys.indexOf(name) === -1) {
        const value = target[name];
        if (value.dispose != null) {
          value.dispose();
        }
        removeKey(name);
        delete target[name];
        return true;
      } else {
        return false;
      }
    },
    has(target, name) {
      if (name in target && nonIterableKeys.indexOf(name) === -1) {
        const value = target[name];
        const isFunc = typeof value === "function";
        const type = value != null ? value.type : undefined;
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
      return Reflect.ownKeys(target).filter(key => {
        const value = target[key];
        const type = value != null ? value.type : undefined;
        return (!type && typeof value !== "function") || type < ACTION;
      });
    }
  };
  proxy = new Proxy(local, storeHandler);
  Object.keys(state).forEach(key => {
    const value = state[key];
    const type = value != null ? value.type : undefined;
    if (typeof value !== "function") {
      if (type !== STORE && typeof value === "object" && value !== null) {
        proxy[key] = Store(value, actions[key], proxy);
      } else {
        proxy[key] = observable(value);
      }
    } else {
      proxy[key] = computed(value, proxy);
    }
  });
  const initLocalKeys = Object.keys(local);
  Object.keys(actions).forEach(key => {
    let action = actions[key];
    const t = action != null ? action.type : undefined;
    if (initLocalKeys.indexOf(key) === -1) {
      if (t !== ACTION) {
        proxy[key] = function() {
          action(proxy, ...arguments); // wrap async actions providing context to first parameter...
        };
      } else {
        proxy[key] = action;
      }
    }
  });
  proxy.dispose = function() {
    const keys = Object.keys(local);
    keys.forEach(key => {
      if (local[key] && typeof local[key].dispose === "function") {
        local[key].dispose();
      }
      delete local[key];
    });
  };
  proxy.restore = action((ctx, snap) => {
    const prevKeys = Object.keys(proxy);
    for (let key in snap) {
      const type = local[key].type;
      if (
        type === STORE &&
        typeof snap[key] === "object" &&
        snap[key] !== null
      ) {
        ctx[key].restore(snap[key]);
      } else {
        ctx[key] = snap[key];
      }
      const prevIndex = prevKeys.indexOf(key);
      if (prevIndex > -1) {
        prevKeys.splice(prevIndex, 1);
      }
    }
    let i = 0;
    const prevLen = prevKeys.length;
    for (; i < prevLen; i++) {
      const key = prevKeys[i];
      const value = local[key];
      const type = value.type;
      if (nonIterableKeys.indexOf(key) === -1 && (!type || type <= STORE)) {
        delete ctx[key];
      }
    }
  }, proxy);
  proxy.register = handler => {
    if (listeners.indexOf(handler) === -1) {
      listeners.push(handler);
    }
  };
  proxy.unregister = handler => {
    const index = listeners.indexOf(handler);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
  proxy.patch = patches => apply(proxy, patches);
  proxy.parent = observable(parent);
  proxy.type = STORE;
  let lastSnap;
  function diffSnaps(prev, next) {
    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(next);
    nextKeys.forEach(key => {
      // TODO: rewrite this to account for new LUT array patch setup...
      if (stores().indexOf(key) === -1 && next[key] !== prev[key]) {
        if (typeof next[key] !== "object") {
          patchQueue.push(Add([key], next[key]));
        } else {
          // TODO: unobserved values will not emit patches for now...
        }
      }
      const prevIndex = prevKeys.indexOf(key);
      if (prevIndex > -1) {
        prevKeys.splice(prevIndex, 1);
      }
    });
    prevKeys.forEach(key => {
      patchQueue.push(Remove([key]));
    });

    if (listeners.length > 0) {
      emitPatches(listeners, patchQueue);
    }
  }
  proxy.snapshot = observable({});
  const snapDisposer = autorun(() => {
    let init = false;
    if (lastSnap === undefined) {
      init = true;
    }
    lastSnap = proxy.snapshot;
    const result = {};
    observed().forEach(key => {
      result[key] = proxy[key];
    });
    unobserved().forEach(key => {
      result[key] = proxy[key];
    });
    stores().forEach(key => {
      result[key] = proxy[key].snapshot;
    });
    if (!init) {
      diffSnaps(lastSnap, result);
    }
    local.snapshot(result);
  });
  storeInit = false;
  return proxy;
}

function conditionalDec(condition, count) {
  return condition ? --count : count;
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
    actions++;
    fn(context, ...arguments);
    if (actions === 1) {
      reconciling = true;
      while (
        (transaction.o.length > 0 ||
          transaction.c.length > 0 ||
          transaction.a.length > 0) &&
        depth > 0
      ) {
        if (transaction.o.length > 0) {
          depth = conditionalDec(transaction.o.length === 1, depth);
          transaction.o.shift()();
        } else if (transaction.c.length > 0) {
          depth = conditionalDec(transaction.c.length === 1, depth);
          transaction.c.shift().run();
        } else {
          depth = conditionalDec(transaction.a.length === 1, depth);
          transaction.a.shift().run();
        }
      }
      if (depth === 0) {
        console.warn("circular dependency detected");
      }
      depth = MAX_DEPTH;
      reconciling = false;
      if (actionPatchEmitter !== undefined) {
        actionPatchEmitter();
      }
    }
    actions--;
  };
  func.type = ACTION;
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
  const data = function() {
    if (disposed) {
      return;
    }
    if (arguments.length === 0) {
      if (stack.length > 0) {
        stack[stack.length - 1].addDependency(data);
      }
      return value;
    } else {
      const arg = arguments[0];
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
  data.type = OBSERVABLE;
  data.subscribe = function(observer) {
    if (observers.indexOf(observer) === -1) {
      observers.push(observer);
    }
  };
  data.unsubscribe = function(observer) {
    const index = observers.indexOf(observer);
    if (index > -1) {
      observers.splice(index, 1);
    }
  };
  data.dispose = function() {
    disposed = true;
    flush(observers);
  };
  // Was used for delayedReaction optimization...
  // data.hasObservers = function() {
  //   return observers.length > 0;
  // };
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
  // let delayedReaction = null;
  function reaction() {
    const result = thunk(context);
    current(result);
  }
  // commented out delayed reaction, explore this optimization later...
  //   this caused issues with computed not being run on arrays etc...
  // const computation = function() {
  //   if (current.hasObservers() || init || reconciling) {
  //     if (init) {
  //       init = false;
  //     }
  //     reaction();
  //   } else {
  //     delayedReaction = function() {
  //       reaction();
  //     };
  //   }
  // };
  const dispose = autorun(reaction, true);
  function wrapper() {
    if (disposed) {
      return;
    }
    // if (delayedReaction != null) {
    //   delayedReaction();
    //   delayedReaction = null;
    // }
    return current();
  }
  wrapper.type = COMPUTED;
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
    addDependency(observer) {
      if (observing.indexOf(observer) === -1) {
        observing.push(observer);
      }
    },
    run() {
      if (!disposed) {
        stack.push(this);
        observing.splice(0).forEach(observer => observer.unsubscribe(this));
        thunk();
        observing.forEach(observer => observer.subscribe(this));
        stack.pop(this);
      }
    },
    type: computed ? COMPUTED : AUTORUN
  };
  reaction.run();
  return function() {
    disposed = true;
    observing.splice(0).forEach(observer => observer.unsubscribe(this));
    flush(observing);
  };
}
