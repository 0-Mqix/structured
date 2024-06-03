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
  assert(typeof type.readBytes === "function", `property ${index} type requires a readByte function`);
  assert(typeof type.writeBytes === "function", `property ${index} type requires a writeByte function`);
}
function loadPropertyMap(map, struct, size) {
  let i = 0;
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
      assertStructuredType(name, i, _type);
      map.set(name, _type);
      size.value += _type.size;
    }
    i++;
  }
}
function readBytes(object, map, bytes, view, index, littleEndian2) {
  for (const [name, type] of map) {
    if (type instanceof Map) {
      if (typeof object[name] != "object") {
        object[name] = {};
      }
      index = readBytes(object[name], type, bytes, view, index, littleEndian2);
    } else {
      object[name] = type.readBytes(bytes, view, index, littleEndian2);
      index += type.size;
    }
  }
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
  readBytes(bytes, object, index = 0, littleEndian2) {
    const view = new DataView(bytes.buffer);
    readBytes(object, this.map, bytes, view, index, littleEndian2 ?? this.littleEndian);
  }
  writeBytes(object, bytes, index = 0, littleEndian2) {
    const view = new DataView(bytes.buffer);
    writeBytes(object, this.map, bytes, view, index, littleEndian2 ?? this.littleEndian);
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
    readBytes: (_, view, index, littleEndian2) => {
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
    readBytes: function(bytes, _, index) {
      let result = "";
      for (let i = 0;i < size; i++) {
        const byte = bytes[i + index];
        if (byte == 0 || byte == undefined) {
          break;
        }
        result += String.fromCharCode(byte);
      }
      return result;
    },
    writeBytes: function(value, bytes, _, index) {
      assert(value.length < size, "string is larger then expected");
      let i = 0;
      for (const byte of encoder.encode(value)) {
        bytes[index + i] = byte;
        i++;
      }
    }
  };
}
function array(size, type, omitEmptyOnRead = false) {
  if (Array.isArray(type)) {
    type = new Structured(littleEndian, type);
  }
  if (type instanceof Structured) {
    const struct = type;
    return {
      size: type.size * size,
      readBytes: function(bytes, _, index, littleEndian2) {
        const result = omitEmptyOnRead ? [] : Array(size);
        for (let i = 0;i < size; i++) {
          const offset = i * struct.size;
          if (omitEmptyOnRead && emptyArrayElement(bytes, index + offset, struct.size)) {
            continue;
          }
          const element = {};
          struct.readBytes(bytes, element, index + offset, littleEndian2);
          omitEmptyOnRead ? result.push(element) : result[i] = element;
        }
        return result;
      },
      writeBytes: function(value, bytes, _, index, littleEndian2) {
        assert(value.length <= size, "array is larger then expected");
        for (let i = 0;i < size; i++) {
          if (value[i] == undefined)
            continue;
          struct.writeBytes(value[i], bytes, i * struct.size + index, littleEndian2);
        }
      }
    };
  } else {
    const _type = type;
    return {
      size: _type.size * size,
      readBytes: function(bytes, view, index, littleEndian2) {
        const result = omitEmptyOnRead ? [] : Array(size);
        for (let i = 0;i < size; i++) {
          const offset = i * _type.size;
          if (omitEmptyOnRead && emptyArrayElement(bytes, index + offset, _type.size)) {
            continue;
          }
          const element = _type.readBytes(bytes, view, index + offset, littleEndian2);
          omitEmptyOnRead ? result.push(element) : result[i] = element;
        }
        return result;
      },
      writeBytes: function(value, bytes, view, index, littleEndian2) {
        assert(value.length <= size, "array is larger then expected");
        for (let i = 0;i < size; i++) {
          if (value[i] == undefined)
            continue;
          _type.writeBytes(value[i], bytes, view, i * _type.size + index, littleEndian2);
        }
      }
    };
  }
}
function union(union2) {
  const map = new Map;
  let size = 0;
  for (const [name, type] of union2) {
    const _size = { value: 0 };
    let i = 0;
    if (Array.isArray(type)) {
      const _map = new Map;
      loadPropertyMap(_map, type, _size);
      map.set(name, _map);
    } else if (type instanceof Structured) {
      map.set(name, new Map(type.map));
      _size.value = type.size;
    } else {
      const _type = type;
      assertStructuredType(name, i, _type);
      map.set(name, _type);
      _size.value = _type.size;
    }
    if (_size.value > size) {
      size = _size.value;
    }
    i++;
  }
  return {
    size,
    readBytes: function(bytes, view, index, littleEndian2) {
      const result = {};
      for (const [name, type] of map) {
        if (type instanceof Map) {
          result[name] = {};
          readBytes(result[name], type, bytes, view, index, littleEndian2);
        } else {
          result[name] = type.readBytes(bytes, view, index, littleEndian2);
        }
      }
      return result;
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
  readBytes: function(bytes, _, index) {
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
