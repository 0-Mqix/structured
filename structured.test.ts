import { expect, test } from "bun:test";
import { Endian, Structured } from ".";
import { bool, uint8 } from "./types/int";

test("simple", () => {
    var x = new Structured(Endian.Little, [
        ["bruh", bool],
        ["count", uint8]
    ])

    console.log(x.fromBytes(new Uint8Array([1, 16])))
    
    console.log(x.toBytes({bruh: false, count: 200}))
});