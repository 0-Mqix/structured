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

export function loadProperties(properties: Properties, struct: readonly Property[]): number {
	let i = 0
	let size = 0

	for (const [name, type] of struct) {
		if (type instanceof Array) {
			const _properties: Properties = []
			let _size = loadProperties(_properties, type)
			properties.push([name, _properties, _size])
			size += _size
		} else if (type instanceof Structured) {
			properties.push([name, Array.from(type.properties), type.size])
			size += type.size
		} else {
			const _type = type as StructuredType<any>
			assertStructuredType(name, i, _type)
			properties.push([name, _type, _type.size])
			size += _type.size
		}
		
		i++
	}
	
	return size
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
	littleEndian: boolean,
	cleanEmptySpace: boolean
): number {
	for (let i = 0; i < properties.length; i++) {
		const name = properties[i][0]
		const type = properties[i][1]

		if (type instanceof Array) {
			if (object[name] == undefined) {
				const size = properties[i][2];
				if (cleanEmptySpace) bytes.fill(0, index, size)
				index += size
				continue
			}
			index = writeBytes(object[name], type, bytes, view, index, littleEndian, cleanEmptySpace)
		} else {
			if (object[name] != undefined) {
				type.writeBytes(object[name], bytes, view, index, littleEndian, cleanEmptySpace)
			} else {
				if (cleanEmptySpace) bytes.fill(0, index, type.size)
			}
			index += type.size
		}
	}
	return index
}
