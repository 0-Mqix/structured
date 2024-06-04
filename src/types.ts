import { type StructuredType } from "./structured"
import { assert } from "./utils"

function createDataViewType<T extends number | bigint>(type: string, size: number): StructuredType<T> {
	return {
		//@ts-ignore
		size,
		fromBytes: (_: Uint8Array, view: DataView, index: number, littleEndian: boolean): T => {
			//@ts-ignore
			return view[`get${type}`](index, littleEndian)
		},
		writeBytes: (value: T, _: Uint8Array, view: DataView, index: number, littleEndian: boolean): void => {
			//@ts-ignore
			view[`set${type}`](index, value, littleEndian)
		}
	}
}

export const bool: StructuredType<boolean> = {
	size: 1,
	fromBytes: function (bytes: Uint8Array, _: DataView, index: number): boolean {
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
		fromBytes: function (bytes: Uint8Array, _: DataView, index: number): string {
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

export * from "./array"
export * from "./union"
