import { expect, test } from "bun:test"
import Structured, { uint32, float32, uint8, bool, long } from "./src"

test("simple", () => {
	var x = new Structured(true, [
		["friends", uint32],
		["size", float32],
		[
			"nested",
			[
				["1", uint8],
				["2", uint8],
				["3", bool],
				["4", [["money", long]]]
			]
		]
	])

	const input = {
		friends: 1000,
		size: 15.5,
		nested: {
			1: 0,
			2: 4,
			3: true,
			4: { money: BigInt(2234234) }
		}
	}

	const bytes = x.toBytes(input)
	const output = x.fromBytes(bytes)
	expect(output).toStrictEqual(input)
})
