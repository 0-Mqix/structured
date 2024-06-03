export function assert(value: boolean, message?: string) {
	if (!value) {
		throw new Error(message)
	}
}

export interface StructuredType<T> {
	size: number
	readBytes(bytes: Uint8Array, view: DataView, index: number, littleEndian: boolean): T
	writeBytes(value: T, bytes: Uint8Array, view: DataView, index: number, littleEndian: boolean): void
}

type Property = readonly [string, StructuredType<any> | readonly Property[]]

type InferStructuredType<T> = T extends StructuredType<infer U>
	? U
	: T extends readonly Property[]
	? StructToObject<T>
	: never

type StructToObject<T extends readonly Property[]> = {
	[K in T[number] as K[0]]: InferStructuredType<K[1]>
} & {}

type PropertyMap = Map<string, StructuredType<any> | Map<string, StructuredType<any>>>

export default class Structured<const T extends readonly Property[]> {
	map: PropertyMap = new Map()
	size: number = 0
	littleEndian: boolean

	constructor(littleEndian: boolean, struct: T) {
		this.littleEndian = littleEndian

		let i = 0

		const process = (map: PropertyMap, struct: T | readonly Property[]) => {
			for (const [name, type] of struct) {
				if (Array.isArray(type)) {
					const _map = new Map()
					process(_map, type)
					map.set(name, _map)
				} else {
					const _type = type as StructuredType<any>

					assert(typeof name === "string", `property ${i} "name must be a string`)
					assert(typeof _type === "object", `property ${i} type must be an object`)
					assert(typeof _type.size === "number", `property ${i} type requires a size property`)
					assert(typeof _type.readBytes === "function", `property ${i} type requires a readByte function`)
					assert(typeof _type.writeBytes === "function", `property ${i} type requires a writeByte function`)

					map.set(name, _type)
					this.size += _type.size
				}

				i++
			}
		}

		process(this.map, struct)
	}

	readBytes(bytes: Uint8Array, result: StructToObject<T>)  {
		assert(bytes.length == this.size, "the length of the bytes do not match")

		const view = new DataView(bytes.buffer)
		let index = 0

		const process = (result: { [key: string]: any }, map: PropertyMap) => {
			for (const [name, type] of map) {
				if (type instanceof Map) {
					result[name] = {}
					process(result[name], type)
				} else {
					result[name] = type.readBytes(bytes, view, index, this.littleEndian)
					index += type.size
				}
			}
		}

		process(result, this.map)
	}

	writeBytes(object: StructToObject<T>, bytes: Uint8Array) {
		assert(bytes.length == this.size, "the length of the bytes do not match");
		const view = new DataView(bytes.buffer)
		let index = 0

		const process = (_object: { [key: string]: any }, map: PropertyMap) => {
			for (const [name, type] of map) {
				if (type instanceof Map) {
					process(_object[name], type)
				} else {
					assert(Object.hasOwn(_object, name), "object has not the property")
					type.writeBytes(_object[name], bytes, view, index, this.littleEndian)
					index += type.size
				}
			}
		}

		process(object, this.map)
	}

	toBytes(object: StructToObject<T>): Uint8Array {
		const bytes = new Uint8Array(this.size)
		this.writeBytes(object, bytes)
		return bytes
	}


	fromBytes(bytes: Uint8Array): StructToObject<T> {
		const object = {} as StructToObject<T>
		this.readBytes(bytes, object)
		return object
	}
}

export * from "./types"