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
  assert(typeof type === "object", `property ${index}:${name} type must be an object`);
  assert(typeof type.size === "number", `property ${index}:${name} type requires a size property`);
  assert(type.readBytes != null != (type.fromBytes != null), `property ${index}:${name} type can only can have a readBytes or fromBytes function not both`);
  assert(type.readBytes == undefined || type.fromBytes == undefined, `property ${index}:${name} type requires a readBytes or fromBytes function`);
}
function loadProperties(properties, struct, size) {
  let i = 0;
  for (const [name, type] of struct) {
    if (type instanceof Array) {
      const _properties = [];
      loadProperties(_properties, type, size);
      properties.push([name, _properties]);
    } else if (type instanceof Structured) {
      properties.push([name, Array.from(type.properties)]);
      size.value += type.size;
    } else {
      const _type = type;
      assertStructuredType(name, i, _type);
      properties.push([name, _type]);
      size.value += _type.size;
    }
    i++;
  }
}
function readBytes(result, properties, bytes, view, index, littleEndian) {
  for (let i = 0;i < properties.length; i++) {
    const name = properties[i][0];
    const type = properties[i][1];
    if (type instanceof Array) {
      if (typeof result[name] != "object") {
        result[name] = {};
      }
      index = readBytes(result[name], type, bytes, view, index, littleEndian);
    } else {
      if (type.readBytes) {
        if (typeof result[name] != "object") {
          result[name] = type.array ? [] : {};
        }
        type.readBytes(bytes, result[name], view, index, littleEndian);
      } else {
        result[name] = type.fromBytes(bytes, view, index, littleEndian);
      }
      index += type.size;
    }
  }
  return index;
}
function writeBytes(object, properties, bytes, view, index, littleEndian) {
  for (let i = 0;i < properties.length; i++) {
    const name = properties[i][0];
    const type = properties[i][1];
    if (type instanceof Array) {
      index = writeBytes(object[name], type, bytes, view, index, littleEndian);
    } else {
      assert(Object.hasOwn(object, name), "object does not have the property");
      type.writeBytes(object[name], bytes, view, index, littleEndian);
      index += type.size;
    }
  }
  return index;
}

// src/structured.ts
class Structured {
  properties = [];
  size = 0;
  littleEndian;
  constructor(littleEndian, struct) {
    this.littleEndian = littleEndian;
    const _size = { value: 0 };
    loadProperties(this.properties, struct, _size);
    this.size = _size.value;
  }
  readBytes(bytes, result, view, index = 0, littleEndian) {
    assert(typeof result == "object", "result is undefined");
    if (!view)
      view = new DataView(bytes.buffer);
    readBytes(result, this.properties, bytes, view, index, littleEndian ?? this.littleEndian);
  }
  writeBytes(value, bytes, view, index = 0, littleEndian) {
    if (!view)
      view = new DataView(bytes.buffer);
    writeBytes(value, this.properties, bytes, view, index, littleEndian ?? this.littleEndian);
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
    fromBytes: (_, view, index, littleEndian) => {
      return view[`get${type}`](index, littleEndian);
    },
    writeBytes: (value, _, view, index, littleEndian) => {
      view[`set${type}`](index, value, littleEndian);
    }
  };
};
function string(size) {
  const encoder = new TextEncoder;
  return {
    size,
    fromBytes: function(bytes, _, index) {
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

// src/array.ts
function array(size, type, omitEmptyRead = false) {
  let _type = type;
  if (type instanceof Array) {
    _type = new Structured(true, _type);
  }
  const structured3 = _type instanceof Structured;
  return {
    array: true,
    size: _type.size * size,
    readBytes: function(bytes, result, view, index, littleEndian) {
      assert(result instanceof Array, "result is not an array");
      while (result.length > size) {
        result.pop();
      }
      for (let i = 0;i < size; i++) {
        const offset = i * _type.size + index;
        if (i > result.length - 1) {
          if (omitEmptyRead && emptyArrayElement(bytes, offset, _type.size)) {
            continue;
          }
          if (structured3 || _type.readBytes) {
            const object = _type.array ? [] : {};
            _type.readBytes(bytes, object, view, offset, littleEndian);
            result.push(object);
          } else {
            result.push(_type.fromBytes(bytes, view, offset, littleEndian));
          }
          continue;
        }
        if (omitEmptyRead && emptyArrayElement(bytes, offset, _type.size)) {
          result.splice(i, 1);
          i--;
          continue;
        }
        if (structured3 || _type.readBytes) {
          if (typeof result[i] != "object")
            result[i] = type.array ? [] : {};
          _type.readBytes(bytes, result[i], view, offset, littleEndian);
        } else {
          result[i] = _type.fromBytes(bytes, view, offset, littleEndian);
        }
      }
    },
    writeBytes: function(value, bytes, view, index, littleEndian) {
      assert(value.length <= size, "array is larger then expected");
      for (let i = 0;i < size; i++) {
        if (value[i] == undefined)
          continue;
        if (structured3) {
          _type.writeBytes(value[i], bytes, i * _type.size + index, littleEndian);
        } else {
          _type.writeBytes(value[i], bytes, view, i * _type.size + index, littleEndian);
        }
      }
    }
  };
}
// src/union.ts
function union(union2) {
  const properties = [];
  let size = 0;
  for (const [name, type] of union2) {
    const _size = { value: 0 };
    let i = 0;
    if (type instanceof Array) {
      const _properties = [];
      loadProperties(_properties, type, _size);
      properties.push([name, _properties]);
    } else if (type instanceof Structured) {
      properties.push([name, Array.from(type.properties)]);
      _size.value = type.size;
    } else {
      const _type = type;
      assertStructuredType(name, i, _type);
      properties.push([name, _type]);
      _size.value = _type.size;
    }
    if (_size.value > size) {
      size = _size.value;
    }
    i++;
  }
  return {
    size,
    readBytes: function(bytes, result, view, index, littleEndian) {
      assert(typeof result == "object", "result is not an object");
      for (let i = 0;i < properties.length; i++) {
        const name = properties[i][0];
        const type = properties[i][1];
        if (type instanceof Array) {
          if (typeof result[name] != "object")
            result[name] = {};
          readBytes(result[name], type, bytes, view, index, littleEndian);
        } else {
          if (type.readBytes) {
            if (typeof result[name] != "object")
              result[i] = type.array ? [] : {};
            type.readBytes(bytes, result[name], view, index, littleEndian);
          } else {
            result[name] = type.fromBytes(bytes, view, index, littleEndian);
          }
        }
      }
    },
    writeBytes: function(value, bytes, view, index, littleEndian) {
      let done = false;
      for (let i = 0;i < properties.length; i++) {
        const name = properties[i][0];
        const type = properties[i][1];
        if (!(name in value))
          continue;
        assert(!done, "union has multiple properties defined");
        done = true;
        if (type instanceof Array) {
          writeBytes(value[name], type, bytes, view, index, littleEndian);
        } else {
          type.writeBytes(value[name], bytes, view, index, littleEndian);
        }
      }
    }
  };
}

// src/types.ts
var bool = {
  size: 1,
  fromBytes: function(bytes, _, index) {
    return bytes[index] ? true : false;
  },
  writeBytes: function(value, bytes, _, index) {
    bytes[index] = value ? 1 : 0;
  }
};
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
