import Structured, { type StructuredType, type Property, type InferOutputType } from "./structured"
import { assert, emptyArrayElement } from "./utils"

/**
 * **array(*size*, *type*, *omitZeroRead*)**
 * 
 * @param size The amount of elements.
 * @param type The **StructuredType** of the elements.
 * @param omitEmptyRead Does not add the element to the result if all its bytes are zero.
 */
export function array<const T extends StructuredType<any> | Structured<any> | readonly Property[]>(
	size: number,
	type: T,
	omitEmptyRead = false
): StructuredType<InferOutputType<T>[]> {
	let _type = type as StructuredType<any> | Structured<any>

	if (type instanceof Array) {
		//@ts-ignore
		_type = new Structured(true, true, _type)
	}

	const structured = _type instanceof Structured

	return {
		//@ts-ignore
		array: true,
		size: _type.size * size,
		readBytes: function (
			bytes: Uint8Array,
			result: InferOutputType<T>[],
			view: DataView,
			index: number,
			littleEndian: boolean
		): void {
			assert(result instanceof Array, "result is not an array")

			while (result.length > size) {
				result.pop()
			}

			for (let i = 0; i < size; i++) {
				const offset = i * _type.size + index
				
				if (i > result.length - 1) {
					
					if (omitEmptyRead && emptyArrayElement(bytes, offset, _type.size)) {
						continue
					}

					if (structured || _type.readBytes) {
						//@ts-ignore
						const object = _type.array ? [] : {}
						//@ts-ignore
						_type.readBytes(bytes, object, view, offset, littleEndian)
						//@ts-ignore
						result.push(object)
					} else {
						// @ts-ignore
						result.push(_type.fromBytes(bytes, view, offset, littleEndian))
					}
					continue
				}

				if (omitEmptyRead && emptyArrayElement(bytes, offset, _type.size)) {
					result.splice(i, 1)
					i--
					continue
				}

				if (structured || _type.readBytes) {
					// @ts-ignore
					if (typeof result[i] != "object") result[i] = type.array ? [] : {}
					// @ts-ignore
					_type.readBytes(bytes, result[i], view, offset, littleEndian)
				} else {
					// @ts-ignore
					result[i] = _type.fromBytes(bytes, view, offset, littleEndian)
				}
			}
		},

		writeBytes: function (
			value: InferOutputType<T>[],
			bytes: Uint8Array,
			view: DataView,
			index: number,
			littleEndian: boolean,
			cleanEmptySpace: boolean
		): void {
			assert(value.length <= size, "array is larger then expected")
	
			for (let i = 0; i < size; i++) {
				
				const offset = i * _type.size + index;
				const element = value[i]
				
				if (element == undefined) {
					if (cleanEmptySpace) { bytes.fill(0, offset, offset + _type.size) }
					continue
				}

				_type.writeBytes(element, bytes, view, offset, littleEndian, cleanEmptySpace)
			}
		}
	}
}
