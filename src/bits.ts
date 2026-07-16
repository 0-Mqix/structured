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

export type BitFieldKind = "int" | "bool" | "converter"

/**
 * **BitsConverter**
 *
 * Transforms the raw unsigned integer of a bit field into a decoded value and
 * back. This is the runtime analog of packed's `BitsConverterInterface`
 * (`Set` = decode, `Integer` = encode). `encode` is optional: leave it out for
 * a decode-only field (the raw bits are written as 0), matching a Go converter
 * whose `Integer()` returns 0.
 */
export interface BitsConverter<T> {
	decode(raw: number): T
	encode?(value: T): number
}

export interface BitFieldInfo {
	bitSize: number
	signed: boolean
	kind: BitFieldKind
	converter?: BitsConverter<any>
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
export function bits(size: number, signed?: boolean): StructuredType<number>
/**
 * **bits(*size*, *converter*)**
 *
 * A bit-packed field whose raw unsigned integer is decoded to `T` (and encoded
 * back) by a `BitsConverter`, like packed's `Bits[uint16](size, converter)`.
 *
 * @param size The number of bits (1 - 53).
 * @param converter Decodes the raw bits into a value and, optionally, back.
 */
export function bits<T>(size: number, converter: BitsConverter<T>): StructuredType<T>
export function bits(size: number, arg?: boolean | BitsConverter<any>): StructuredType<any> {
	assert(Number.isInteger(size) && size >= 1, "bit size must be a positive integer")
	// JavaScript numbers hold integers exactly only up to 2^53, so a wider bit
	// field could not round-trip. Use a full-width type for anything larger.
	assert(size <= 53, "bit size cannot exceed 53")

	if (arg && typeof arg === "object") {
		return marker<any>({ bitSize: size, signed: false, kind: "converter", converter: arg })
	}

	return marker<number>({ bitSize: size, signed: arg === true, kind: "int" })
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

// A field's placement, precomputed once so the read/write hot path stays
// allocation-free. Numbers drive the fast path (runs that fit in 32 bits);
// bigints drive the fallback for wider runs.
interface FieldPlan {
	name: string
	kind: BitFieldKind
	signed: boolean
	converter?: BitsConverter<any>
	shiftLE: number
	shiftBE: number
	maskNum: number
	signBitNum: number
	shiftLEBig: bigint
	shiftBEBig: bigint
	maskBig: bigint
	signBitBig: bigint
	spanBig: bigint
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

	// A run of at most 32 bits fits in one JS int, so it can be assembled with
	// plain (much faster) bitwise ops instead of BigInt. Wider runs fall back to
	// BigInt, which handles any length. Both produce byte-identical output.
	const fast = totalBits <= 32

	const plan: FieldPlan[] = fields.map((f) => ({
		name: f.name,
		kind: f.kind,
		signed: f.signed,
		converter: f.converter,
		shiftLE: f.offset,
		shiftBE: size * 8 - f.offset - f.bitSize,
		// Number path. 0xFFFFFFFF >>> (32 - n) is a clean n-bit mask for 1..32.
		maskNum: fast ? 0xffffffff >>> (32 - f.bitSize) : 0,
		signBitNum: 2 ** (f.bitSize - 1),
		// BigInt path.
		shiftLEBig: BigInt(f.offset),
		shiftBEBig: BigInt(size * 8 - f.offset - f.bitSize),
		maskBig: (1n << BigInt(f.bitSize)) - 1n,
		signBitBig: 1n << BigInt(f.bitSize - 1),
		spanBig: 1n << BigInt(f.bitSize)
	}))

	return {
		bitGroup: true,
		size,
		totalBits,
		fields,

		readGroup(parent, bytes, _view, index, littleEndian) {
			if (fast) {
				let accumulator = 0
				for (let i = 0; i < size; i++) {
					accumulator |= bytes[index + i] << (8 * (littleEndian ? i : size - 1 - i))
				}
				accumulator >>>= 0 // treat as unsigned 32-bit

				for (const field of plan) {
					const shift = littleEndian ? field.shiftLE : field.shiftBE
					let raw = ((accumulator >>> shift) & field.maskNum) >>> 0

					if (field.kind === "bool") {
						parent[field.name] = raw !== 0
						continue
					}
					if (field.kind === "converter") {
						parent[field.name] = field.converter!.decode(raw)
						continue
					}
					if (field.signed && raw >= field.signBitNum) {
						raw -= field.signBitNum * 2
					}
					parent[field.name] = raw
				}
				return
			}

			let accumulator = 0n
			for (let i = 0; i < size; i++) {
				accumulator |= BigInt(bytes[index + i]) << BigInt(8 * (littleEndian ? i : size - 1 - i))
			}

			for (const field of plan) {
				const shift = littleEndian ? field.shiftLEBig : field.shiftBEBig
				let raw = (accumulator >> shift) & field.maskBig

				if (field.kind === "bool") {
					parent[field.name] = raw !== 0n
					continue
				}
				if (field.kind === "converter") {
					parent[field.name] = field.converter!.decode(Number(raw))
					continue
				}
				if (field.signed && (raw & field.signBitBig) !== 0n) {
					raw -= field.spanBig
				}
				parent[field.name] = Number(raw)
			}
		},

		writeGroup(parent, bytes, _view, index, littleEndian) {
			// The whole run is always written, so padding bits are zeroed and no
			// stale bits survive; cleanEmptySpace is inherently satisfied.
			if (fast) {
				let accumulator = 0
				for (const field of plan) {
					const value = parent[field.name]

					let raw: number
					if (field.kind === "bool") {
						raw = value ? 1 : 0
					} else if (field.kind === "converter") {
						raw = ((field.converter!.encode ? field.converter!.encode(value) : 0) & field.maskNum) >>> 0
					} else {
						raw = ((value ?? 0) & field.maskNum) >>> 0
					}

					accumulator |= raw << (littleEndian ? field.shiftLE : field.shiftBE)
				}

				for (let i = 0; i < size; i++) {
					bytes[index + i] = (accumulator >>> (8 * (littleEndian ? i : size - 1 - i))) & 0xff
				}
				return
			}

			let accumulator = 0n
			for (const field of plan) {
				const value = parent[field.name]

				let raw: bigint
				if (field.kind === "bool") {
					raw = value ? 1n : 0n
				} else if (field.kind === "converter") {
					raw = BigInt(field.converter!.encode ? field.converter!.encode(value) : 0) & field.maskBig
				} else {
					raw = BigInt(value ?? 0) & field.maskBig
				}

				accumulator |= raw << (littleEndian ? field.shiftLEBig : field.shiftBEBig)
			}

			for (let i = 0; i < size; i++) {
				bytes[index + i] = Number((accumulator >> BigInt(8 * (littleEndian ? i : size - 1 - i))) & 0xffn)
			}
		}
	}
}
