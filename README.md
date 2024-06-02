# Structured
This is a libary for serializing javascript objects from and to c like packed structs as an Uint8Array.

## Example
```js
import Structured, { uint32, float32, uint8, bool } from "."

const deviceDataStruct = new Structured(false, [
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
const responseDataStruct = new Structured(false, [
	["deviceId", uint32],
	["valid", bool],
]) 

const responseBytes = responseDataStruct.toBytes({deviceId: 5, valid: true}) 
```

## Structured
```ts
export default class Structured<const T extends readonly Property[]> {
    map: PropertyMap;
    size: number;
    littleEndian: boolean;
    constructor(littleEndian: boolean, struct: T);
    readBytes(bytes: Uint8Array, result: StructToObject<T>): void;
    writeBytes(object: StructToObject<T>, bytes: Uint8Array): void;
    toBytes(object: StructToObject<T>): Uint8Array;
    fromBytes(bytes: Uint8Array): StructToObject<T>;
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

### Custom Types
If you need a custom type you can create your own. you just need to follow the interface below that all types are based on.
```ts
export interface StructuredType<T> {
	size: number
	readBytes(bytes: Uint8Array, view: DataView, index: number, littleEndian: boolean): T
	writeBytes(value: T, bytes: Uint8Array, view: DataView, index: number, littleEndian: boolean): void
}
```
