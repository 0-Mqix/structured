import { expect, test } from "bun:test"
import Structured, { uint32, float32, uint8, bool, long, string } from "./src"

test("simple", () => {
	var x = new Structured(true, [
		["name", string(4)],
	])

	const input = {
		name: "max"
	}

	const bytes = x.toBytes(input)
	console.log("bytes:", bytes)
	const output = x.fromBytes(bytes)
	console.log("output", output)
	expect(output).toStrictEqual(input)
})
