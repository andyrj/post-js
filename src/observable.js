import { apply, Add, Remove } from "./json";

const stack = [];
let actions = 0;
const MAX_DEPTH = 300;
const OBSERVABLE = 0;
const COMPUTED = 1;
const STORE = 2;
const AUTORUN = 4;
const ACTION = 3;
let depth = MAX_DEPTH;
const transaction = { o: [], c: [], a: [] };
let reconciling = false;
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
      if (o._type === COMPUTED) {
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
      let val = value;
      if (name in target) {
        if (target[name]._type === OBSERVABLE) {
          if (value != null && value._type === OBSERVABLE) {
            val = value();
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

let actionPatchEmitter;
function emitPatches(listeners) {
  if (actions === 0) {
    listeners.forEach(l => {
      l(patchQueue);
    });
    while (patchQueue.length > 0) {
      patchQueue.pop();
    }
  } else {
    actionPatchEmitter = function() {
      listeners.forEach(l => {
        l(patchQueue);
      });
      while (patchQueue.length > 0) {
        patchQueue.pop();
      }
      actionPatchEmitter = undefined;
    };
  }
}

const nonIterableKeys = [
  "_snapshot",
  "_restore",
  "_register",
  "_unregister",
  "_patch",
  "_parent",
  "_type"
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
  const observed = observable([]);
  const unobserved = observable([]);
  const stores = observable([]);
  function addKey(name, value) {
    if (nonIterableKeys.indexOf(name) > -1) {
      return;
    }
    const type = value._type;
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
          target[name]._type === OBSERVABLE ||
          target[name]._type === COMPUTED
        ) {
          return target[name]();
        }
        return target[name];
      } else {
        return;
      }
    },
    set(target, name, value) {
      let v;
      if (value) {
        v = value._type;
      }
      if (v === COMPUTED || v === ACTION) {
        value.context(proxy);
      }
      if (name in target) {
        const t = target[name]._type;
        if (t === OBSERVABLE) {
          if (v === OBSERVABLE) {
            target[name](value());
          } else {
            target[name](value);
          }
        } else {
          if (t && typeof target[name].dispose === "function") {
            target[name].dispose();
            removeKey(name);
          }
          target[name] = value;
          addKey(name, value);
        }
      } else {
        target[name] = value;
        addKey(name, value);
      }
      return true;
    },
    deleteProperty(target, name) {
      if (name in target) {
        const t = target[name];
        const type = t._type;
        if (t.dispose != null) {
          t.dispose();
        }
        removeKey(name);
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
        const type = target[name]._type;
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
        const type = target[k]._type;
        return (!type && typeof target[k] !== "function") || type < ACTION;
      });
    }
  };
  proxy = new Proxy(local, storeHandler);
  Object.keys(state).forEach(key => {
    const s = state[key];
    const t = s._type;
    if (t === OBSERVABLE || typeof s !== "function") {
      if (t !== STORE && typeof s === "object" && s !== null) {
        proxy[key] = Store(s, actions[key], proxy);
      } else {
        proxy[key] = s;
      }
    } else {
      proxy[key] = computed(s, proxy);
    }
  });
  const initLocalKeys = Object.keys(local);
  Object.keys(actions).forEach(key => {
    const a = actions[key];
    const t = a._type;
    if (initLocalKeys.indexOf(key) === -1) {
      if (t !== ACTION) {
        a.bind(proxy);
      }
      proxy[key] = a;
    }
  });
  let lastSnap;
  function diffSnaps(prev, next) {
    // TODO: decide if we should instead escape hatch unobserved values, as opposed to explicitly defining everything...
    const prevKeys = Object.keys(prev);
    const nextKeys = Object.keys(next);
    nextKeys.forEach(key => {
      if (stores().indexOf(key) === -1 && next[key] !== prev[key]) {
        if (typeof next[key] !== "object") {
          patchQueue.push(Add([key], next[key]));
        } else {
          // TODO: handle case of unobserved objects in tree
        }
      }
    });

    if (listeners.length > 0) {
      emitPatches(listeners);
    }
  }
  proxy._snapshot = observable({});
  const snapDisposer = autorun(() => {
    let init = false;
    if (lastSnap === undefined) {
      init = true;
    }
    lastSnap = proxy._snapshot;
    const result = {};
    observed().forEach(key => {
      result[key] = proxy[key];
    });
    unobserved().forEach(key => {
      result[key] = proxy[key];
    });
    stores().forEach(key => {
      result[key] = proxy[key]._snapshot;
    });
    if (!init) {
      diffSnaps(lastSnap, result);
    }
    proxy._snapshot = result;
  });
  proxy._restore = action(snap => {
    // TODO: what about removing keys not found in snap?
    for (let k in snap) {
      const t = local[k]._type;
      if (t === STORE && typeof snap[k] === "object" && snap[k] !== null) {
        proxy[k]._restore(snap[k]);
      } else {
        proxy[k] = snap[k];
      }
    }
  });
  proxy._register = function(handler) {
    if (listeners.indexOf(handler) === -1) {
      listeners.push(handler);
    }
  };
  proxy._unregister = function(handler) {
    const index = listeners.indexOf(handler);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
  proxy._patch = function(patches) {
    apply(proxy, patches);
  };
  proxy._parent = observable(parent);
  proxy._type = STORE;
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
    fn.apply(context, arguments);
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
  func._type = ACTION;
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
  data._type = OBSERVABLE;
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
    const result = thunk.call(context);
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
  wrapper._type = COMPUTED;
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
    _type: computed ? COMPUTED : AUTORUN
  };
  reaction.run();
  return function() {
    disposed = true;
    observing.splice(0).forEach(o => o.unsub(this));
    flush(observing);
  };
}
