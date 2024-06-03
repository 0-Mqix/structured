import { expect, test } from "bun:test"
import Structured, { array, bool, float32, string, uint16, uint32, union } from "./src"

// test("simple", () => {
// 	var a = new Structured(true, [
// 		["key", string(4)],
// 	])
	
// 	var b = new Structured(true, [
// 		["name", string(4)],
// 		["a", a],
// 		["c", [
// 			["test", bool], ["number", uint32]
// 		]],
// 		["test", bool],
// 		["d", array(2, a, true)]
// 	])

// 	const input = {
// 		name: "max",
// 		a: {
// 			key: "F1"
// 		},
// 		c: {
// 			test: true,
// 			number: 0
// 		},
// 		test: true,
// 		d: [{key: "F"}, {key: "A"}]
// 	}

// 	console.log(b.size)

// 	const bytes = b.toBytes(input)
// 	console.log("bytes:", bytes)
// 	const output = b.fromBytes(bytes)
// 	console.log("-----------------")
// 	console.log("output", output)
// 	console.log("-----------------")
// 	expect(output).toStrictEqual(input)
// })


test("union", () => {
	var a = new Structured(true, [
		["key", string(20)],
	])
	
	const b = union([["a", a], ["b", float32]])
})