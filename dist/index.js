// src/index.ts
var assert = function(value, message) {
  if (!value) {
    throw new Error(message);
  }
};

// src/types.ts
var generateDataViewTypes = function(type, size) {
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
var uint8 = generateDataViewTypes("Uint8", 1);
var int8 = generateDataViewTypes("Int8", 1);
var uint16 = generateDataViewTypes("Uint16", 2);
var int16 = generateDataViewTypes("Int16", 2);
var uint32 = generateDataViewTypes("Uint32", 4);
var int32 = generateDataViewTypes("Int32", 4);
var float32 = generateDataViewTypes("Float32", 4);
var float64 = generateDataViewTypes("Float64", 8);
var int64 = generateDataViewTypes("BigInt64", 8);
var uint64 = generateDataViewTypes("BigUint64", 8);
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

// src/index.ts
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
  readBytes(bytes, result) {
    assert(bytes.length == this.size, "the length of the bytes do not match");
    const view = new DataView(bytes.buffer);
    let index = 0;
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
  writeBytes(object, bytes) {
    assert(bytes.length == this.size, "the length of the bytes do not match");
    const view = new DataView(bytes.buffer);
    let index = 0;
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
export {
  uint8,
  uint64,
  uint32,
  uint16,
  long,
  int8,
  int64,
  int32,
  int16,
  float64,
  float32,
  double,
  Structured as default,
  bool
};
