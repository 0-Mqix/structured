import Structured, { type StructuredType, type Property, type InferOutputType } from "./structured"

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
export function endian<const T extends StructuredType<any> | Structured<any> | readonly Property[]>(
	littleEndian: boolean,
	type: T
): StructuredType<InferOutputType<T>> {
	let inner = type as StructuredType<any> | Structured<any>

	if (inner instanceof Array) {
		//@ts-ignore inline nested struct definition
		inner = new Structured(littleEndian, true, inner)
	}

	if (inner instanceof Structured) {
		const structured = inner
		return {
			size: structured.size,
			readBytes(bytes, result, view, index) {
				structured.readBytes(bytes, result, view, index, littleEndian)
			},
			writeBytes(value, bytes, view, index, _littleEndian, cleanEmptySpace) {
				structured.writeBytes(value, bytes as any, view, index, littleEndian, cleanEmptySpace)
			}
		} as StructuredType<InferOutputType<T>>
	}

	const _type = inner as StructuredType<any>

	const wrapper: StructuredType<any> = {
		size: _type.size,
		writeBytes(value, bytes, view, index, _littleEndian, cleanEmptySpace) {
			_type.writeBytes(value, bytes, view, index, littleEndian, cleanEmptySpace)
		}
	}

	// Preserve the marker the core uses to initialise [] vs {} for a reused result.
	//@ts-ignore
	if (_type.array) wrapper.array = true

	if (_type.readBytes) {
		wrapper.readBytes = (bytes, result, view, index) => _type.readBytes!(bytes, result, view, index, littleEndian)
	} else {
		wrapper.fromBytes = (bytes, view, index) => _type.fromBytes!(bytes, view, index, littleEndian)
	}

	return wrapper as StructuredType<InferOutputType<T>>
}
