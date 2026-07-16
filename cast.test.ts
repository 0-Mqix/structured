import { expect, test } from "bun:test"
import Structured, { bits, cast, uint8 } from "./src"

enum Action {
	Idle = 0,
	Run = 1,
	Stop = 2
}

test("cast does not change the wire representation", () => {
	const plain = new Structured(true, true, [["action", uint8]])
	const casted = new Structured(true, true, [["action", cast<Action>(uint8)]])

	expect(casted.size).toBe(plain.size)
	expect(Array.from(casted.toBytes({ action: Action.Stop }))).toEqual(
		Array.from(plain.toBytes({ action: 2 }))
	)
	expect(casted.fromBytes(casted.toBytes({ action: Action.Run })).action).toBe(Action.Run)
})

test("cast composes with bit fields and keeps them grouped", () => {
	const struct = new Structured(true, true, [
		["priority", cast<0 | 1 | 2>(bits(2))],
		["rest", bits(6)]
	])

	// 2 + 6 bits coalesce into a single byte, exactly as without the cast.
	expect(struct.size).toBe(1)

	const input = { priority: 2 as const, rest: 40 }
	const bytes = struct.toBytes(input)
	// little-endian: 2 | (40 << 2) = 0xA2
	expect(Array.from(bytes)).toEqual([0xa2])
	expect(struct.fromBytes(bytes)).toStrictEqual(input)
})
