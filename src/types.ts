import Structured, { type StructuredType, type Property, type InferOutputType, type PropertyMap } from "./structured"
import { assert, assertStructuredType, emptyArrayElement, loadPropertyMap, readBytes, writeBytes } from "./utils"

function createDataViewType<T>(type: string, size: number): StructuredType<T> {
	return {
		size,
		readBytes: (_: Uint8Array, view: DataView, index: number, littleEndian: boolean): T => {
			//@ts-ignore
			return view[`get${type}`](index, littleEndian)
		},
		writeBytes: (value: T, _: Uint8Array, view: DataView, index: number, littleEndian: boolean): void => {
			//@ts-ignore
			view[`set${type}`](index, value, littleEndian)
		}
	}
}

export const uint8 = createDataViewType<number>("Uint8", 1)
export const int8 = createDataViewType<number>("Int8", 1)

export const uint16 = createDataViewType<number>("Uint16", 2)
export const int16 = createDataViewType<number>("Int16", 2)

export const uint32 = createDataViewType<number>("Uint32", 4)
export const int32 = createDataViewType<number>("Int32", 4)

export const float32 = createDataViewType<number>("Float32", 4)
export const float64 = createDataViewType<number>("Float64", 8)

export const int64 = createDataViewType<bigint>("BigInt64", 8)
export const uint64 = createDataViewType<bigint>("BigUint64", 8)

export const double = float64
export const long = int64

export const bool: StructuredType<boolean> = {
	size: 1,
	readBytes: function (bytes: Uint8Array, _: DataView, index: number): boolean {
		return bytes[index] ? true : false
	},
	writeBytes: function (value: boolean, bytes: Uint8Array, _: DataView, index: number) {
		bytes[index] = value ? 1 : 0
	}
}

export function string(size: number): StructuredType<string> {
	const encoder = new TextEncoder()

	return {
		size: size,
		readBytes: function (bytes: Uint8Array, _: DataView, index: number): string {
			let result = ""

			for (let i = 0; i < size; i++) {
				const byte = bytes[i + index]
				if (byte == 0 || byte == undefined) {
					break
				}
				result += String.fromCharCode(byte)
			}

			return result
		},
		writeBytes: function (value: string, bytes: Uint8Array, _: DataView, index: number) {
			assert(value.length < size, "string is larger then expected")
			let i = 0
			for (const byte of encoder.encode(value)) {
				bytes[index + i] = byte
				i++
			}
		}
	}
}

export function array<const T extends StructuredType<any> | Structured<any> | readonly Property[]>(
	size: number,
	type: T,
	omitEmptyOnRead = false
): StructuredType<InferOutputType<T>[]> {
	if (Array.isArray(type)) {
		//@ts-ignore
		type = new Structured(littleEndian, type)
	}

	if (type instanceof Structured) {
		const struct = type as Structured<any>

		return {
			size: type.size * size,
			readBytes: function (bytes: Uint8Array, _: DataView, index: number, littleEndian): InferOutputType<T>[] {
				const result = omitEmptyOnRead ? [] : Array(size)

				for (let i = 0; i < size; i++) {
					const offset = i * struct.size

					if (omitEmptyOnRead && emptyArrayElement(bytes, index + offset, struct.size)) {
						continue
					}

					const element = {} as InferOutputType<T>
					struct.readBytes(bytes, element, index + offset, littleEndian)
					omitEmptyOnRead ? result.push(element) : (result[i] = element)
				}
				return result
			},

			writeBytes: function (value: InferOutputType<T>[], bytes: Uint8Array, _: DataView, index: number, littleEndian): void {
				assert(value.length <= size, "array is larger then expected")
				for (let i = 0; i < size; i++) {
					if (value[i] == undefined) continue
					struct.writeBytes(value[i], bytes, i * struct.size + index, littleEndian)
				}
			}
		}
	} else {
		const _type = type as StructuredType<any>

		return {
			size: _type.size * size,
			readBytes: function (bytes: Uint8Array, view: DataView, index: number, littleEndian): InferOutputType<T>[] {
				const result = omitEmptyOnRead ? [] : Array(size)

				for (let i = 0; i < size; i++) {
					const offset = i * _type.size
					if (omitEmptyOnRead && emptyArrayElement(bytes, index + offset, _type.size)) {
						continue
					}

					const element = _type.readBytes(bytes, view, index + offset, littleEndian)
					omitEmptyOnRead ? result.push(element) : (result[i] = element)
				}
				return result
			},

			writeBytes: function (value: InferOutputType<T>[], bytes: Uint8Array, view: DataView, index: number, littleEndian): void {
				assert(value.length <= size, "array is larger then expected")
				for (let i = 0; i < size; i++) {
					if (value[i] == undefined) continue
					_type.writeBytes(value[i], bytes, view, i * _type.size + index, littleEndian)
				}
			}
		}
	}
}


export function union<const T extends readonly Property[]>(union: T): StructuredType<Partial<InferOutputType<T>>> {
	const map: PropertyMap = new Map()
	let size = 0

	for (const [name, type] of union) {
		const _size = { value: 0 }
		let i = 0

		if (Array.isArray(type)) {
			const _map = new Map()
			loadPropertyMap(_map, type, _size)
			map.set(name, _map)
		} else if (type instanceof Structured) {
			map.set(name, new Map(type.map))
			_size.value = type.size
		} else {
			const _type = type as StructuredType<any>
			assertStructuredType(name, i, _type)
			map.set(name, _type)
			_size.value = _type.size
		}

		if (_size.value > size) {
			size = _size.value
		}

		i++
	}
	
	return {
		size,
		readBytes: function (
			bytes: Uint8Array,
			view: DataView,
			index: number,
			littleEndian: boolean
		): InferOutputType<T> {
			const result = {} as { [key: string]: any }

			for (const [name, type] of map) {
				if (type instanceof Map) {
					result[name] = {}
					readBytes(result[name], type, bytes, view, index, littleEndian)
				} else {
					result[name] = type.readBytes(bytes, view, index, littleEndian)
				}
			}

			return result as InferOutputType<T>
		},
		writeBytes: function (
			value: Partial<InferOutputType<T>>,
			bytes: Uint8Array,
			view: DataView,
			index: number,
			littleEndian
		) {
			let done = false

			for (const [_name, type] of map) {
				if (!Object.hasOwn(value, _name)) continue 
				assert(!done, "union has multiple properties defined")
				done = true
				
				if (type instanceof Map) {
					writeBytes(value[_name] as {}, type, bytes, view, index, littleEndian)
				} else {
					type.writeBytes(value[_name], bytes, view, index, littleEndian)
				}
			}
		}
	}
}