import { expect, test } from "bun:test"
import Structured, {
	array,
	bool,
	int32,
	string,
	uint16,
	uint32,
	uint8,
	union
} from "./src"

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
		["d", array(2, a, true)]
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
		d: [{ key: "F" }, { key: "F" }]
	}

	const bytes = b.toBytes(input)
	const output = b.fromBytes(bytes)
	expect(output).toStrictEqual(input)
})

test("union", () => {
	var a = new Structured(false, [
		["key", string(4)],
		["numbers", array(10, int32, false)]
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

	const bytes = b.toBytes({ test: { a: { key: "max", numbers: [32, 35, 544, 78] } } })
	const output = b.fromBytes(bytes)
	console.log(output)
})
