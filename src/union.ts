import Structured, { type Property, type StructuredType, type InferOutputType, type PropertyMap } from "./structured"
import { loadPropertyMap, assertStructuredType, assert, readBytes, writeBytes } from "./utils"

export function union<const T extends readonly Property[]>(union: T): StructuredType<Partial<InferOutputType<T>>> {
	const map: PropertyMap = new Map()
	let size = 0

	for (const [name, type] of union) {
		const _size = { value: 0 }
		let i = 0

		if (Array.isArray(type)) {
			const _map = new Map()
			loadPropertyMap(_map, type, _size)
			map.set(name, _map)
		
        } else if (type instanceof Structured) {
			map.set(name, new Map(type.map))
			_size.value = type.size
		
        } else {
			const _type = type as StructuredType<any>
			assertStructuredType(name, i, _type)
			map.set(name, _type)
			_size.value = _type.size
		}

		if (_size.value > size) {
			size = _size.value
		}

		i++
	}

	return {
		size,
		readBytes: function (
			bytes: Uint8Array,
			result: InferOutputType<T>,
			view: DataView,
			index: number,
			littleEndian: boolean
		): void {
			assert(typeof result == "object", "result is not an object")

			for (const [name, type] of map) {

				if (type instanceof Map) {
					//@ts-ignore
					if (typeof result[name] != "object") result[name] = {}
					readBytes(result[name], type, bytes, view, index, littleEndian)
                } else {
					if (type.readBytes) {
						// @ts-ignore
						if (typeof result[name] != "object") result[i] = type.array ? [] : {}
						type.readBytes(bytes, result[name], view, index, littleEndian)
                    } else {
						// @ts-ignore
						result[name] = type.fromBytes(bytes, view, index, littleEndian)
					}
				}
			}
		},
		writeBytes: function (
			value: Partial<InferOutputType<T>>,
			bytes: Uint8Array,
			view: DataView,
			index: number,
			littleEndian
		) {
			let done = false
			for (const [_name, type] of map) {
				if (!Object.hasOwn(value, _name)) continue
				assert(!done, "union has multiple properties defined")
				done = true
                if (type instanceof Map) {
					// @ts-ignore
					writeBytes(value[_name], type, bytes, view, index, littleEndian)
                } else {
					type.writeBytes(value[_name], bytes, view, index, littleEndian)
				}
			}
		}
	}
}
