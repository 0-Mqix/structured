import { assert, type StructuredType } from ".."

export const uint8: StructuredType<number> = {
	size: 1,
	readBytes: function (bytes: Uint8Array, index: number) {
        return bytes[index]
	},
	writeBytes: function (value: number): Uint8Array {
		return new Uint8Array([value])
	}
}

export const uint16: StructuredType<number> = {
	size: 2,
	readBytes: function (bytes: Uint8Array, index: number) {
        return bytes[index]
	},
	writeBytes: function (value: number): Uint8Array {
		return new Uint8Array([value])
	}
}

export const bool: StructuredType<boolean> = {
	size: 1,
	readBytes: function (bytes: Uint8Array, index: number): boolean {
		const value = bytes[index]
		assert(value == 0 || value == 1, `value at ${index} is not a boolean`)
		return value ? true : false
	},
	writeBytes: function (value: boolean, bytes: Uint8Array, index: number) {
		bytes[index] = value ? 1 : 0
	}
}