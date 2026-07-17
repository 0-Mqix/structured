import { type StructuredType } from "./structured";
/**
 * **Bit fields**
 *
 * A run of adjacent `bits(...)` / `bit` fields in a struct is packed together
 * bit-by-bit and the whole run is rounded up to `ceil(totalBits / 8)` bytes,
 * reproducing the layout a C compiler produces for a struct marked
 * `__attribute__((__packed__))`, byte-for-byte, in both little- and big-endian.
 *
 * - Little-endian: bits are packed starting from bit 0 (LSB) of the first byte
 *   upward; trailing padding lands in the high bits of the last byte.
 * - Big-endian: bits are packed starting from the MSB of the first byte
 *   downward; trailing padding lands in the low bits of the last byte.
 * - Signed bit fields are sign-extended on read.
 * - Values that overflow the bit width are silently truncated (masked).
 * - A non-bit field between bit fields ends the current run and starts a new one.
 * - A bit field cannot stand on its own: it can only be used inside a struct,
 *   and cannot be a direct array element (wrap it in a struct instead).
 */
export type BitFieldKind = "int" | "bool" | "converter";
/**
 * **BitsConverter**
 *
 * Transforms the raw unsigned integer of a bit field into a decoded value and
 * back. This is the runtime analog of packed's `BitsConverterInterface`
 * (`Set` = decode, `Integer` = encode). `encode` is optional: leave it out for
 * a decode-only field (the raw bits are written as 0), matching a Go converter
 * whose `Integer()` returns 0.
 */
export interface BitsConverter<T> {
    decode(raw: number): T;
    encode?(value: T): number;
}
export interface BitFieldInfo {
    bitSize: number;
    signed: boolean;
    kind: BitFieldKind;
    converter?: BitsConverter<any>;
}
interface BitFieldMarker {
    __bits: BitFieldInfo;
}
export declare function isBitField(type: any): type is BitFieldMarker;
/**
 * **bits(*size*, *signed*)**
 *
 * A bit-packed integer field of `size` bits.
 *
 * @param size The number of bits (1 - 53).
 * @param signed Whether the value is sign-extended on read. Defaults to false.
 */
export declare function bits(size: number, signed?: boolean): StructuredType<number>;
/**
 * **bits(*size*, *converter*)**
 *
 * A bit-packed field whose raw unsigned integer is decoded to `T` (and encoded
 * back) by a `BitsConverter`, like packed's `Bits[uint16](size, converter)`.
 *
 * @param size The number of bits (1 - 53).
 * @param converter Decodes the raw bits into a value and, optionally, back.
 */
export declare function bits<T>(size: number, converter: BitsConverter<T>): StructuredType<T>;
/**
 * **bit**
 *
 * A single-bit boolean field. Shorthand for a 1-bit `bits`, like C `x : 1`.
 */
export declare const bit: StructuredType<boolean>;
export interface BitGroupField extends BitFieldInfo {
    name: string;
    offset: number;
}
export interface BitGroup {
    bitGroup: true;
    size: number;
    totalBits: number;
    fields: BitGroupField[];
    readGroup(parent: {
        [key: string]: any;
    }, bytes: Uint8Array, view: DataView, index: number, littleEndian: boolean): void;
    writeGroup(parent: {
        [key: string]: any;
    }, bytes: Uint8Array, view: DataView, index: number, littleEndian: boolean, cleanEmptySpace: boolean): void;
}
export declare function isBitGroup(type: any): type is BitGroup;
export declare function createBitGroup(entries: {
    name: string;
    field: BitFieldInfo;
}[]): BitGroup;
export {};
