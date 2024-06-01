export function assert(value: boolean, message?: string) {
	if (!value) {
		throw new Error(message)
	}
}

export interface StructuredType<T> {
	size: number
	readBytes(bytes: Uint8Array, index: number): T
	writeBytes(value: T, bytes: Uint8Array, index: number): void
}

type Property = readonly [string, StructuredType<any>]

type InferStructuredType<T> = T extends StructuredType<infer U> ? U : never

type StructToObject<T extends readonly Property[]> = {
	[K in T[number] as K[0]]: InferStructuredType<K[1]>
} & {}

export enum Endian {
	Little,
	Big
}

export class Structured<const T extends readonly Property[]> {
    map: Map<string, StructuredType<any>> = new Map()
	size: number = 0
    endian: Endian

	constructor(endian: Endian, struct: T) {
        this.endian = endian;

        let i = 0;
        for (const [name, type] of struct) {
            
            assert(typeof name === "string", `property ${i} "name must be a string`)
            assert(typeof type === "object", `property ${i} type must be an object`)
            assert(typeof type.size === "number", `property ${i} type requires a size property`)
            assert(typeof type.readBytes === "function", `property ${i} type requires a readByte function`)
            assert(typeof type.writeBytes === "function", `property ${i} type requires a writeByte function`)

            this.map.set(name, type)
            this.size += type.size;
            
            i++;
        }

        console.log(this.map)
	}

	fromBytes(bytes: Uint8Array): StructToObject<T> {
		assert(bytes.length == this.size, "the length of the bytes do not match")
        
        const result: {[key: string]:  any} = {}
        let index = 0;

        for (const [name, type] of this.map) {
            result[name] = type.readBytes(bytes, index)
            index += type.size
        }

        // @ts-ignore
        return result
	}

	toBytes(object: StructToObject<T>): Uint8Array {
		return new Uint8Array()
	}
}



