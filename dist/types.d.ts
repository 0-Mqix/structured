import { type StructuredType } from "./structured";
export declare const uint8: StructuredType<number>;
export declare const int8: StructuredType<number>;
export declare const uint16: StructuredType<number>;
export declare const int16: StructuredType<number>;
export declare const uint32: StructuredType<number>;
export declare const int32: StructuredType<number>;
export declare const float32: StructuredType<number>;
export declare const float64: StructuredType<number>;
export declare const int64: StructuredType<bigint>;
export declare const uint64: StructuredType<bigint>;
export declare const bool: StructuredType<boolean>;
/**
 * **string(*size*)**
 *
 * @param size The amount of bytes that this string takes.
 */
export declare function string(size: number): StructuredType<string>;
export declare const double: StructuredType<number>;
export declare const long: StructuredType<bigint>;
export * from "./array";
export * from "./union";
