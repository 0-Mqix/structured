import type { Property, PropertyMap, StructuredType } from "./structured"
import Structured from "./structured"

export function assert(value: boolean, message?: string) {
	if (!value) {
		throw new Error(message)
	}
}

export function emptyArrayElement(bytes: Uint8Array, offset: number, elementSize: number) {
	let empty = true

	for (let j = 0; j < elementSize; j++) {
		if (bytes[offset + j] != 0) {
			empty = false
			break
		}
	}

	return empty
}

export function assertStructuredType(name: string, index: number, type: StructuredType<any>) {
	assert(typeof name === "string", `property ${index} "name must be a string`)
	assert(typeof type === "object", `property ${index} type must be an object`)
	assert(typeof type.size === "number", `property ${index} type requires a size property`)
	assert(typeof type.readBytes === "function", `property ${index} type requires a readByte function`)
	assert(typeof type.writeBytes === "function", `property ${index} type requires a writeByte function`)
}

export function loadPropertyMap(map: PropertyMap, struct: readonly Property[], size: { value: number }) {
	let i = 0

	for (const [name, type] of struct) {
		if (Array.isArray(type)) {
			const _map = new Map()
			loadPropertyMap(_map, type, size)
			map.set(name, _map)
		} else if (type instanceof Structured) {
			map.set(name, new Map(type.map))
			size.value += type.size
		} else {
			const _type = type as StructuredType<any>
			assertStructuredType(name, i, _type)
			map.set(name, _type)
			size.value += _type.size
		}

		i++
	}
}

export function readBytes(
	object: { [key: string]: any },
	map: PropertyMap,
	bytes: Uint8Array,
	view: DataView,
	index: number,
	littleEndian: boolean
): number {
	for (const [name, type] of map) {
		if (type instanceof Map) {
			if (typeof object[name] != "object") {
				object[name] = {}
			}
			
			index = readBytes(object[name], type, bytes, view, index, littleEndian)
		} else {
			object[name] = type.readBytes(bytes, view, index, littleEndian)
			index += type.size
		}
	}
	return index
}

export function writeBytes(
	object: { [key: string]: any },
	map: PropertyMap,
	bytes: Uint8Array,
	view: DataView,
	index: number,
	littleEndian: boolean
): number {
	for (const [name, type] of map) {
		if (type instanceof Map) {
			index = writeBytes(object[name], type, bytes, view, index, littleEndian)
		} else {
			assert(Object.hasOwn(object, name), "object has not the property")
			type.writeBytes(object[name], bytes, view, index, littleEndian)
			index += type.size
		}
	}
	return index
}