import Structured, { type Property, type Properties, type StructuredType } from "./structured"
import { assertStructuredType, readBytes } from "./utils"

let registryLastId = 0
const registry = new Map<any, number>()

function addToRegistry(type: any) {
    if (!registry.has(type)) { registry.set(type, registryLastId++); }
}

export function loadProperties(properties: Properties, struct: readonly Property[]): number {
    let i = 0
    let size = 0

    for (const [name, type] of struct) {

        if (type instanceof Array) {
            const _properties: Properties = []
            let _size = loadProperties(_properties, type)
            properties.push([name, _properties, _size])
            size += _size
        } else if (type instanceof Structured) {
            properties.push([name, Array.from(type.properties), type.size])
            size += type.size
        } else {
            const _type = type as StructuredType<any>
            assertStructuredType(name, i, _type)
            properties.push([name, _type, _type.size])
            size += _type.size
            addToRegistry(type)
        }

        i++
    }

    for (const [type, id] of registry.entries()) {
        if (type.readBytes) {
            this[`type_${id}_readBytes`] = type.readBytes
            this[`type_${id}_writeBytes`] = type.writeBytes
        } else {
            this[`type_${id}_fromBytes`] = type.fromBytes
            this[`type_${id}_toBytes`] = type.toBytes
        }
    }

    return size
}

export function printProperties(properties: Properties, parent: string) {
    for (let i = 0; i < properties.length; i++) {
        const name = properties[i][0]
        const type = properties[i][1]

        if (type instanceof Array) {
            printProperties(type, parent + name + ".")
        } else {
            if (type.readBytes) {
                console.log(parent + name, "mutable")
            } else {
                console.log(parent + name, "immutable")
            }
        }
    }
}