import Structured, { type Property, type StructuredType, type InferOutputType, type Properties } from "./structured"
import { loadProperties, assertStructuredType, assert, readBytes, writeBytes } from "./utils"

export function union<const T extends readonly Property[]>(union: T): StructuredType<Partial<InferOutputType<T>>> {
	const properties: Properties = []
	let size = 0

	for (const [name, type] of union) {
		const _size = { value: 0 }
		let i = 0

		if (type instanceof Array) {
			const _properties: Properties = []
			loadProperties(_properties, type, _size)
			properties.push([name, _properties])
		} else if (type instanceof Structured) {
			properties.push([name, Array.from(type.properties)])
			_size.value = type.size
		} else {
			const _type = type as StructuredType<any>
			assertStructuredType(name, i, _type)
			properties.push([name, _type])
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

			for (let i = 0; i < properties.length; i++) {
				const name = properties[i][0]
				const type = properties[i][1]
			
				if (type instanceof Array) {
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
			for (let i = 0; i < properties.length; i++) {
				const name = properties[i][0]
				const type = properties[i][1]
				
				if (!(name in value)) continue
				assert(!done, "union has multiple properties defined")
				
				done = true
				if (type instanceof Array) {
					// @ts-ignore
					writeBytes(value[name], type, bytes, view, index, littleEndian)
				} else {
					type.writeBytes(value[name], bytes, view, index, littleEndian)
				}
			}
		}
	}
}
