import { type Property, type StructuredType, type InferOutputType } from "./structured";
export declare function union<const T extends readonly Property[]>(union: T): StructuredType<Partial<InferOutputType<T>>>;
