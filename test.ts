import { sleep } from "bun"
import Structured, { array, string, int32 } from "./src"

var a = new Structured(true, [["key", array(10, string(10), false)]])

var b = new Structured(true, [
	["name", string(4)],
	["count", int32],
	["a", a],
])

const input = {
	name: "max",
	count: 0,
	a: {"key": ["max", "van", "moorsel"]}
}

const LOOPS = 1_000_000

const object = structuredClone(input)
const bytes = new Uint8Array(b.size) 
const view = new DataView(bytes.buffer) 

sleep(10_000)

for (let i = 0; i < LOOPS; i++) {
    b.writeBytes(object, bytes, view)
    object.count++
    b.readBytes(bytes, object, view)
}
