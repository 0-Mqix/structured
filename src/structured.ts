import { assert, loadPropertyMap, readBytes, writeBytes } from "./utils"

export interface StructuredType<T> {
	size: number
	readBytes(bytes: Uint8Array, view: DataView, index: number, littleEndian: boolean, result?: T): T
	writeBytes(value: T, bytes: Uint8Array, view: DataView, index: number, littleEndian: boolean): void
}

export type Property = readonly [string, StructuredType<any> | readonly Property[] | Structured<any>]

export type InferOutputType<T> = T extends StructuredType<infer U>
	? U
	: T extends readonly Property[]
	? StructToObject<T>
	: T extends Structured<infer Struct>
	? StructToObject<Struct>
	: never

type StructToObject<T extends readonly Property[]> = {
	[K in T[number] as K[0]]: InferOutputType<K[1]>
} & {}

export type PropertyMap = Map<string, StructuredType<any> | Map<string, StructuredType<any>> | PropertyMap>

export default class Structured<const T extends readonly Property[]> {
	map: PropertyMap = new Map()
	size: number = 0
	littleEndian: boolean

	constructor(littleEndian: boolean, struct: T) {
		this.littleEndian = littleEndian
		const _size = {value: 0}
		loadPropertyMap(this.map, struct, _size)
		this.size = _size.value
	}

	readBytes(bytes: Uint8Array, object: StructToObject<T>, index = 0, littleEndian?: boolean) {
		const view = new DataView(bytes.buffer)
		readBytes(object, this.map, bytes, view, index, littleEndian ?? this.littleEndian)
	}

	writeBytes(object: StructToObject<T>, bytes: Uint8Array, index = 0, littleEndian?: boolean) {
        const view = new DataView(bytes.buffer)
		writeBytes(object, this.map, bytes, view, index, littleEndian ?? this.littleEndian)
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
