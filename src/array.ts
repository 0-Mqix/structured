import Structured, { type StructuredType, type Property, type InferOutputType } from "./structured"
import { assert, emptyArrayElement } from "./utils"

export function array<const T extends StructuredType<any> | Structured<any> | readonly Property[]>(
	size: number,
	type: T,
	omitEmptyRead = false
): StructuredType<InferOutputType<T>[]> {
	let _type = type as StructuredType<any> | Structured<any>

	if (Array.isArray(type)) {
		//@ts-ignore
		_type = new Structured(littleEndian, _type)
	}

	let structured = _type instanceof Structured

	return {
		//@ts-ignore
		array: true,
		size: _type.size * size,
		readBytes: function (
			bytes: Uint8Array,
			result: InferOutputType<T>[],
			view: DataView,
			index: number,
			littleEndian
		): void {
			assert(Array.isArray(result), "result is not an array")

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
						const object = {}
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
			littleEndian
		): void {
			assert(value.length <= size, "array is larger then expected")
			for (let i = 0; i < size; i++) {
				if (value[i] == undefined) continue

				if (structured) {
					//@ts-ignore
					_type.writeBytes(value[i], bytes, i * _type.size + index, littleEndian)
				} else {
					//@ts-ignore
					_type.writeBytes(value[i], bytes, view, i * _type.size + index, littleEndian)
				}
			}
		}
	}
}
