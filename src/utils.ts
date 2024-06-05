import type { Property, Properties, StructuredType } from "./structured"
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
	assert(typeof type === "object", `property ${index}:${name} type must be an object`)
	assert(typeof type.size === "number", `property ${index}:${name} type requires a size property`)
	assert(
		(type.readBytes != undefined) != (type.fromBytes != undefined),
		`property ${index}:${name} type can only can have a readBytes or fromBytes function not both`
	)
	assert(
		type.readBytes == undefined || type.fromBytes == undefined,
		`property ${index}:${name} type requires a readBytes or fromBytes function`
	)
}

export function loadProperties(properties: Properties, struct: readonly Property[], size: { value: number }) {
	let i = 0
	for (const [name, type] of struct) {
		
		if (type instanceof Array) {
			const _properties: Properties = []
			loadProperties(_properties, type, size)
			properties.push([name, _properties])
		} else if (type instanceof Structured) {
			properties.push([name, Array.from(type.properties)])
			size.value += type.size
		} else {
			const _type = type as StructuredType<any>
			assertStructuredType(name, i, _type)
			properties.push([name, _type])
			size.value += _type.size
		}

		i++
	}
}

export function readBytes(
	result: { [key: string]: any },
	properties: Properties,
	bytes: Uint8Array,
	view: DataView,
	index: number,
	littleEndian: boolean
): number {
	for (let i = 0; i < properties.length; i++) {
		const name = properties[i][0]
		const type = properties[i][1]

		if (type instanceof Array) {
			if (typeof result[name] != "object") {
				result[name] = {}
			}
			index = readBytes(result[name], type, bytes, view, index, littleEndian)
		} else {
			if (type.readBytes) {
				if (typeof result[name] != "object") {
					// @ts-ignore
					result[name] = type.array ? [] : {}
				}
				type.readBytes(bytes, result[name], view, index, littleEndian)
			} else {
				// @ts-ignore
				result[name] = type.fromBytes(bytes, view, index, littleEndian)
			}
			index += type.size
		}
	}

	return index
}

export function writeBytes(
	object: { [key: string]: any },
	properties: Properties,
	bytes: Uint8Array,
	view: DataView,
	index: number,
	littleEndian: boolean
): number {
	for (let i = 0; i < properties.length; i++) {
		const name = properties[i][0]
		const type = properties[i][1]

		if (type instanceof Array) {
			index = writeBytes(object[name], type, bytes, view, index, littleEndian)
		} else {
			assert(Object.hasOwn(object, name), "object does not have the property")
			type.writeBytes(object[name], bytes, view, index, littleEndian)
			index += type.size
		}
	}
	return index
}
