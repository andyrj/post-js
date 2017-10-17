function add(doc, path, value) {
  const { parent, prop } = walkPath(doc, path);
  if (Array.isArray(parent)) {
    const index = parseInt(prop);
    if (isNaN(index)) {
      return false;
    }
    parent.splice(index, 0, value);
  } else {
    parent[prop] = value;
  }
  return true;
}

function remove(doc, path) {
  const { parent, prop } = walkPath(doc, path);
  if (Array.isArray(parent)) {
    const index = parseInt(prop);
    if (isNaN(index)) {
      return false;
    }
    parent.splice(index, 1);
  } else {
    return delete parent[prop];
  }
  return true;
}

function replace(doc, path, value) {
  let result = false;
  result = remove(doc, path);
  result = add(doc, path, value);
  return result;
}

function move(doc, from, to) {
  const { parent, prop } = walkPath(doc, from);
  const value = parent[prop];
  let result = false;
  result = remove(doc, from);
  result = add(doc, to, value);
  return result;
}

function copy(doc, from, to) {
  const { parent, prop } = walkPath(doc, from);
  const value = parent[prop];
  let result = false;
  result = add(doc, to, value);
  return result;
}

function compareArray(a, b) {
  if (a.length === b.length) {
    let i = 0;
    const len = a.length;
    for (; i < len; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  } else {
    return false;
  }
}

function compareObjects(a, b) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) {
    return false;
  } else {
    const len = aKeys.length;
    let i = 0;
    for (; i < len; i++) {
      const aKey = aKeys[i];
      if (!compare(a[aKey], b[aKey])) {
        return false;
      }
    }
    return true;
  }
}

function compare(a, b) {
  if (Array.isArray(a)) {
    return compareArray(a, b);
  } else if (
    typeof a === "number" ||
    typeof a === "string" ||
    a === false ||
    a === true ||
    a === null
  ) {
    return a === b;
  } else {
    return compareObjects(a, b);
  }
}

function test(doc, path, value) {
  const { parent, prop } = walkPath(doc, path);
  return compare(parent[prop], value);
}

// RFC6901
// helper to convert ["some", "json", "path"] to "/some/json/path"
function arrToPointer(arr) {
  return "/" + arr.join("/");
}
// helper to convert pointer to path array reverse of above...
function pointerToArr(pointer) {
  return pointer.slice(1).split("/");
}

function walkPath(doc, arr) {
  const clone = arr.slice(0);
  const prop = clone.pop();
  let parent;
  while (clone.length > 0) {
    if (parent == null) {
      parent = doc[clone.shift()];
    } else {
      parent = parent[clone.shift()];
    }
  }
  return { parent, prop };
}

function validate(patch, keys) {
  keys.forEach(key => {
    if (patch[key] == null) {
      throw new RangeError("Invalid patch missing required key: " + key);
    }
  });
}

export function apply(doc, patches) {
  let i = 0;
  const len = patches.length;
  for (; i < len; i++) {
    const patch = patches[i];
    if (patch.op == null) {
      throw new RangeError("Invalid patch instruction, missing op");
    }
    let result = false;
    switch (patch.op) {
      case "add":
        validate(patch, ["path", "value"]);
        result = add(doc, pointerToArr(patch.path), patch.value);
        break;
      case "remove":
        validate(patch, ["path"]);
        result = remove(doc, pointerToArr(patch.path));
        break;
      case "replace":
        validate(patch, ["path", "value"]);
        result = replace(doc, pointerToArr(patch.path), patch.value);
        break;
      case "move":
        validate(patch, ["from", "path"]);
        result = move(doc, pointerToArr(patch.from), pointerToArr(patch.path));
        break;
      case "copy":
        validate(patch, ["from", "path"]);
        result = copy(doc, pointerToArr(patch.from), pointerToArr(patch.path));
        break;
      case "test":
        validate(patch, ["path", "value"]);
        result = test(doc, pointerToArr(patch.path), patch.value);
        break;
      default:
        throw new RangeError("Invalid operation type: " + patch.op);
    }
    if (!result) {
      return false;
    }
  }
  return true;
}

export function Add(path, value) {
  return { op: "add", path: arrToPointer(path), value };
}

export function Remove(path) {
  return { op: "remove", path: arrToPointer(path) };
}

export function Replace(path, value) {
  return { op: "replace", path: arrToPointer(path), value };
}

export function Move(from, path) {
  return { op: "move", from: arrToPointer(from), path: arrToPointer(path) };
}

export function Copy(from, path) {
  return { op: "copy", from: arrToPointer(from), path: arrToPointer(path) };
}

export function Test(path, value) {
  return { op: "test", path: arrToPointer(path), value };
}
