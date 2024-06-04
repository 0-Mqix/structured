import Structured, { type StructuredType, type Property, type InferOutputType } from "./structured";
export declare function array<const T extends StructuredType<any> | Structured<any> | readonly Property[]>(size: number, type: T, omitEmptyRead?: boolean): StructuredType<InferOutputType<T>[]>;
