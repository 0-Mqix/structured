import { type StructuredType } from "./structured";
/**
 * **cast<*T*>(*type*)**
 *
 * Reinterprets the inferred output type of a field as `T` without changing how
 * it is serialized. The wire representation stays exactly whatever `type`
 * produces; only the compile-time type seen through `fromBytes` / `toBytes`
 * changes.
 *
 * This is the TypeScript analog of packed's `Cast`. In Go, `Cast` performs a
 * real conversion because the field is stored as `T` while the converter works
 * on a separate receiver type. In JavaScript every value is already a plain
 * `number` / `boolean` / `bigint` at runtime, so there is nothing to convert:
 * `cast` is a zero-cost, type-only wrapper that recovers the granularity the
 * `number` type would otherwise lose. `T` must share the runtime representation
 * of the underlying type (e.g. a numeric enum, a branded number, or a numeric
 * literal union).
 *
 * Because it returns the underlying type unchanged, `cast` composes with any
 * field — including `bits(...)`, whose grouping still works.
 *
 * @example
 * ```
 * enum Action { Idle, Run, Stop }
 *
 * new Structured(true, true, [
 *   ["action", cast<Action>(uint8)],
 *   ["priority", cast<0 | 1 | 2>(bits(2))],
 * ])
 * ```
 */
export declare function cast<T>(type: StructuredType<any>): StructuredType<T>;
