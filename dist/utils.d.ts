import type { Property, Properties, StructuredType } from "./structured";
export declare function assert(value: boolean, message?: string): void;
export declare function emptyArrayElement(bytes: Uint8Array, offset: number, elementSize: number): boolean;
export declare function assertStructuredType(name: string, index: number, type: StructuredType<any>): void;
export declare function loadProperties(properties: Properties, struct: readonly Property[]): number;
export declare function readBytes(result: {
    [key: string]: any;
}, properties: Properties, bytes: Uint8Array, view: DataView, index: number, littleEndian: boolean): number;
export declare function writeBytes(object: {
    [key: string]: any;
}, properties: Properties, bytes: Uint8Array, view: DataView, index: number, littleEndian: boolean, cleanEmptySpace: boolean): number;
