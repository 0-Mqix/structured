// src/utils.ts
function assert(value, message) {
  if (!value) {
    throw new Error(message);
  }
}

// src/structured.ts
class Structured {
  map = new Map;
  size = 0;
  littleEndian;
  constructor(littleEndian, struct) {
    this.littleEndian = littleEndian;
    let i = 0;
    const process = (map, struct2) => {
      for (const [name, type] of struct2) {
        if (Array.isArray(type)) {
          const _map = new Map;
          process(_map, type);
          map.set(name, _map);
        } else if (type instanceof Structured) {
          map.set(name, new Map(type.map));
          this.size += type.size;
        } else {
          const _type = type;
          assert(typeof name === "string", `property ${i} "name must be a string`);
          assert(typeof _type === "object", `property ${i} type must be an object`);
          assert(typeof _type.size === "number", `property ${i} type requires a size property`);
          assert(typeof _type.readBytes === "function", `property ${i} type requires a readByte function`);
          assert(typeof _type.writeBytes === "function", `property ${i} type requires a writeByte function`);
          map.set(name, _type);
          this.size += _type.size;
        }
        i++;
      }
    };
    process(this.map, struct);
  }
  readBytes(bytes, result, index = 0) {
    const view = new DataView(bytes.buffer);
    const process = (result2, map) => {
      for (const [name, type] of map) {
        if (type instanceof Map) {
          result2[name] = {};
          process(result2[name], type);
        } else {
          result2[name] = type.readBytes(bytes, view, index, this.littleEndian);
          index += type.size;
        }
      }
    };
    process(result, this.map);
  }
  writeBytes(object, bytes, index = 0) {
    const view = new DataView(bytes.buffer);
    const process = (_object, map) => {
      for (const [name, type] of map) {
        if (type instanceof Map) {
          process(_object[name], type);
        } else {
          assert(Object.hasOwn(_object, name), "object has not the property");
          type.writeBytes(_object[name], bytes, view, index, this.littleEndian);
          index += type.size;
        }
      }
    };
    process(object, this.map);
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
    readBytes: (_, view, index, littleEndian) => {
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
var emptyArrayElement = function(bytes, offset, elementSize) {
  let empty = true;
  for (let j = 0;j < elementSize; j++) {
    if (bytes[offset + j] != 0) {
      empty = false;
      break;
    }
  }
  return empty;
};
function array(size, type, littleEndian, omitEmptyOnRead = false) {
  if (Array.isArray(type)) {
    type = new Structured(littleEndian, type);
  }
  if (type instanceof Structured) {
    const struct = type;
    return {
      size: type.size * size,
      readBytes: function(bytes, _, index) {
        const result = omitEmptyOnRead ? [] : Array(size);
        for (let i = 0;i < size; i++) {
          const offset = i * struct.size;
          if (omitEmptyOnRead && emptyArrayElement(bytes, index + offset, struct.size)) {
            continue;
          }
          const element = {};
          struct.readBytes(bytes, element, index + offset);
          omitEmptyOnRead ? result.push(element) : result[i] = element;
        }
        return result;
      },
      writeBytes: function(value, bytes, _, index) {
        assert(value.length <= size, "array is larger then expected");
        for (let i = 0;i < size; i++) {
          if (value[i] == undefined)
            continue;
          struct.writeBytes(value[i], bytes, i * struct.size + index);
        }
      }
    };
  } else {
    const _type = type;
    return {
      size: _type.size * size,
      readBytes: function(bytes, view, index) {
        const result = omitEmptyOnRead ? [] : Array(size);
        for (let i = 0;i < size; i++) {
          const offset = i * _type.size;
          if (omitEmptyOnRead && emptyArrayElement(bytes, index + offset, _type.size)) {
            continue;
          }
          const element = _type.readBytes(bytes, view, index + offset, littleEndian);
          omitEmptyOnRead ? result.push(element) : result[i] = element;
        }
        return result;
      },
      writeBytes: function(value, bytes, view, index) {
        assert(value.length <= size, "array is larger then expected");
        for (let i = 0;i < size; i++) {
          if (value[i] == undefined)
            continue;
          _type.writeBytes(value[i], bytes, view, i * _type.size + index, littleEndian);
        }
      }
    };
  }
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
