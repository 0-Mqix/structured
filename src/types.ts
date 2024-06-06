import { type StructuredType } from "./structured"
import { assert } from "./utils"

export const uint8: StructuredType<number> = {
  size: 1,
  fromBytes: (_, view, index, littleEndian) => view.getUint8(index),
  writeBytes: (value, _, view, index, littleEndian) => view.setUint8(index, value),
};

export const int8: StructuredType<number> = {
  size: 1,
  fromBytes: (_, view, index, littleEndian) => view.getInt8(index),
  writeBytes: (value, _, view, index, littleEndian) => view.setInt8(index, value),
};

export const uint16: StructuredType<number> = {
  size: 2,
  fromBytes: (_, view, index, littleEndian) => view.getUint16(index, littleEndian),
  writeBytes: (value, _, view, index, littleEndian) => view.setUint16(index, value, littleEndian),
};

export const int16: StructuredType<number> = {
  size: 2,
  fromBytes: (_, view, index, littleEndian) => view.getInt16(index, littleEndian),
  writeBytes: (value, _, view, index, littleEndian) => view.setInt16(index, value, littleEndian),
};

export const uint32: StructuredType<number> = {
  size: 4,
  fromBytes: (_, view, index, littleEndian) => view.getUint32(index, littleEndian),
  writeBytes: (value, _, view, index, littleEndian) => view.setUint32(index, value, littleEndian),
};

export const int32: StructuredType<number> = {
  size: 4,
  fromBytes: (_, view, index, littleEndian) => view.getInt32(index, littleEndian),
  writeBytes: (value, _, view, index, littleEndian) => view.setInt32(index, value, littleEndian),
};

export const float32: StructuredType<number> = {
  size: 4,
  fromBytes: (_, view, index, littleEndian) => view.getFloat32(index, littleEndian),
  writeBytes: (value, _, view, index, littleEndian) => view.setFloat32(index, value, littleEndian),
};

export const float64: StructuredType<number> = {
  size: 8,
  fromBytes: (_, view, index, littleEndian) => view.getFloat64(index, littleEndian),
  writeBytes: (value, _, view, index, littleEndian) => view.setFloat64(index, value, littleEndian),
};

export const int64: StructuredType<bigint> = {
  size: 8,
  fromBytes: (_, view, index, littleEndian) => view.getBigInt64(index, littleEndian),
  writeBytes: (value, _, view, index, littleEndian) => view.setBigInt64(index, value, littleEndian),
};

export const uint64: StructuredType<bigint> = {
  size: 8,
  fromBytes: (_, view, index, littleEndian) => view.getBigUint64(index, littleEndian),
  writeBytes: (value, _, view, index, littleEndian) => view.setBigUint64(index, value, littleEndian),
};


export const bool: StructuredType<boolean> = {
	size: 1,
	fromBytes: function (bytes: Uint8Array, _: DataView, index: number): boolean {
		return bytes[index] ? true : false
	},
	writeBytes: function (value: boolean, bytes: Uint8Array, _: DataView, index: number) {
		bytes[index] = value ? 1 : 0
	}
}

/**
 * **string(*size*)**
 *  
 * @param size The amount of bytes that this string takes.
 */
export function string(size: number): StructuredType<string> {
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

			for (let i = 0; i < size; i++) {
				if (i < value.length) {
					bytes[index + i] = value.charCodeAt(i)
					continue
				}
				
				bytes[index + i] = 0
			}
		}
	}
}

export const double = float64;
export const long = int64;

export * from "./array"
export * from "./union"
