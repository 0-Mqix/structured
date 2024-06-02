import { expect, test } from "bun:test"
import { Endian, Structured } from "./src"
import { bool, float32, long, uint32, uint8 } from "./src/types"

test("simple", () => {
	var x = new Structured(Endian.Little, [
		["bruh", uint32],
		["float", float32],
		[
			"nested",
			[
				["1", uint8],
				["2", uint8],
				["3", bool],
				["4", [["gin", long]]]
			]
		]
	])

	const input = {
		bruh: 1000,
		float: 15.5,
		nested: {
			1: 0,
			2: 4,
			3: true,
			4: { gin: BigInt(2234234) }
		}
	}

	const bytes = x.writeBytes(input)
	const output = x.readBytes(bytes)
	expect(output).toStrictEqual(input)
})
