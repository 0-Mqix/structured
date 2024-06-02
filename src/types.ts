import type { StructuredType } from ".";

function createDataViewType<T>(type: string, size: number): StructuredType<T> {
	return {
		size,
		readBytes: (_: Uint8Array, view: DataView, index: number, littleEndian: boolean): T => {
           //@ts-ignore
			return view[`get${type}`](index, littleEndian)

        },
		writeBytes: (value: T, _: Uint8Array, view: DataView, index: number, littleEndian: boolean): void => {
			//@ts-ignore
			view[`set${type}`](index, value, littleEndian)
		}
	}
}

export const uint8 = createDataViewType<number>("Uint8", 1);
export const int8 = createDataViewType<number>("Int8", 1);

export const uint16 = createDataViewType<number>("Uint16", 2);
export const int16 = createDataViewType<number>("Int16", 2);

export const uint32 = createDataViewType<number>("Uint32", 4);
export const int32 = createDataViewType<number>("Int32", 4);

export const float32 = createDataViewType<number>("Float32", 4);
export const float64 = createDataViewType<number>("Float64", 8);

export const int64 =  createDataViewType<bigint>("BigInt64", 8);
export const uint64 =  createDataViewType<bigint>("BigUint64", 8);

export const double = float64;
export const long = int64;

export const bool: StructuredType<boolean> = {
	size: 1,
	readBytes: function (bytes: Uint8Array, _: DataView, index: number): boolean {
		return bytes[index] ? true : false
	},
	writeBytes: function (value: boolean, bytes: Uint8Array, _: DataView, index: number) {
		bytes[index] = value ? 1 : 0
	}
}