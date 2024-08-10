export const TYPE = "TYPE"
export const MIN = "MIN"
export const MAX = "MAX"
export const REQ = "REQ"
export const ALLOWED = "ALLOWED"
export const REGEX = "REGEX"
export const INTEGER = "INTEGER"
export const UNKNOWN = "UNKNOWN"
export const BIGINT = "BIGINT"

export class Base {}

type InputJSON = { [key: string]: unknown }

interface Success<T> {
  success: true
  result: T
}

interface Failure {
  success: false
  fail: Fail
}

export interface Type<T> {
  name:string
  priority:number
  appliesTo(sample:unknown):boolean
  defaultTo(sample:T):unknown
  mismatch(json:unknown, sample:unknown):string|boolean
  parse(prefix:string, sample:T, json:unknown):Success<T>|Failure
}


export class Fail {
  constructor(
    readonly prefix:string,
    readonly code:string,
    readonly message:string
  ) {}

  withPrefix = (prefix:string):Fail => {
    return new Fail(prefix, this.code, this.message)
  }
}

export class CheckError extends Error {

  prefix:string
  code:string
  
  constructor(fail:Fail) {
    super(fail.prefix + ": " + fail.message)
    this.prefix = fail.prefix
    this.code = fail.code
  }
}


export namespace Check {//

let skip = true
let unsafe = false

export const skipInvalidObjects = (flag:boolean) => {
  skip = flag
}

const typeOf = (v:unknown) => {
  if (Array.isArray(v)) return "array"
  return typeof(v)
}

interface Collection<T> {
  name:string
  make():T
  appliesTo(v:unknown):boolean
  add(collection:T, v:unknown):void
  sampleElement(sampleCollection:T):unknown
}

export const collectionType = <T>(c:Collection<T>):Type<T> => {
  return {
    name: c.name,
    priority: 400_000_000,
    appliesTo:(v:unknown) => c.appliesTo(v),
    defaultTo:() => c.make(),
    mismatch:(json:unknown) => {
      if (c.name !== "array" && c.appliesTo(json)) return true
      if (!Array.isArray(json)) {
        return "expected array but got " + typeOf(json)
      }
      return false
    },
    parse:(prefix:string, sample:T, json:unknown) => {
      const a = json as any[]
      const sampleElement = c.sampleElement(sample)
      const type = types.find(x => x.appliesTo(sampleElement))!
      const result = c.make()
      for (let i = 0; i < a.length; i++) {
        const mm = type.mismatch(a[i], sampleElement)
        if (typeof(mm) === "string") {
          return { success:false, fail:new Fail(prefix + "[" + i + "]", TYPE, mm)}
        }
        if (sampleElement instanceof Base) {
          const cls = sampleElement.constructor
          const r = run2(cls as never, prefix + "[" + i + "]", a[i])
          if (r.success) {
            c.add(result, r.result)
          } else if (skip) {
            warn(`skipping element ${r.fail.prefix} - ${r.fail.message}`)
          } else {
            return r
          }
        } else {
          const r = type.parse(prefix + "[" + i + "]", sampleElement, a[i])
          if (r.success) c.add(result, r.result)
        }
      }
      return { success:true, result }
    }
  }
}

const arrayType = collectionType<Array<unknown>>({
  name: "array",
  appliesTo: (v:unknown) => Array.isArray(v),
  make: () => [],
  add: (a:unknown[], v:unknown) => a.push(v),
  sampleElement: (c:unknown[]) => c[0],
})
arrayType.priority = 300_000_000

const types:Type<any>[] = [
  arrayType,
  {
    name:"checked object",
    priority:200_000_000,
    appliesTo:(v:unknown) => v instanceof Base,
    defaultTo:(sample:unknown) => sample,
    mismatch:(json:unknown) => {
      if (json instanceof Base) return true
      const t = typeOf(json)
      if (t !== "object") {
        return "expected object but got " + t
      }
      return false
    },
    parse:(prefix:string, sample:unknown, json:unknown) => {
      const cls = (sample as Base).constructor
      const object = json as Record<string,unknown>
      return run2(cls as never, prefix, object)
    }
  },
  {
    name:"default",
    priority:0,
    appliesTo:(v:unknown) => true,
    defaultTo:(sample:unknown) => sample,
    mismatch:(json:unknown, v:unknown) => {
      const expected = typeOf(v)
      const got = typeOf(json)
      if (expected !== got) {
        return `expected ${expected} but got ${got}`
      }
      return false
    },
    parse:(prefix:string, sample:unknown, json:unknown) => {
      return { success:true, result:json }
    }
  },
]

export const addType = <T>(type:Type<T>):void => {
  types.push(type)
  types.sort((a,b) => b.priority - a.priority)
}


interface Length {
  length:number
}

interface Size {
  size:number
}

type Limit<T> = 
T extends number ? number :
T extends BigInt ? BigInt :
T extends Length ? number :
T extends Size ? number :
T extends Date ? Date :
undefined

type Required = true | false | "default" 

export interface Property<T> {
  v:T
  required?:Required
  readonly?:boolean
  min?:Limit<T>
  max?:Limit<T>
  allowed?:readonly T[]
  fallback?:T
  integer?:boolean
  regex?:RegExp
  custom?:Checker<T>
}

interface Optimized<T> {
  name:string
  v:T
  required:Required
  passes:Checker<T>[]
}


export type Checker<T> = (v:T)=>Fail|undefined

const hasProp = (value:any, prop:string):boolean => {
  if (value instanceof Set) {
    console.log("hasProp", prop, prop in value)
  }
  return typeof(value) === "object" && prop in value 
}

const minChecker = <T>(name:string, sample:T, min:Limit<T>|undefined):Checker<T>|undefined => {
  if (min === undefined) {
    return undefined
  }
  if ((typeof(sample) === "string") || hasProp(sample, "length")) {
    return (value:T) => {
      const length = (value as Length).length
      if (length < (min as number)) {
        return new Fail(name, MIN, `length of ${length} < minimum length of ${min}`)
      }
    }
  }
  if (hasProp(sample, "size")) {
    return (value:T) => {
      const size = Array.isArray(value) ? value.length : (value as Size).size
      console.log("minCheck", value, size, min)
      if (size < (min as number)) {
        return new Fail(name, MIN, `size of ${size} < minimum size of ${min}`)
      }
    }
  }
  return (value:T) => {
    if (value < min) {
      return new Fail(name, MIN, `value of ${value} < minimum value of ${min}`)
    }
  }
}

const maxChecker = <T>(name:string, sample:T, max:Limit<T>|undefined):Checker<T>|undefined => {
  if (max === undefined) {
    return undefined
  }
  if ((typeof(sample) === "string") || hasProp(sample, "length")) {
    return (value:T) => {
      const length = (value as Length).length
      if (length > (max as number)) {
        return new Fail(name, MAX, `length of ${length} > maximum length of ${max}`)
      }
    }
  }
  if (hasProp(sample, "size")) {
    return (value:T) => {
      const size = Array.isArray(value) ? value.length : (value as Size).size
      if (size > (max as number)) {
        return new Fail(name, MAX, `size of ${size} > maximum size of ${max}`)
      }
    }
  }
  return (value:T) => {
    if (value > max) {
      return new Fail(name, MAX, `value of ${value} > maximum value of ${max}`)
    }
  }
}

const allowedChecker = <T>(name:string, allowed:readonly T[]|undefined):Checker<T>|undefined => {
  if (allowed === undefined) {
    return undefined
  }
  const set = new Set(allowed)
  return (value:T) => {
    if (!set.has(value)) {
      return new Fail(name, ALLOWED, `invalid value: ${value} - valid values are: ${allowed}`)
    }
  }
}

const regexChecker = <T>(name:string, regex:RegExp|undefined):Checker<T>|undefined => {
  if (regex === undefined) {
    return undefined
  }
  return (value:T) => {
    if (!regex.test(String(value))) {
      return new Fail(name, REGEX, `invalid value: ${value} - must match ${regex}`)
    }
  }
}

const integerChecker = <T>(name:string, sample:T, integer:boolean|undefined):Checker<T>|undefined => {
  if (integer === undefined) {
    integer = true
  }
  if (!integer) return undefined
  if (typeof sample !== "number") return undefined
  return (value:T) => {
    if (!Number.isSafeInteger(value)) {
      return new Fail(name, INTEGER, `value of ${value} is not a safe integer`)
    }
  }
}

interface Field<T> {
  property: Property<T>
  type: Type<T>
  check(v:T):Fail[]
}

type Fields<T extends object> = {[P in keyof T]: Field<T[P]>}

const symbol = Symbol("Check_metadata")

const optimize = <T>(name:string, sample:T, p:Property<T>):Optimized<T> => {
  const required = p.required ?? true
  const passes:Checker<T>[] = []
  let c
  if (c = minChecker(name, sample, p.min)) passes.push(c)
  if (c = maxChecker(name, sample, p.max)) passes.push(c)
  if (c = allowedChecker(name, p.allowed)) passes.push(c)
  if (c = regexChecker(name, p.regex)) passes.push(c)
  if (c = integerChecker(name, sample, p.integer)) passes.push(c)
  if (c = p.custom) passes.push(c)
  return { name, v:sample, required, passes }
}

const toFunction = <T>(name:string, p:Property<T>):(value:T)=>Fail[] => {
  const sample = p.v
  const opt = optimize(name, sample, p)
  const passes = opt.passes
  if (opt.required !== false) {
    return (value:T) => {
      return passes.map(f => f(value)).filter(x => x !== undefined) as never
    }
  } else {
    return (value:T) => {
      return passes.map(f => f(value)).filter(x => x !== undefined) as never
    }
  }
}

export type Schema = Record<string,Property<any>>

type HasIn<S extends Schema,P extends keyof S> = 
  S[P]["required"] extends "default"|false ? false : true

export type In<S extends Schema> = 
  { [P in keyof S as HasIn<S,P> extends true  ? P : never]:  S[P]["v"] }
& { [P in keyof S as HasIn<S,P> extends false ? P : never]?: S[P]["v"] }

type OutKeyType<S extends Schema,P extends keyof S> =
  S[P]["required"] extends false
  ? S[P]["readonly"] extends true ? "io" : "mo"
  : S[P]["readonly"] extends true ? "ir" : "mr"

export type Out<S extends Schema> = 
  { [P in keyof S as OutKeyType<S,P> extends "mr" ? P : never]:  S[P]["v"] }
& { [P in keyof S as OutKeyType<S,P> extends "mo" ? P : never]?: S[P]["v"] }
& { readonly [P in keyof S as OutKeyType<S,P> extends "ir" ? P : never]:  S[P]["v"] }
& { readonly [P in keyof S as OutKeyType<S,P> extends "io" ? P : never]?: S[P]["v"] }

export type Class<S extends Schema> = new(fields:In<S>)=>Out<S>

interface Metadata<S extends Schema> {
  cls: Class<S>
  fields: Fields<S>
  sample: Out<S>
}

export const define = <S extends Schema>(schema:S):Base&Class<S> => {
  type K = keyof S
  const fields:Partial<Record<K,Field<S[K]["v"]>>> = {}
  const sample:Partial<Record<K,S[K]["v"]>> = {}  
  for (const k in schema) {
    const prop = schema[k]!
    sample[k] = prop.v
    fields[k] = {
      property: prop,
      check: toFunction(k, prop),
      type: types.find(x => x.appliesTo(prop.v))!
    }
  }
  const cls = class extends Base {
    constructor(input:InputJSON) {
      super();
      if (unsafe) {
        Object.assign(this, input)
      } else {
        const r = Check.run(cls, input)
        if (!r.success) throw new CheckError(r.fail)
        Object.assign(this, r.result)
      }
      const result = augment(this)
      /* v8 ignore next */
      return result
    }
  }
  const metadata:Metadata<S> = { 
    fields: fields as never,
    sample: null as never,
    cls: cls as never,
  };
  (cls as any)[symbol] = metadata
  unsafe = true
  metadata.sample = new cls(sample) as never
  unsafe = false;
  return cls as never
}

const metadata = <S extends Schema,C extends Class<S>>(cls:C):Metadata<S> => {
  return (cls as any)[symbol]
}

export const sample = <R extends Base,T extends object>(cls:new(fields:T)=>R):R => {
  const md = metadata(cls as never)
  if (!cls.hasOwnProperty(symbol)) {
    unsafe = true
    const newSample = new cls(md.sample as never)
    unsafe = false
    const newMD = {
      cls,
      fields: md.fields,
      sample: newSample
    };
    (cls as any)[symbol] = newMD;
    return newSample
  }
  return md.sample as R
}

export const recurse = <R extends Base,T extends object,K extends keyof R>(cls:new(fields:T)=>R, key:K, value:R[K]) => {
  const s = sample(cls)
  s[key] = value
  const md = metadata(cls as never)
  const field = md.fields[key as never]!
  field.property.v = value as never
  field.check = toFunction(key as never, field.property)
  field.type = types.find(x => x.appliesTo(value))!
}

const run2 = <S extends Schema,T extends Out<S>>(cls:Class<S>, objectPrefix:string, json:InputJSON):Success<T>|Failure => {
  if (json instanceof Base) return { success:true, result:json as T }
  type K = keyof T
  if (objectPrefix !== "") objectPrefix += "."
  const md = metadata<S,Class<S>>(cls)
  const sample = md.sample as any
  const result:InputJSON = {}
  for (const k in md.fields) {
    const prefix = objectPrefix + k
    try {
      const field = md.fields[k]
      const prop = field.property
      const sampleValue = sample[k]
      let value = json[k]
      const missing = value === undefined || value === null
      if (prop.required === false && missing) {
        continue
      } 
      if (prop.required !== false) {
        if (missing) {
          if (prop.required === "default") {
            value = field.type.defaultTo(sampleValue)
          } else {
            return { success:false, fail: new Fail(prefix, REQ, "missing required property") }
          }
        }
      }
      if (prop.allowed !== undefined && prop.fallback !== undefined) {
        if (prop.allowed.indexOf(value as never) < 0) {
          value = prop.fallback
        }
      }
      const mm = field.type.mismatch(value, sampleValue)
      if (typeof(mm) === "string") {
        return { success:false, fail:new Fail(prefix, TYPE, mm) }
      }
      const fails = field.check(value as never)
      if (fails.length > 0) {
        return { success:false, fail:fails[0]!.withPrefix(prefix) }
      }
      if (mm) {
        result[k] = value
        continue
      }
      const r = field.type.parse(prefix, sampleValue, value)
      if (r.success) {
        result[k] = r.result
      } else if (sampleValue instanceof Base && prop.required === false) {
        warn(`skipping nested object ${r.fail.prefix} - ${r.fail.message}`)
      } else {
        return r
      }
      /* v8 ignore next 4 */
    } catch (e:any) {
      const msg = "message" in e ? e.message : "unknown error"
      return { success:false, fail:new Fail(prefix, UNKNOWN, e.message) }
    }
  }
  unsafe = true
  const r = new cls(result as never)
  unsafe = false
  return { success:true, result:r as T }
}

export const run = <R extends Base,T extends object>(cls:new(fields:T)=>R, json:InputJSON):Success<R>|Failure => {
  return run2(cls as never, "", json)
}

export const raise = <R extends Base,T extends object>(cls:new(fields:T)=>R, json:InputJSON):R => {
  const r = run(cls, json)
  if (r.success) return r.result
  throw new CheckError(r.fail)
}

export const parse = <R extends Base,T extends object>(cls:new(fields:T)=>R, json:string):R => {
  const r = run(cls, JSON.parse(json))
  if (r.success) {
    return r.result
  } else {
    throw new CheckError(r.fail)
  }
}

export const parseCollection = <R extends Base,T extends object>(cls:new(fields:T)=>R, json:string, sink:(element:R)=>void):void => {
  const a = JSON.parse(json)
  if (!Array.isArray(a)) {
    throw new TypeError("expected input array but got " + typeof(a))
  }
  for (const x of a) {
    const r = run(cls, x)
    if (r.success) sink(r.result)
    else throw new CheckError(r.fail)
  }
}

export const parseArray = <R extends Base,T extends object>(cls:new(fields:T)=>R, json:string) => {
  const result:R[] = []
  parseCollection(cls, json, x => { result.push(x) })
  return result
}

export const runOne = <R extends Base,T extends object,K extends keyof R>(cls:new(fields:T)=>R, object:R, k:K, v:R[K]):Fail[] => {
  const field = metadata(cls as never).fields[k as never]
  return field!.check(v as never)
}

type O = Record<string,any>

let augment:(o:O)=>O = o => o

export const augmentWith = (f:(o:O)=>O) => {
  augment = f
}

let warn:(message:string)=>void = console.warn

export const warnWith = (warner:(message:string)=>void):void => {
  warn = warner
}

}//
