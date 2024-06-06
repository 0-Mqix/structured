import { assert, loadProperties, readBytes, writeBytes } from "./utils"

/**
 * **StructuredType**
 * 
 * This is the interface that all the types have.
 *
 * `size` is the fixed ammount of bytes the type consumes in the memory layout.
 *
 * if `cleanEmptySpace` in `writeBytes` is true the  unused bytes of the type to be set to zero in the `bytes`.
 *  
 * Implement `fromBytes` if you want to create an inmutable type.
 * Else if you want to create mutable type you need implement the `readBytes` function.
 * You cant have both.
 */
export interface StructuredType<T> {
	size: number
	fromBytes?(bytes: Uint8Array, view: DataView, index: number, littleEndian: boolean): T
	readBytes?(bytes: Uint8Array, result: T, view: DataView, index: number, littleEndian: boolean): void
	writeBytes(value: T, bytes: Uint8Array, view: DataView, index: number, littleEndian: boolean, cleanEmptySpace: boolean): void
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

export type Properties = [string,  StructuredType<any> | Properties, number][]

/**
 * **Structured**
 * 
 * `cleanEmptySpace` in `writeBytes` needs to be true if you want to make sure all the empty spaces in the value
 * are written as zeros. This is useful when you reuse the `Uint8Array`
 *  
 * The `result` you pass in `readBytes` can be fully reused if it the same shape. In this case it does not create objects unless something is missing. 
 */
export default class Structured<const T extends readonly Property[]> {
	properties: Properties = []
	size: number = 0
	littleEndian: boolean
	cleanEmptySpace: boolean

	constructor(littleEndian: boolean, cleanEmptySpace: boolean, struct: T) {
		this.littleEndian = littleEndian
		this.cleanEmptySpace = cleanEmptySpace
		this.size = loadProperties(this.properties, struct)
	}

	readBytes(bytes: Uint8Array, result: StructToObject<T>, view?: DataView, index = 0, littleEndian?: boolean) {
		assert(typeof result == "object", "result is undefined")
		if (!view) view = new DataView(bytes.buffer)
		readBytes(result, this.properties, bytes, view, index, littleEndian ?? this.littleEndian)
	}
	
	writeBytes(value: StructToObject<T>, bytes: Uint8Array, view?: DataView, index = 0, littleEndian?: boolean, overwriteEmtpy?: boolean) {
		if (!view) view = new DataView(bytes.buffer)
		writeBytes(value, this.properties, bytes, view, index, littleEndian ?? this.littleEndian, overwriteEmtpy ?? this.cleanEmptySpace)
	}
	
	fromBytes(bytes: Uint8Array): StructToObject<T> {
		const object = {} as StructToObject<T>
		this.readBytes(bytes, object)
		return object
	}

	toBytes(object: StructToObject<T>): Uint8Array {
		const bytes = new Uint8Array(this.size)
		this.writeBytes(object, bytes)
		return bytes
	}
}
