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
    size: number;
    fromBytes?(bytes: Uint8Array, view: DataView, index: number, littleEndian: boolean): T;
    readBytes?(bytes: Uint8Array, result: T, view: DataView, index: number, littleEndian: boolean): void;
    writeBytes(value: T, bytes: Uint8Array, view: DataView, index: number, littleEndian: boolean, cleanEmptySpace: boolean): void;
}
export type Property = readonly [string, StructuredType<any> | readonly Property[] | Structured<any>];
export type InferOutputType<T> = T extends StructuredType<infer U> ? U : T extends readonly Property[] ? StructToObject<T> : T extends Structured<infer Struct> ? StructToObject<Struct> : never;
type StructToObject<T extends readonly Property[]> = {
    [K in T[number] as K[0]]: InferOutputType<K[1]>;
} & {};
export type Properties = [string, StructuredType<any> | Properties, number][];
/**
 * **Structured**
 *
 * `cleanEmptySpace` in `writeBytes` needs to be true if you want to make sure all the empty spaces in the value
 * are written as zeros. This is useful when you reuse the `Uint8Array`
 *
 * The `result` you pass in `readBytes` can be fully reused if it the same shape. In this case it does not create objects unless something is missing.
 */
export default class Structured<const T extends readonly Property[]> {
    properties: Properties;
    size: number;
    littleEndian: boolean;
    cleanEmptySpace: boolean;
    constructor(littleEndian: boolean, cleanEmptySpace: boolean, struct: T);
    readBytes(bytes: Uint8Array, result: StructToObject<T>, view?: DataView, index?: number, littleEndian?: boolean): void;
    writeBytes(value: StructToObject<T>, bytes: Uint8Array, view?: DataView, index?: number, littleEndian?: boolean, overwriteEmtpy?: boolean): void;
    fromBytes(bytes: Uint8Array): StructToObject<T>;
    toBytes(object: StructToObject<T>): Uint8Array;
}
export {};
