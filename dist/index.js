// src/bits.ts
function isBitField(type) {
  return type != null && typeof type === "object" && "__bits" in type;
}
function marker(info) {
  return {
    __bits: info,
    size: 0,
    fromBytes() {
      throw new Error("a bit field can only be used inside a struct");
    },
    writeBytes() {
      throw new Error("a bit field can only be used inside a struct");
    }
  };
}
function bits(size, arg) {
  assert(Number.isInteger(size) && size >= 1, "bit size must be a positive integer");
  assert(size <= 53, "bit size cannot exceed 53");
  if (arg && typeof arg === "object") {
    return marker({ bitSize: size, signed: false, kind: "converter", converter: arg });
  }
  return marker({ bitSize: size, signed: arg === true, kind: "int" });
}
var bit = marker({ bitSize: 1, signed: false, kind: "bool" });
function isBitGroup(type) {
  return type != null && typeof type === "object" && type.bitGroup === true;
}
function shiftOf(size, field, littleEndian) {
  if (littleEndian)
    return BigInt(field.offset);
  return BigInt(size * 8 - field.offset - field.bitSize);
}
function createBitGroup(entries) {
  const fields = [];
  let offset = 0;
  for (const { name, field } of entries) {
    fields.push({ ...field, name, offset });
    offset += field.bitSize;
  }
  const totalBits = offset;
  const size = Math.ceil(totalBits / 8);
  assert(size >= 1, "a bit group must contain at least one bit");
  return {
    bitGroup: true,
    size,
    totalBits,
    fields,
    readGroup(parent, bytes, _view, index, littleEndian) {
      let accumulator = 0n;
      for (let i = 0;i < size; i++) {
        const byte = BigInt(bytes[index + i]);
        accumulator |= byte << BigInt(8 * (littleEndian ? i : size - 1 - i));
      }
      for (const field of fields) {
        const mask = (1n << BigInt(field.bitSize)) - 1n;
        let raw = accumulator >> shiftOf(size, field, littleEndian) & mask;
        if (field.kind === "bool") {
          parent[field.name] = raw !== 0n;
          continue;
        }
        if (field.kind === "converter") {
          parent[field.name] = field.converter.decode(Number(raw));
          continue;
        }
        if (field.signed && (raw & 1n << BigInt(field.bitSize - 1)) !== 0n) {
          raw -= 1n << BigInt(field.bitSize);
        }
        parent[field.name] = Number(raw);
      }
    },
    writeGroup(parent, bytes, _view, index, littleEndian) {
      let accumulator = 0n;
      for (const field of fields) {
        const value = parent[field.name];
        const mask = (1n << BigInt(field.bitSize)) - 1n;
        let raw;
        if (field.kind === "bool") {
          raw = value ? 1n : 0n;
        } else if (field.kind === "converter") {
          const encoded = field.converter.encode ? field.converter.encode(value) : 0;
          raw = BigInt(encoded) & mask;
        } else {
          raw = BigInt(value ?? 0) & mask;
        }
        accumulator |= raw << shiftOf(size, field, littleEndian);
      }
      for (let i = 0;i < size; i++) {
        const byte = accumulator >> BigInt(8 * (littleEndian ? i : size - 1 - i)) & 0xffn;
        bytes[index + i] = Number(byte);
      }
    }
  };
}

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
function loadProperties(properties, struct) {
  let i = 0;
  let size = 0;
  const names = new Set;
  let currentBits = [];
  const flushBits = () => {
    if (currentBits.length == 0)
      return;
    const group = createBitGroup(currentBits);
    properties.push(["", group, group.size]);
    size += group.size;
    currentBits = [];
  };
  for (const [name, type] of struct) {
    assert(!names.has(name), `property "${name}" already exists`);
    names.add(name);
    if (isBitField(type)) {
      currentBits.push({ name, field: type.__bits });
      i++;
      continue;
    }
    flushBits();
    if (type instanceof Array) {
      const _properties = [];
      let _size = loadProperties(_properties, type);
      properties.push([name, _properties, _size]);
      size += _size;
    } else if (type instanceof Structured) {
      properties.push([name, Array.from(type.properties), type.size]);
      size += type.size;
    } else {
      const _type = type;
      assertStructuredType(name, i, _type);
      properties.push([name, _type, _type.size]);
      size += _type.size;
    }
    i++;
  }
  flushBits();
  return size;
}
function readBytes(result, properties, bytes, view, index, littleEndian) {
  for (let i = 0;i < properties.length; i++) {
    const name = properties[i][0];
    const type = properties[i][1];
    if (isBitGroup(type)) {
      type.readGroup(result, bytes, view, index, littleEndian);
      index += type.size;
    } else if (type instanceof Array) {
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
function writeBytes(object, properties, bytes, view, index, littleEndian, cleanEmptySpace) {
  for (let i = 0;i < properties.length; i++) {
    const name = properties[i][0];
    const type = properties[i][1];
    if (isBitGroup(type)) {
      type.writeGroup(object, bytes, view, index, littleEndian, cleanEmptySpace);
      index += type.size;
      continue;
    }
    if (type instanceof Array) {
      if (object[name] == undefined) {
        const size = properties[i][2];
        if (cleanEmptySpace)
          bytes.fill(0, index, index + size);
        index += size;
        continue;
      }
      index = writeBytes(object[name], type, bytes, view, index, littleEndian, cleanEmptySpace);
    } else {
      if (object[name] != null) {
        type.writeBytes(object[name], bytes, view, index, littleEndian, cleanEmptySpace);
      } else {
        if (cleanEmptySpace)
          bytes.fill(0, index, index + type.size);
      }
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
  cleanEmptySpace;
  constructor(littleEndian, cleanEmptySpace, struct) {
    this.littleEndian = littleEndian;
    this.cleanEmptySpace = cleanEmptySpace;
    this.size = loadProperties(this.properties, struct);
  }
  readBytes(bytes, result, view, index = 0, littleEndian) {
    assert(typeof result == "object", "result is undefined");
    if (!view)
      view = new DataView(bytes.buffer);
    readBytes(result, this.properties, bytes, view, index, littleEndian ?? this.littleEndian);
  }
  writeBytes(value, bytes, view, index = 0, littleEndian, overwriteEmtpy) {
    if (!view)
      view = new DataView(bytes.buffer);
    writeBytes(value, this.properties, bytes, view, index, littleEndian ?? this.littleEndian, overwriteEmtpy ?? this.cleanEmptySpace);
  }
  fromBytes(bytes) {
    const object = {};
    this.readBytes(bytes, object);
    return object;
  }
  toBytes(object) {
    const bytes = new Uint8Array(this.size);
    this.writeBytes(object, bytes);
    return bytes;
  }
}
// src/array.ts
function array(size, type, omitEmptyRead = false) {
  assert(!isBitField(type), "bit fields as direct array elements are not supported, wrap them in a struct");
  let _type = type;
  if (type instanceof Array) {
    _type = new Structured(true, true, _type);
  }
  const structured = _type instanceof Structured;
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
          if (structured || _type.readBytes) {
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
        if (structured || _type.readBytes) {
          if (typeof result[i] != "object")
            result[i] = type.array ? [] : {};
          _type.readBytes(bytes, result[i], view, offset, littleEndian);
        } else {
          result[i] = _type.fromBytes(bytes, view, offset, littleEndian);
        }
      }
    },
    writeBytes: function(value, bytes, view, index, littleEndian, cleanEmptySpace) {
      assert(value.length <= size, "array is larger then expected");
      for (let i = 0;i < size; i++) {
        const offset = i * _type.size + index;
        const element = value[i];
        if (element == undefined) {
          if (cleanEmptySpace) {
            bytes.fill(0, offset, offset + _type.size);
          }
          continue;
        }
        _type.writeBytes(element, bytes, view, offset, littleEndian, cleanEmptySpace);
      }
    }
  };
}
// src/union.ts
function union(union2) {
  const properties = [];
  let size = 0;
  for (const [name, type] of union2) {
    let _size = 0;
    let i = 0;
    assert(!isBitField(type), "bit fields are not supported directly in a union, wrap them in a struct");
    if (type instanceof Array) {
      const _properties = [];
      _size = loadProperties(_properties, type);
      properties.push([name, _properties, _size]);
    } else if (type instanceof Structured) {
      properties.push([name, Array.from(type.properties), type.size]);
      _size = type.size;
    } else {
      const _type = type;
      assertStructuredType(name, i, _type);
      properties.push([name, _type, _type.size]);
      _size = _type.size;
    }
    if (_size > size) {
      size = _size;
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
    writeBytes: function(value, bytes, view, index, littleEndian, cleanEmptySpace) {
      let done = false;
      for (let i = 0;i < properties.length; i++) {
        const name = properties[i][0];
        const type = properties[i][1];
        if (!(name in value))
          continue;
        assert(!done, "union has multiple properties defined");
        done = true;
        if (type instanceof Array) {
          writeBytes(value[name], type, bytes, view, index, littleEndian, cleanEmptySpace);
        } else {
          type.writeBytes(value[name], bytes, view, index, littleEndian, cleanEmptySpace);
          if (cleanEmptySpace)
            bytes.fill(0, index, index + size - type.size);
        }
      }
    }
  };
}
// src/endian.ts
function endian(littleEndian, type) {
  let inner = type;
  if (inner instanceof Array) {
    inner = new Structured(littleEndian, true, inner);
  }
  if (inner instanceof Structured) {
    const structured = inner;
    return {
      size: structured.size,
      readBytes(bytes, result, view, index) {
        structured.readBytes(bytes, result, view, index, littleEndian);
      },
      writeBytes(value, bytes, view, index, _littleEndian, cleanEmptySpace) {
        structured.writeBytes(value, bytes, view, index, littleEndian, cleanEmptySpace);
      }
    };
  }
  const _type = inner;
  const wrapper = {
    size: _type.size,
    writeBytes(value, bytes, view, index, _littleEndian, cleanEmptySpace) {
      _type.writeBytes(value, bytes, view, index, littleEndian, cleanEmptySpace);
    }
  };
  if (_type.array)
    wrapper.array = true;
  if (_type.readBytes) {
    wrapper.readBytes = (bytes, result, view, index) => _type.readBytes(bytes, result, view, index, littleEndian);
  } else {
    wrapper.fromBytes = (bytes, view, index) => _type.fromBytes(bytes, view, index, littleEndian);
  }
  return wrapper;
}
// src/cast.ts
function cast(type) {
  return type;
}

// src/types.ts
var uint8 = {
  size: 1,
  fromBytes: (_, view, index, littleEndian) => view.getUint8(index),
  writeBytes: (value, _, view, index, littleEndian) => view.setUint8(index, value)
};
var int8 = {
  size: 1,
  fromBytes: (_, view, index, littleEndian) => view.getInt8(index),
  writeBytes: (value, _, view, index, littleEndian) => view.setInt8(index, value)
};
var uint16 = {
  size: 2,
  fromBytes: (_, view, index, littleEndian) => view.getUint16(index, littleEndian),
  writeBytes: (value, _, view, index, littleEndian) => view.setUint16(index, value, littleEndian)
};
var int16 = {
  size: 2,
  fromBytes: (_, view, index, littleEndian) => view.getInt16(index, littleEndian),
  writeBytes: (value, _, view, index, littleEndian) => view.setInt16(index, value, littleEndian)
};
var uint32 = {
  size: 4,
  fromBytes: (_, view, index, littleEndian) => view.getUint32(index, littleEndian),
  writeBytes: (value, _, view, index, littleEndian) => view.setUint32(index, value, littleEndian)
};
var int32 = {
  size: 4,
  fromBytes: (_, view, index, littleEndian) => view.getInt32(index, littleEndian),
  writeBytes: (value, _, view, index, littleEndian) => view.setInt32(index, value, littleEndian)
};
var float32 = {
  size: 4,
  fromBytes: (_, view, index, littleEndian) => view.getFloat32(index, littleEndian),
  writeBytes: (value, _, view, index, littleEndian) => view.setFloat32(index, value, littleEndian)
};
var float64 = {
  size: 8,
  fromBytes: (_, view, index, littleEndian) => view.getFloat64(index, littleEndian),
  writeBytes: (value, _, view, index, littleEndian) => view.setFloat64(index, value, littleEndian)
};
var int64 = {
  size: 8,
  fromBytes: (_, view, index, littleEndian) => view.getBigInt64(index, littleEndian),
  writeBytes: (value, _, view, index, littleEndian) => view.setBigInt64(index, value, littleEndian)
};
var uint64 = {
  size: 8,
  fromBytes: (_, view, index, littleEndian) => view.getBigUint64(index, littleEndian),
  writeBytes: (value, _, view, index, littleEndian) => view.setBigUint64(index, value, littleEndian)
};
var bool = {
  size: 1,
  fromBytes: function(bytes, _, index) {
    return bytes[index] ? true : false;
  },
  writeBytes: function(value, bytes, _, index) {
    bytes[index] = value ? 1 : 0;
  }
};
function string(size) {
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
      assert(value.length <= size, "string is larger then expected");
      for (let i = 0;i < size; i++) {
        if (i < value.length) {
          bytes[index + i] = value.charCodeAt(i);
          continue;
        }
        bytes[index + i] = 0;
      }
    }
  };
}
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
  isBitGroup,
  isBitField,
  int8,
  int64,
  int32,
  int16,
  float64,
  float32,
  endian,
  double,
  Structured as default,
  createBitGroup,
  cast,
  bool,
  bits,
  bit,
  array
};
