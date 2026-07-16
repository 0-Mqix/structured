import { type StructuredType } from "./structured"
import { assert } from "./utils"

/**
 * **Bit fields**
 *
 * A run of adjacent `bits(...)` / `bit` fields in a struct is packed together
 * bit-by-bit and the whole run is rounded up to `ceil(totalBits / 8)` bytes,
 * reproducing the layout a C compiler produces for a struct marked
 * `__attribute__((__packed__))`, byte-for-byte, in both little- and big-endian.
 *
 * - Little-endian: bits are packed starting from bit 0 (LSB) of the first byte
 *   upward; trailing padding lands in the high bits of the last byte.
 * - Big-endian: bits are packed starting from the MSB of the first byte
 *   downward; trailing padding lands in the low bits of the last byte.
 * - Signed bit fields are sign-extended on read.
 * - Values that overflow the bit width are silently truncated (masked).
 * - A non-bit field between bit fields ends the current run and starts a new one.
 * - A bit field cannot stand on its own: it can only be used inside a struct,
 *   and cannot be a direct array element (wrap it in a struct instead).
 */

export type BitFieldKind = "int" | "bool"

export interface BitFieldInfo {
	bitSize: number
	signed: boolean
	kind: BitFieldKind
}

interface BitFieldMarker {
	__bits: BitFieldInfo
}

export function isBitField(type: any): type is BitFieldMarker {
	return type != null && typeof type === "object" && "__bits" in type
}

// A bit field is typed as a StructuredType so it slots into a struct definition
// and its output type is inferred, but it never serializes on its own: adjacent
// bit fields are coalesced into a single packed run by `loadProperties`.
function marker<T>(info: BitFieldInfo): StructuredType<T> {
	return {
		__bits: info,
		size: 0,
		fromBytes() {
			throw new Error("a bit field can only be used inside a struct")
		},
		writeBytes() {
			throw new Error("a bit field can only be used inside a struct")
		}
	} as unknown as StructuredType<T>
}

/**
 * **bits(*size*, *signed*)**
 *
 * A bit-packed integer field of `size` bits.
 *
 * @param size The number of bits (1 - 53).
 * @param signed Whether the value is sign-extended on read. Defaults to false.
 */
export function bits(size: number, signed = false): StructuredType<number> {
	assert(Number.isInteger(size) && size >= 1, "bit size must be a positive integer")
	// JavaScript numbers hold integers exactly only up to 2^53, so a wider bit
	// field could not round-trip. Use a full-width type for anything larger.
	assert(size <= 53, "bit size cannot exceed 53")
	return marker<number>({ bitSize: size, signed, kind: "int" })
}

/**
 * **bit**
 *
 * A single-bit boolean field. Shorthand for a 1-bit `bits`, like C `x : 1`.
 */
export const bit: StructuredType<boolean> = marker<boolean>({ bitSize: 1, signed: false, kind: "bool" })

export interface BitGroupField extends BitFieldInfo {
	name: string
	offset: number
}

export interface BitGroup {
	bitGroup: true
	size: number
	totalBits: number
	fields: BitGroupField[]
	readGroup(
		parent: { [key: string]: any },
		bytes: Uint8Array,
		view: DataView,
		index: number,
		littleEndian: boolean
	): void
	writeGroup(
		parent: { [key: string]: any },
		bytes: Uint8Array,
		view: DataView,
		index: number,
		littleEndian: boolean,
		cleanEmptySpace: boolean
	): void
}

export function isBitGroup(type: any): type is BitGroup {
	return type != null && typeof type === "object" && type.bitGroup === true
}

// The shift that places a field inside the run, expressed against a single
// integer that spans the whole run. Little-endian counts from the LSB of the
// first byte; big-endian counts from the MSB of the first (lowest) byte, so the
// first field occupies the most-significant bits. This reproduces packed's
// per-word placement exactly, since the run treated as one wide integer and as
// a sequence of 64-bit words yields the same byte layout.
function shiftOf(size: number, field: BitGroupField, littleEndian: boolean): bigint {
	if (littleEndian) return BigInt(field.offset)
	return BigInt(size * 8 - field.offset - field.bitSize)
}

export function createBitGroup(entries: { name: string; field: BitFieldInfo }[]): BitGroup {
	const fields: BitGroupField[] = []
	let offset = 0

	for (const { name, field } of entries) {
		fields.push({ ...field, name, offset })
		offset += field.bitSize
	}

	const totalBits = offset
	const size = Math.ceil(totalBits / 8)

	assert(size >= 1, "a bit group must contain at least one bit")

	return {
		bitGroup: true,
		size,
		totalBits,
		fields,

		readGroup(parent, bytes, _view, index, littleEndian) {
			let accumulator = 0n

			for (let i = 0; i < size; i++) {
				const byte = BigInt(bytes[index + i])
				accumulator |= byte << BigInt(8 * (littleEndian ? i : size - 1 - i))
			}

			for (const field of fields) {
				const mask = (1n << BigInt(field.bitSize)) - 1n
				let raw = (accumulator >> shiftOf(size, field, littleEndian)) & mask

				if (field.kind === "bool") {
					parent[field.name] = raw !== 0n
					continue
				}

				if (field.signed && (raw & (1n << BigInt(field.bitSize - 1))) !== 0n) {
					raw -= 1n << BigInt(field.bitSize)
				}

				parent[field.name] = Number(raw)
			}
		},

		writeGroup(parent, bytes, _view, index, littleEndian) {
			let accumulator = 0n

			for (const field of fields) {
				const value = parent[field.name]
				const mask = (1n << BigInt(field.bitSize)) - 1n

				let raw: bigint
				if (field.kind === "bool") {
					raw = value ? 1n : 0n
				} else {
					raw = BigInt(value ?? 0) & mask
				}

				accumulator |= raw << shiftOf(size, field, littleEndian)
			}

			// The whole run is always written, so padding bits are zeroed and no
			// stale bits survive; cleanEmptySpace is inherently satisfied.
			for (let i = 0; i < size; i++) {
				const byte = (accumulator >> BigInt(8 * (littleEndian ? i : size - 1 - i))) & 0xffn
				bytes[index + i] = Number(byte)
			}
		}
	}
}
