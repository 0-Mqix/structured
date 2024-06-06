import { type Property, type StructuredType, type InferOutputType } from "./structured";
/**
 * **union(*union*)**
 *
 * @param union all the diffrent properties the union has. This argument is the same format as for the struct in the `Structured` constructor.
 *
 * @example
 * ```
 * union([
 *   ["a", uint8],
 *   ["b", string(10)]
 * ])
 * ```
 */
export declare function union<const T extends readonly Property[]>(union: T): StructuredType<Partial<InferOutputType<T>>>;
