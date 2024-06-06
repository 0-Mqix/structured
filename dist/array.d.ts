import Structured, { type StructuredType, type Property, type InferOutputType } from "./structured";
/**
 * **array(*size*, *type*, *omitZeroRead*)**
 *
 * @param size The amount of elements.
 * @param type The **StructuredType** of the elements.
 * @param omitEmptyRead Does not add the element to the result if all its bytes are zero.
 */
export declare function array<const T extends StructuredType<any> | Structured<any> | readonly Property[]>(size: number, type: T, omitEmptyRead?: boolean): StructuredType<InferOutputType<T>[]>;
