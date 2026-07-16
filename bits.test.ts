import { expect, test } from "bun:test"
import Structured, { array, bit, bits, endian, string, uint8, uint16, union } from "./src"

test("bit group little-endian layout", () => {
	// a: 3 bits, b: 5 bits -> 1 byte. LE packs from the LSB up.
	const struct = new Structured(true, true, [
		["a", bits(3)],
		["b", bits(5)]
	])

	expect(struct.size).toBe(1)

	const input = { a: 5, b: 19 }
	const bytes = struct.toBytes(input)
	// a=0b101 at bit 0, b=0b10011 at bit 3 -> 0b10011_101 = 0x9D
	expect(Array.from(bytes)).toEqual([0x9d])
	expect(struct.fromBytes(bytes)).toStrictEqual(input)
})

test("bit group big-endian layout", () => {
	// Same fields, big-endian packs from the MSB down (first field is highest).
	const struct = new Structured(false, true, [
		["a", bits(3)],
		["b", bits(5)]
	])

	const input = { a: 5, b: 19 }
	const bytes = struct.toBytes(input)
	// a=0b101 at bits 7..5, b=0b10011 at bits 4..0 -> 0b101_10011 = 0xB3
	expect(Array.from(bytes)).toEqual([0xb3])
	expect(struct.fromBytes(bytes)).toStrictEqual(input)
})

test("bit group spanning two bytes, little-endian", () => {
	const struct = new Structured(true, true, [
		["a", bits(10)],
		["b", bits(6)]
	])

	expect(struct.size).toBe(2)

	const input = { a: 1023, b: 42 }
	const bytes = struct.toBytes(input)
	// acc = 1023 | (42 << 10) = 0xABFF -> [0xFF, 0xAB]
	expect(Array.from(bytes)).toEqual([0xff, 0xab])
	expect(struct.fromBytes(bytes)).toStrictEqual(input)
})

test("bit group spanning two bytes, big-endian", () => {
	const struct = new Structured(false, true, [
		["a", bits(10)],
		["b", bits(6)]
	])

	const input = { a: 1023, b: 42 }
	const bytes = struct.toBytes(input)
	// acc = (1023 << 6) | 42 = 0xFFEA -> [0xFF, 0xEA]
	expect(Array.from(bytes)).toEqual([0xff, 0xea])
	expect(struct.fromBytes(bytes)).toStrictEqual(input)
})

test("straddling field with trailing padding, little-endian", () => {
	// 6 + 6 = 12 bits -> 2 bytes with 4 padding bits in the high nibble of byte 1.
	const struct = new Structured(true, true, [
		["a", bits(6)],
		["b", bits(6)]
	])

	const input = { a: 42, b: 21 }
	const bytes = struct.toBytes(input)
	// acc = 42 | (21 << 6) = 0x56A -> [0x6A, 0x05]
	expect(Array.from(bytes)).toEqual([0x6a, 0x05])
	expect(struct.fromBytes(bytes)).toStrictEqual(input)
})

test("signed bit fields sign-extend on read", () => {
	const struct = new Structured(true, true, [["x", bits(4, true)]])

	for (const value of [-8, -1, 0, 7]) {
		expect(struct.fromBytes(struct.toBytes({ x: value })).x).toBe(value)
	}

	// -1 masked to 4 bits is 0xF.
	expect(Array.from(struct.toBytes({ x: -1 }))).toEqual([0x0f])
})

test("overflowing values are truncated to the bit width", () => {
	const struct = new Structured(true, true, [["x", bits(4)]])
	// 0b1_0011 truncated to 4 bits -> 0b0011 = 3
	expect(struct.fromBytes(struct.toBytes({ x: 0b10011 })).x).toBe(3)
})

test("bit single-bit boolean", () => {
	const struct = new Structured(false, true, [
		["active", bit],
		["priority", bits(3)],
		["mode", bits(4)]
	])

	const input = { active: true, priority: 5, mode: 10 }
	const bytes = struct.toBytes(input)
	// big-endian: 1<<7 | 5<<4 | 10 = 0xDA
	expect(Array.from(bytes)).toEqual([0xda])
	expect(struct.fromBytes(bytes)).toStrictEqual(input)
})

test("bit runs reset around a normal field", () => {
	const struct = new Structured(true, true, [
		["x", uint8],
		["a", bit],
		["b", bits(3)],
		["y", uint16]
	])
	// 1 (uint8) + ceil(4/8)=1 (bit run) + 2 (uint16) = 4
	expect(struct.size).toBe(4)

	const input = { x: 200, a: true, b: 6, y: 40000 }
	expect(struct.fromBytes(struct.toBytes(input))).toStrictEqual(input)
})

test("bit group reads into a reused result object", () => {
	const struct = new Structured(true, true, [
		["a", bits(4)],
		["b", bits(4)]
	])

	const bytes = struct.toBytes({ a: 3, b: 9 })
	const result = { a: 0, b: 0 }
	struct.readBytes(bytes, result)
	expect(result).toStrictEqual({ a: 3, b: 9 })
})

test("per-field endianness override", () => {
	const struct = new Structured(false, true, [
		["big", uint16],
		["little", endian(true, uint16)]
	])

	const bytes = struct.toBytes({ big: 0x0102, little: 0x0102 })
	// big-endian [01,02], little-endian [02,01]
	expect(Array.from(bytes)).toEqual([0x01, 0x02, 0x02, 0x01])
	expect(struct.fromBytes(bytes)).toStrictEqual({ big: 0x0102, little: 0x0102 })
})

test("endian override on a nested struct", () => {
	const struct = new Structured(false, true, [["inner", endian(true, [["value", uint16]])]])

	const bytes = struct.toBytes({ inner: { value: 0x0102 } })
	expect(Array.from(bytes)).toEqual([0x02, 0x01])
	expect(struct.fromBytes(bytes)).toStrictEqual({ inner: { value: 0x0102 } })
})

test("string of exactly the field length is allowed", () => {
	const struct = new Structured(true, true, [["name", string(3)]])
	// "max" is exactly 3 bytes; this previously threw an off-by-one error.
	expect(() => struct.toBytes({ name: "max" })).not.toThrow()
	expect(struct.fromBytes(struct.toBytes({ name: "max" }))).toStrictEqual({ name: "max" })
})

test("duplicate field names are rejected", () => {
	expect(
		() =>
			new Structured(true, true, [
				["a", uint8],
				["a", uint8]
			])
	).toThrow()
})

test("bit fields cannot be bare array elements", () => {
	expect(() => array(4, bits(2))).toThrow()
})

test("bit fields cannot be used directly in a union", () => {
	expect(() => union([["a", bits(4)]])).toThrow()
})
