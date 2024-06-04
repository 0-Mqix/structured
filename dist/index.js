// src/utils.ts
function assert(value, message) {
  if (!value) {
    throw new Error(message);
  }
}
function emptyArrayElement(bytes, offset, elementSize) {
  let empty = true;
  for (let j = 0;j < elementSize; j++) {
    if (bytes[offset + j] != 0) {
      empty = false;
      break;
    }
  }
  return empty;
}
function assertStructuredType(name, index, type) {
  assert(typeof name === "string", `property ${index} "name must be a string`);
  assert(typeof type === "object", `property ${index} type must be an object`);
  assert(typeof type.size === "number", `property ${index} type requires a size property`);
  assert(type.readBytes != null != (type.fromBytes != null), `property ${index} type can only can have a readBytes or fromBytes function not both`);
  assert(type.readBytes != null || type.fromBytes != null, `property ${index} type requires a readBytes or fromBytes function`);
}
function loadPropertyMap(map, struct, size) {
  let i2 = 0;
  for (const [name, type] of struct) {
    if (Array.isArray(type)) {
      const _map = new Map;
      loadPropertyMap(_map, type, size);
      map.set(name, _map);
    } else if (type instanceof Structured) {
      map.set(name, new Map(type.map));
      size.value += type.size;
    } else {
      const _type = type;
      assertStructuredType(name, i2, _type);
      map.set(name, _type);
      size.value += _type.size;
    }
    i2++;
  }
}
function readBytes(result, map, bytes, view, index, littleEndian2) {
  console.log("result in", result);
  for (const [name, type] of map) {
    if (type instanceof Map) {
      if (typeof result[name] != "object") {
        result[name] = {};
      }
      index = readBytes(result[name], type, bytes, view, index, littleEndian2);
    } else {
      if (type.readBytes) {
        if (typeof result[name] != "object") {
          result[name] = type.array ? [] : {};
        }
        console.log(result[name]);
        type.readBytes(bytes, result[name], view, index, littleEndian2);
      } else {
        result[name] = type.fromBytes(bytes, view, index, littleEndian2);
      }
      index += type.size;
    }
  }
  console.log("result out", result);
  return index;
}
function writeBytes(object, map, bytes, view, index, littleEndian2) {
  for (const [name, type] of map) {
    if (type instanceof Map) {
      index = writeBytes(object[name], type, bytes, view, index, littleEndian2);
    } else {
      assert(Object.hasOwn(object, name), "object has not the property");
      type.writeBytes(object[name], bytes, view, index, littleEndian2);
      index += type.size;
    }
  }
  return index;
}

// src/structured.ts
class Structured {
  map = new Map;
  size = 0;
  littleEndian;
  constructor(littleEndian2, struct) {
    this.littleEndian = littleEndian2;
    const _size = { value: 0 };
    loadPropertyMap(this.map, struct, _size);
    this.size = _size.value;
  }
  readBytes(bytes, result, view, index = 0, littleEndian2) {
    assert(typeof result == "object", "result is undefined");
    if (!view)
      view = new DataView(bytes.buffer);
    readBytes(result, this.map, bytes, view, index, littleEndian2 ?? this.littleEndian);
  }
  writeBytes(value, bytes, index = 0, littleEndian2) {
    const view = new DataView(bytes.buffer);
    writeBytes(value, this.map, bytes, view, index, littleEndian2 ?? this.littleEndian);
  }
  toBytes(object) {
    const bytes = new Uint8Array(this.size);
    this.writeBytes(object, bytes);
    return bytes;
  }
  fromBytes(bytes) {
    const object = {};
    this.readBytes(bytes, object);
    return object;
  }
}
// src/types.ts
var createDataViewType = function(type, size) {
  return {
    size,
    fromBytes: (_, view, index, littleEndian2) => {
      return view[`get${type}`](index, littleEndian2);
    },
    writeBytes: (value, _, view, index, littleEndian2) => {
      view[`set${type}`](index, value, littleEndian2);
    }
  };
};
function string(size) {
  const encoder = new TextEncoder;
  return {
    size,
    fromBytes: function(bytes, _, index) {
      let result = "";
      for (let i2 = 0;i2 < size; i2++) {
        const byte = bytes[i2 + index];
        if (byte == 0 || byte == undefined) {
          break;
        }
        result += String.fromCharCode(byte);
      }
      return result;
    },
    writeBytes: function(value, bytes, _, index) {
      assert(value.length < size, "string is larger then expected");
      let i2 = 0;
      for (const byte of encoder.encode(value)) {
        bytes[index + i2] = byte;
        i2++;
      }
    }
  };
}
function array(size, type, omitEmptyRead = false) {
  let _type = type;
  if (Array.isArray(type)) {
    _type = new Structured(littleEndian, _type);
  }
  let structured3 = _type instanceof Structured;
  return {
    array: true,
    size: _type.size * size,
    readBytes: function(bytes, result, view, index, littleEndian2) {
      assert(Array.isArray(result), "result is not an array");
      while (result.length > size) {
        result.pop();
      }
      for (let i2 = 0;i2 < size; i2++) {
        const offset = i2 * _type.size + index;
        if (i2 > result.length - 1) {
          if (omitEmptyRead && emptyArrayElement(bytes, offset, _type.size)) {
            continue;
          }
          if (structured3 || _type.readBytes) {
            const object = {};
            _type.readBytes(bytes, object, view, offset, littleEndian2);
            result.push(object);
          } else {
            result.push(_type.fromBytes(bytes, view, offset, littleEndian2));
          }
          continue;
        }
        if (omitEmptyRead && emptyArrayElement(bytes, offset, _type.size)) {
          result.splice(i2, 1);
          continue;
        }
        if (structured3 || _type.readBytes) {
          if (typeof result[i2] != "object")
            result[i2] = type.array ? [] : {};
          _type.readBytes(bytes, result[i2], view, offset, littleEndian2);
        } else {
          result[i2] = _type.fromBytes(bytes, view, offset, littleEndian2);
        }
      }
      console.log("output", result);
      console.log("----------------------------");
    },
    writeBytes: function(value, bytes, view, index, littleEndian2) {
      assert(value.length <= size, "array is larger then expected");
      for (let i2 = 0;i2 < size; i2++) {
        if (value[i2] == undefined)
          continue;
        if (structured3) {
          _type.writeBytes(value[i2], bytes, i2 * _type.size + index, littleEndian2);
        } else {
          _type.writeBytes(value[i2], bytes, view, i2 * _type.size + index, littleEndian2);
        }
      }
    }
  };
}
function union(union2) {
  const map = new Map;
  let size = 0;
  for (const [name, type] of union2) {
    const _size = { value: 0 };
    let i2 = 0;
    if (Array.isArray(type)) {
      const _map = new Map;
      loadPropertyMap(_map, type, _size);
      map.set(name, _map);
    } else if (type instanceof Structured) {
      map.set(name, new Map(type.map));
      _size.value = type.size;
    } else {
      const _type = type;
      assertStructuredType(name, i2, _type);
      map.set(name, _type);
      _size.value = _type.size;
    }
    if (_size.value > size) {
      size = _size.value;
    }
    i2++;
  }
  return {
    size,
    readBytes: function(bytes, result, view, index, littleEndian2) {
      assert(typeof result == "object", "result is not an object");
      for (const [name, type] of map) {
        if (type instanceof Map) {
          if (typeof result[name] != "object")
            result[name] = {};
          readBytes(result[name], type, bytes, view, index, littleEndian2);
        } else {
          if (type.readBytes) {
            if (typeof result[name] != "object")
              result[i] = type.array ? [] : {};
            type.readBytes(bytes, result[name], view, index, littleEndian2);
          } else {
            result[name] = type.fromBytes(bytes, view, index, littleEndian2);
          }
        }
      }
    },
    writeBytes: function(value, bytes, view, index, littleEndian2) {
      let done = false;
      for (const [_name, type] of map) {
        if (!Object.hasOwn(value, _name))
          continue;
        assert(!done, "union has multiple properties defined");
        done = true;
        if (type instanceof Map) {
          writeBytes(value[_name], type, bytes, view, index, littleEndian2);
        } else {
          type.writeBytes(value[_name], bytes, view, index, littleEndian2);
        }
      }
    }
  };
}
var uint8 = createDataViewType("Uint8", 1);
var int8 = createDataViewType("Int8", 1);
var uint16 = createDataViewType("Uint16", 2);
var int16 = createDataViewType("Int16", 2);
var uint32 = createDataViewType("Uint32", 4);
var int32 = createDataViewType("Int32", 4);
var float32 = createDataViewType("Float32", 4);
var float64 = createDataViewType("Float64", 8);
var int64 = createDataViewType("BigInt64", 8);
var uint64 = createDataViewType("BigUint64", 8);
var double = float64;
var long = int64;
var bool = {
  size: 1,
  fromBytes: function(bytes, _, index) {
    return bytes[index] ? true : false;
  },
  writeBytes: function(value, bytes, _, index) {
    bytes[index] = value ? 1 : 0;
  }
};
export {
  union,
  uint8,
  uint64,
  uint32,
  uint16,
  string,
  long,
  int8,
  int64,
  int32,
  int16,
  float64,
  float32,
  double,
  Structured as default,
  bool,
  array
};
