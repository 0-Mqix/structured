import { expect, test } from "bun:test"
import Structured, { array, bool, int32, string, uint16, uint32, uint8, union } from "./src"

test("simple", () => {
	var a = new Structured(true, [["key", string(4)]])

	var b = new Structured(true, [
		["name", string(4)],
		["a", a],
		[
			"c",
			[
				["test", bool],
				["number", uint32],
				["more", [["bros", uint16]]]
			]
		],
		["test", bool],
		["d", array(2, a)]
	])

	const input = {
		name: "max",
		a: {
			key: "F1"
		},
		c: {
			test: true,
			number: 0,
			more: {
				bros: 5
			}
		},
		test: true,
		d: [{ key: "F" }, { key: "A" }]
	}

	const bytes = b.toBytes(input)
	const output = b.fromBytes(bytes)
	expect(output).toStrictEqual(input)
})

test("union", () => {
	var a = new Structured(false, [
		["key", string(4)],
		["numbers", array(10, int32)]
	])

	const b = new Structured(false, [
		[
			"test",
			union([
				["a", a],
				["b", string(6)],
				["c", uint8]
			])
		]
	])

	const value = { key: "max", numbers: [32, 35, 544, 78]}
	const bytes = b.toBytes({ test: { a: value } })
	const output = b.fromBytes(bytes)
	
	expect(output.test.a).toStrictEqual(value)
})

test("reuse", () => {
	var a = new Structured(false, [
		["key", string(4)],
	])

	const b = new Structured(false, [
		["test", a],
		["numbers", array(10, uint16)],
		["age", int32],
		["keys", array(5, a)]
	])
	
	const input = {test: {key: "F1"}, numbers:[1, 33, 44, 11], age: 20, keys: [{key: "A"}, {key: "B"}, {key: "C"}]}
	const output1 = {test: {key: ""}, numbers:[0, 0, 0, 0, 5, 6, 7, 8]}

	const bytes = b.toBytes(input)
	//@ts-ignore
	b.readBytes(bytes, output1)
	const output2 = b.fromBytes(bytes)

	expect(output1).toStrictEqual(input)
	//@ts-ignore
	expect(output2).toStrictEqual(output1)

})


test("omitEmtpyRead", () => {

	const b = new Structured(false, [
		["numbers", array(10, uint16, false)],
	])
	
	const input = {numbers:[1, 0, 44, 11, 0, 50]}
	const bytes = b.toBytes(input)

	const output1 = {numbers:[0, 0, 0, 0, 5, 6, 7, 8]}
	b.readBytes(bytes, output1)
	const output2 = b.fromBytes(bytes)

	console.log(output1.numbers)
	console.log(output2.numbers)
})