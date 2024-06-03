import { expect, test } from "bun:test"
import Structured, { bool, string } from "./src"
import { uint32 } from "./dist"

test("simple", () => {
	var a = new Structured(true, [
		["key", string(4)],
	])
	
	var b = new Structured(true, [
		["name", string(4)],
		["a", a],
		["c", [
			["test", bool], ["number", uint32]
		]]
	])

	const input = {
		name: "max",
		a: {
			key: "F1"
		},
		c: {
			test: true,
			number: 0
		}
	}

	console.log(b)
	
	const bytes = b.toBytes(input)
	console.log("bytes:", bytes)
	const output = b.fromBytes(bytes)
	console.log("output", output)
	expect(output).toStrictEqual(input)
})
