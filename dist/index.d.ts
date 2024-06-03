export declare function assert(value: boolean, message?: string): void;
export interface StructuredType<T> {
    size: number;
    readBytes(bytes: Uint8Array, view: DataView, index: number, littleEndian: boolean): T;
    writeBytes(value: T, bytes: Uint8Array, view: DataView, index: number, littleEndian: boolean): void;
}
type Property = readonly [string, StructuredType<any> | readonly Property[] | Structured<any>];
type InferStructuredType<T> = T extends StructuredType<infer U> ? U : T extends readonly Property[] ? StructToObject<T> : T extends Structured<infer Struct> ? StructToObject<Struct> : never;
type StructToObject<T extends readonly Property[]> = {
    [K in T[number] as K[0]]: InferStructuredType<K[1]>;
} & {};
type PropertyMap = Map<string, StructuredType<any> | Map<string, StructuredType<any>> | PropertyMap>;
export default class Structured<const T extends readonly Property[]> {
    map: PropertyMap;
    size: number;
    littleEndian: boolean;
    constructor(littleEndian: boolean, struct: T);
    readBytes(bytes: Uint8Array, result: StructToObject<T>): void;
    writeBytes(object: StructToObject<T>, bytes: Uint8Array): void;
    toBytes(object: StructToObject<T>): Uint8Array;
    fromBytes(bytes: Uint8Array): StructToObject<T>;
}
export * from "./types";
