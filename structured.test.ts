import { expect, test } from "bun:test"
import Structured, { array, bool, int16, int32, long, string as string, uint16, uint32, uint8, union } from "./src"
import { idText } from "typescript"
import { heapStats } from "bun:jsc"
import { sleep } from "bun"

// test("simple", () => {
// 	var a = new Structured(true, [["key", string_x(4)]])

// 	var b = new Structured(true, [
// 		["name", string_x(4)],
// 		["a", a],
// 		[
// 			"c",
// 			[
// 				["test", bool],
// 				["number", uint32],
// 				["more", [["bros", uint16]]]
// 			]
// 		],
// 		["test", bool],
// 		["d", array(2, a)]
// 	])

// 	const input = {
// 		name: "max",
// 		a: {
// 			key: "F1"
// 		},
// 		c: {
// 			test: true,
// 			number: 0,
// 			more: {
// 				bros: 5
// 			}
// 		},
// 		test: true,
// 		d: [{ key: "F" }, { key: "A" }]
// 	}

// 	const bytes = b.toBytes(input)
// 	const output = b.fromBytes(bytes)
// 	expect(output).toStrictEqual(input)
// })

// test("union", () => {
// 	var a = new Structured(false, [
// 		["key", string_x(4)],
// 		["numbers", array(10, int32, true)]
// 	])

// 	const b = new Structured(false, [
// 		[
// 			"test",
// 			union([
// 				["a", a],
// 				["b", string_x(6)],
// 				["c", uint8]
// 			])
// 		]
// 	])

// 	const value = { key: "max", numbers: [32, 35, 544, 78] }
// 	const bytes = b.toBytes({ test: { a: value } })
// 	const output = b.fromBytes(bytes)

// 	expect(output.test.a).toStrictEqual(value)
// })

// test("reuse", () => {
// 	var a = new Structured(false, [["key", string_x(4)]])

// 	const b = new Structured(false, [
// 		["test", a],
// 		["numbers", array(10, uint16, true)],
// 		["age", int32],
// 		["keys", array(5, a, true)]
// 	])

// 	const input = {
// 		test: { key: "F1" },
// 		numbers: [1, 33, 44, 11],
// 		age: 20,
// 		keys: [{ key: "A" }, { key: "B" }, { key: "C" }]
// 	}
// 	const output1 = { test: { key: "" }, numbers: [0, 0, 0, 0, 5, 6, 7, 8] }

// 	const bytes = b.toBytes(input)
// 	//@ts-ignore
// 	b.readBytes(bytes, output1)
// 	const output2 = b.fromBytes(bytes)

// 	expect(output1).toStrictEqual(input)
// 	//@ts-ignore
// 	expect(output2).toStrictEqual(output1)
// })

// test("omitEmtpyRead", () => {
// 	const b = new Structured(false, [["numbers", array(10, uint16, true)]])

// 	const input = { numbers: [1, 44, 11, 50] }
// 	const bytes = b.toBytes(input)

// 	const output1 = { numbers: [0, 0, 0, 0, 5, 6, 7, 8] }
// 	b.readBytes(bytes, output1)
// 	const output2 = b.fromBytes(bytes)

// 	expect(output1).toStrictEqual(input)
// 	expect(output2).toStrictEqual(output1)
// })

// var a = new Structured(true, [["key", array(10, string(10), false)]])

test("string", () => {
	var struct = new Structured(true, [["name", string(4)]])

	const input = { name: "max" }

	const output = struct.fromBytes(struct.toBytes(input))
	expect(output).toStrictEqual(input)
})


var b = new Structured(true, [
	["name", string(4)],
	["a", int32],
	["b", int32],
	["c", array(5, int16)]
])

const input = {
	name: "max",
	a: 0,
	b: 1,
	c: [1, 2, 3, 4, 5]
	// a: {"key": ["max", "van", "moorsel"]}
}

const LOOPS = 1_000_000

test("stcutured", () => {
	const object = structuredClone(input)
	const bytes = new Uint8Array(b.size)
	const view = new DataView(bytes.buffer)
	const start = Bun.nanoseconds()

	for (let i = 0; i < LOOPS; i++) {
		b.writeBytes(object, bytes, view)
		object.a++
		object.b += 2
		b.readBytes(bytes, object, view)
	}

	console.log(Bun.nanoseconds() - start)
})

test("json", () => {
	const object = structuredClone(input)
	const start = Bun.nanoseconds()
	for (let i = 0; i < LOOPS; i++) {
		const output = JSON.stringify(object)
		object.a++
		object.b += 2
		//@ts-ignore
		JSON.parse(output, object)
	}
	console.log(Bun.nanoseconds() - start)
})
