import Structured, { type StructuredType, type Property, type InferOutputType } from "./structured";
/**
 * **endian(*littleEndian*, *type*)**
 *
 * Wraps a type so it is always read and written with the given byte order,
 * overriding the endianness of the surrounding struct for this field only.
 * Nested structs and arrays inside the wrapped type inherit the override.
 *
 * This mirrors packed's per-field `LittleEndian(...)` option and is useful for
 * mixed-endian protocols.
 *
 * @example
 * ```
 * new Structured(false, true, [
 *   ["big", uint32],
 *   ["little", endian(true, uint32)]
 * ])
 * ```
 */
export declare function endian<const T extends StructuredType<any> | Structured<any> | readonly Property[]>(littleEndian: boolean, type: T): StructuredType<InferOutputType<T>>;
