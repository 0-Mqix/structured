import { expect, test } from "bun:test"
import Structured, { array, bool, float32, int32, string, uint8, uint16, uint32, union } from "./src"

test("reads and writes a Uint8Array that is a view into a larger buffer", () => {
	const struct = new Structured(true, true, [
		["a", uint32],
		["b", float32],
		["c", uint16],
		["flag", bool],
		["name", string(4)]
	])

	// A Uint8Array positioned at a non-zero offset in a bigger buffer, like a
	// Web Bluetooth characteristic value or any subarray.
	const backing = new Uint8Array(64)
	const offset = 10
	const window = backing.subarray(offset, offset + struct.size)

	const input = { a: 0xdeadbeef, b: 1.5, c: 0x1234, flag: true, name: "max" }
	struct.writeBytes(input, window)

	// The bytes must land at the window, not at the start of the backing buffer.
	expect(backing.subarray(0, offset).every((x) => x === 0)).toBeTrue()

	// A fresh window over the same region must decode the same values — this is
	// what silently failed for numeric fields before byteOffset was passed.
	const readWindow = backing.subarray(offset, offset + struct.size)
	expect(struct.fromBytes(readWindow)).toStrictEqual(input)
})

test("size", () => {
	const struct = new Structured(false, true, [
		["a", array(10, int32, true)],
		["b", array(5, int32)],
		["c", [["a", array(5, string(16))]]],
		[
			"d",
			array(5, [
				["a", string(5)],
				["b", uint8]
			])
		],
		[
			"e",
			union([
				["a", uint8],
				["b", string(10)]
			])
		]
	])

	expect(struct.size).toBe(180)
})

test("string", () => {
	var struct = new Structured(true, true, [["name", string(4)]])
	const input = { name: "max" }
	const output = struct.fromBytes(struct.toBytes(input))
	expect(output).toStrictEqual(input)
})

test("array", () => {
	const struct = new Structured(false, true, [
		["numbersOmitEmpty", array(10, int32, true)],
		["numbers", array(5, int32)],
		["object", [["names", array(5, string(16))]]],
		[
			"objects",
			array(5, [
				["name", string(5)],
				["number", uint8]
			])
		]
	])

	const input = {
		numbersOmitEmpty: [1, 44, 11, 50],
		numbers: [0, 1, 2, 3],
		object: { names: [undefined, "a"] },
		objects: [
			{ name: "a", number: 1 },
			{ name: "b", number: 2 },
			{ name: "c", number: 3 }
		]
	}
	// @ts-ignore
	const bytes = struct.toBytes(input)
	const output = struct.fromBytes(bytes)

	const existingOutput = {
		numbersOmitEmpty: [0, 0, 0, 0, 5, 6, 7, 8],
		object: { names: ["", "abc", "dfe", ""] },
		objects: [undefined, { name: "8", number: 8 }, undefined, { name: "7", number: 7 }]
	}

	//@ts-ignore
	struct.readBytes(bytes, existingOutput)
	expect(output.numbers).toStrictEqual([0, 1, 2, 3, 0])
	expect(output.numbersOmitEmpty).toStrictEqual(input.numbersOmitEmpty)
	expect(existingOutput).toStrictEqual(output)
})

test("union", () => {
	var struct1 = new Structured(false, true, [
		["key", string(4)],
		["numbers", array(10, int32, true)]
	])

	const struct2 = new Structured(false, true, [
		[
			"test",
			union([
				["a", struct1],
				["b", string(6)],
				["c", uint8]
			])
		]
	])

	const input = { key: "max", numbers: [32, 35, 544, 78] }
	const bytes = struct2.toBytes({ test: { a: input } })
	const output = struct2.fromBytes(bytes)

	expect(output.test.a).toStrictEqual(input)
	expect(output.test.b?.startsWith("max")).toBeTrue()
	expect(output.test.c).toEqual("m".charCodeAt(0))
})

test("cleanEmptySpace", () => {
	const struct = new Structured(false, true, [
		["numbers", array(5, int32)],
		["object", [["names", array(5, string(16))]]],
		[
			"objects",
			array(5, [
				["name", string(5)],
				["number", uint8]
			])
		]
	])

	const input = {
		numbersOmitEmpty: [1, 44, 11, 50],
		numbers: [0, 1, 2, 3],
		object: { names: [undefined, "a"] },
		objects: [{ name: "a", number: 1 }, undefined, { name: "c", number: 3 }]
	}

	// @ts-ignore
	const bytes = struct.toBytes(input)
	let writeTestBuffer = new Uint8Array(struct.size).fill("?".charCodeAt(0))

	//@ts-ignore
	struct.writeBytes(input, writeTestBuffer)
	expect(struct.fromBytes(writeTestBuffer)).toStrictEqual(struct.fromBytes(bytes))

	writeTestBuffer = new Uint8Array(struct.size).fill("?".charCodeAt(0))
	struct.cleanEmptySpace = false
	//@ts-ignore
	struct.writeBytes(input, writeTestBuffer)
	expect(struct.fromBytes(writeTestBuffer)).not.toStrictEqual(struct.fromBytes(bytes))
})
