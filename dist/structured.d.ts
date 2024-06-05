/**
 * **StructuredType<T>**
 *
 * This is the interface that all the types have.
 *
 * `size` is the fixed ammount of bytes the type consumes in the memory layout.
 *
 * Implement fromBytes if you want to create an inmutable type.
 * Else if you want to create mutable type you need implement the readBytes function.
 * You cant have both.
 */
export interface StructuredType<T> {
    size: number;
    fromBytes?(bytes: Uint8Array, view: DataView, index: number, littleEndian: boolean): T;
    readBytes?(bytes: Uint8Array, result: T, view: DataView, index: number, littleEndian: boolean): void;
    writeBytes(value: T, bytes: Uint8Array, view: DataView, index: number, littleEndian: boolean): void;
}
export type Property = readonly [string, StructuredType<any> | readonly Property[] | Structured<any>];
export type InferOutputType<T> = T extends StructuredType<infer U> ? U : T extends readonly Property[] ? StructToObject<T> : T extends Structured<infer Struct> ? StructToObject<Struct> : never;
type StructToObject<T extends readonly Property[]> = {
    [K in T[number] as K[0]]: InferOutputType<K[1]>;
} & {};
export type Properties = [string, StructuredType<any> | Properties][];
export default class Structured<const T extends readonly Property[]> {
    properties: Properties;
    size: number;
    littleEndian: boolean;
    constructor(littleEndian: boolean, struct: T);
    readBytes(bytes: Uint8Array, result: StructToObject<T>, view?: DataView, index?: number, littleEndian?: boolean): void;
    writeBytes(value: StructToObject<T>, bytes: Uint8Array, view?: DataView, index?: number, littleEndian?: boolean): void;
    toBytes(object: StructToObject<T>): Uint8Array;
    fromBytes(bytes: Uint8Array): StructToObject<T>;
}
export {};
