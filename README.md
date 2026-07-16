# Structured
This is a library for serialization of javascript objects from and to c like packed structs as an Uint8Array.

It supports bit fields that reproduce the layout a C compiler produces for a struct marked `__attribute__((__packed__))`, byte-for-byte, in both little- and big-endian, which makes it a drop-in for decoding messages from microcontrollers.

## Install
```npm install @mqix/structured```

Or copy the index.js file from the dist folder.

## Example
```js
import Structured, { uint32, float32, uint8, bool } from "."

const deviceDataStruct = new Structured(false, true, [
	["deviceId", uint32],
	["temperature", float32],
	["humidity", float32],
	["batteryLevel", uint8],
	["isOnline", bool],
	["location", [
		["latitude", float32],
		["longitude", float32]
	]]
]) 

const bytes = new Uint8Array([...])
const data = deviceDataStruct.fromBytes(bytes)
```
If you using typescript the object gets infered from the constructor like this below.
```ts
const data: {
    deviceId: number;
    temperature: number;
    humidity: number;
    batteryLevel: number;
    isOnline: boolean;
    location: {
        latitude: number;
        longitude: number;
    };
}
```
And to create an buffer from an object looks like this below.
```ts
const responseDataStruct = new Structured(false, true, [
	["deviceId", uint32],
	["valid", bool],
]) 

const responseBytes = responseDataStruct.toBytes({deviceId: 5, valid: true}) 
```

## Structured
```ts
/**
 * **Structured**
 * 
 * `cleanEmptySpace` in `writeBytes` needs to be true if you want to make sure all the empty spaces in the value
 * are written as zeros. This is useful when you reuse the `Uint8Array`
 *  
 * The `result` you pass in `readBytes` can be fully reused if it the same shape. In this case it does not create objects unless something is missing. 
 */
class Structured {
    properties: Properties;
    size: number;
    littleEndian: boolean;
    cleanEmptySpace: boolean;
    constructor(littleEndian: boolean, cleanEmptySpace: boolean, struct: T);
    readBytes(bytes: Uint8Array, result: StructToObject<T>, view?: DataView, index?: number, littleEndian?: boolean): void;
    writeBytes(value: StructToObject<T>, bytes: Uint8Array, view?: DataView, index?: number, littleEndian?: boolean, cleanEmptySpace?: boolean): void;
    fromBytes(bytes: Uint8Array): StructToObject<T>;
    toBytes(object: StructToObject<T>): Uint8Array;
}
```

## Types
This libary also has predefined types for the structs.

| Symbol | JavaScript Type |
|-|-|
| uint8 | number |
| int8 | number |
| uint16 | number |
| int16 | number |
| uint32 | number |
| int32 | number |
| float32 | number |
| float64 | number |
| int64 | bigint |
| uint64 | bigint |
| double | number |
| long | bigint |
| bool | boolean |
| string(*size*) | string |
| bits(*size*, *signed*) | number |
| bit | boolean |

### Structured
You could use instance of `Structure` as a type.

```ts
const a = new Structure(true, true, [
  ["value", int16]
])

const b = new Structure(true, true, [
  ["name", string(16)]
  ["a", a] 
])
```

Or you could use the `[["name", type]]` syntax for nested types directly.

### Arrays
```ts 
array(size, uint8, true)
```
The last arguments of array is of type boolean and indicates that it should leave out values where all its bytes are zero in the result.

### Union Types
```ts
union([
  ["a", uint8],
  ["b", string(10)]
])
```

### Bit Fields
A run of adjacent `bits(...)` / `bit` fields is packed together bit-by-bit and the whole run is rounded up to `ceil(totalBits / 8)` bytes, exactly like a C `__attribute__((__packed__))` struct.

```ts
const flags = new Structured(false, true, [
  ["active", bit],        // 1 bit
  ["priority", bits(3)],  // 3 bits
  ["mode", bits(4)],      // 4 bits -> the run fills 1 byte
])
```

- Little-endian packs from bit 0 (LSB) of the first byte upward; trailing padding lands in the high bits of the last byte.
- Big-endian packs from the MSB of the first byte downward; trailing padding lands in the low bits of the last byte.
- Pass `true` as the second argument of `bits` for a signed field; it is sign-extended on read.
- Values that overflow the bit width are silently truncated (masked).
- A non-bit field between bit fields ends the current run and starts a new one.
- Bit groups use the surrounding struct's endianness.
- A bit field cannot be a bare array element or a direct union member; wrap it in a struct.

### Endianness
The byte order of a struct is set by the first `Structured` constructor argument, and can be overridden per call in `readBytes` / `writeBytes`. A single field can override it with `endian`.

```ts
new Structured(false, true, [
  ["big", uint32],               // big-endian (the struct default)
  ["little", endian(true, uint32)], // this field only is little-endian
])
```
`endian(littleEndian, type)` wraps any type, struct instance, or inline `[["name", type]]` definition. Nested types inside the wrapped type inherit the override.

### Custom Types
If you need a custom type you can create your own. you just need to follow the interface below that all types are based on.
```ts
/**
 * **StructuredType**
 * 
 * This is the interface that all the types have.
 *
 * `size` is the fixed ammount of bytes the type consumes in the memory layout.
 *
 * if `cleanEmptySpace` in `writeBytes` is true the  unused bytes of the type to be set to zero in the `bytes`.
 *  
 * Implement `fromBytes` if you want to create an inmutable type.
 * Else if you want to create mutable type you need implement the `readBytes` function.
 * You cant have both.
 */
export interface StructuredType<T> {
	size: number
	fromBytes?(bytes: Uint8Array, view: DataView, index: number, littleEndian: boolean): T
	readBytes?(bytes: Uint8Array, result: T, view: DataView, index: number, littleEndian: boolean): void
	writeBytes(value: T, bytes: Uint8Array, view: DataView, index: number, littleEndian: boolean, cleanEmptySpace: boolean): void
}
```
