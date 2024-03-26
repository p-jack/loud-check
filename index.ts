export class Fail {
  constructor(
    readonly prefix:string,
    readonly code:string,
    readonly message:string
  ) {}

  withPrefix = (prefix:string):Fail => {
    return new Fail(prefix + this.prefix, this.code, this.message)
  }
}


export namespace Check {//


let skip = true

export const skipInvalidObjects = (flag:boolean) => {
  skip = flag
}

export const TYPE = "TYPE"
export const MIN = "MIN"
export const MAX = "MAX"
export const REQ = "REQ"
export const ALLOWED = "ALLOWED"
export const REGEX = "REGEX"
export const INTEGER = "INTEGER"
export const UNKNOWN = "UNKNOWN"

export class CheckError extends Error {

  prefix:string
  code:string
  
  constructor(fail:Fail) {
    super(fail.prefix + ": " + fail.message)
    this.prefix = fail.prefix
    this.code = fail.code
  }
}

interface Length {
  length:number
}

type Limit<T> = 
T extends number ? number :
T extends BigInt ? BigInt :
T extends Length ? number :
T extends Date ? Date :
undefined

type Required = true | false | "default" 

export interface Property<T> {
  v:T
  name?:string
  required?:Required
  min?:Limit<T>
  max?:Limit<T>
  allowed?:T[]
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

function hasProp(value:any, prop:string): boolean {
  return typeof(value) === "object" && prop in value && typeof value[prop] !== "function"
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
  return (value:T) => {
    if (value > max) {
      return new Fail(name, MAX, `value of ${value} > maximum value of ${max}`)
    }
  }
}

const allowedChecker = <T>(name:string, allowed:T[]|undefined):Checker<T>|undefined => {
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

const checkFuncsSymbol = Symbol("checkFuncs")
const checksSymbol = Symbol("checks")
const extensionsSymbol = Symbol("extensions")
const gettersSymbol=  Symbol("getters")

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

const toFunction = <T>(name:string, sample:T, p:Property<T>):(value:T)=>Fail[] => {
  const opt = optimize(name, sample, p)
  const passes = opt.passes
  passes.forEach(x => x(sample))
  if (opt.required !== false) {
    return (value:T) => {
      return passes.map(f => f(value)).filter(x => x !== undefined) as never
    }
  } else {
    return (value:T) => {
      if ((value === undefined) || (value === null)) {
        return []
      }
      return passes.map(f => f(value)).filter(x => x !== undefined) as never
    }
  }

}

type Schema = Record<string,Property<any>>

type Has<S extends Schema,P extends keyof S> = 
  S[P]["required"] extends false ? "N" : "Y"

export const define = <S extends Schema>(schema:S):
  ( { [P in keyof S as Has<S,P> extends "Y" ? P : never]:  S[P]["v"] }
  & { [P in keyof S as Has<S,P> extends "N"  ? P : never]?: S[P]["v"] }
) => {
  const result:any = {}
  const full:any = {}
  for (const k in schema) {
    const prop = schema[k]!
    result[k] = prop.v
    full[k] = toFunction(k, prop.v, prop)
  }
  result[checksSymbol] = schema
  result[checkFuncsSymbol] = full
  return result as never
}

type Getter<T extends object,R> = (instance:T)=>R
type Getters<T extends object> = Record<string,Getter<T,any>>
type Got<T extends object,G extends Getters<T>> =
  { [P in keyof G]: ReturnType<G[P]> }

const applyGetters = <T extends object,G extends Getters<T>>(object:T, getters:G) => {
  for (const k in getters) {
    const getter = getters[k]!
    Object.defineProperty(object, k, {
      get: () => {
        return getter(object)
      }
    })
  }
  (object as any)[gettersSymbol] = getters
}

export function getters<T extends object,G extends Getters<T>>
(schema:T, getters:G): asserts schema is T&Got<T,G> {
  get(schema)
  applyGetters(schema, getters);
  (schema as any)[gettersSymbol] = getters
}


type Extension<T extends object> = (that:T, ...args:any)=>any
type Extensions<T extends object> = Record<string,Extension<T>>

const applyExtend = <T extends object,E extends Extensions<T>>(object:T, extensions:E) => {
  const o = object as any
  for (const k in extensions) {
    const ext = extensions[k]!
    o[k] = (...args:any) => { return ext(object, ...args) }
  }
  o[extensionsSymbol] = extensions
}

export function extend<T extends object,E extends Extensions<T>>(schema:T, extensions:E): asserts schema is T & {[K in keyof E]: E[K] extends (x:any, ...args:infer P)=>infer R ? (...args:P)=>R : never} {
  get(schema)
  applyExtend(schema, extensions)
}

export const get = <T extends object>(object:T):{[P in keyof T]:Property<T>} => {
  if (!(checksSymbol in object)) {
    throw new TypeError("Invalid schema object. Schemas must be defined via Check.define")
  }
  return (object as any)[checksSymbol] as never
}

const getFuncs = <T extends object>(object:T):{[P in keyof T]:(value:T[P])=>Fail[]} => {
  return (object as any)[checkFuncsSymbol] as never
}

function isDate(v:unknown) {
  return Object.prototype.toString.call(v) === "[object Date]"
}

function sameType(sample:unknown, value:unknown) {
  if (Array.isArray(sample)) return Array.isArray(value)
  return typeof(sample) === typeof(value)
}

function coerce(sample:unknown, value:unknown) {
  if (isDate(sample) && typeof(value) === "string") {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? value : d
  }
  return value
}

const typeOf = (v:unknown) => {
  if (Array.isArray(v)) return "array"
  if (isDate(v)) return "date"
  return typeof(v)
}

const findByName = <T extends object>(object:T, key:string):unknown => {
  for (const k in object) {
    if (rename(k) === key) {
      return object[k]
    }
  }
  return undefined
}

export type InputJSON = { [key: string]: unknown }

export interface Success<T> {
  success: true
  result: T
}

export interface Failure {
  success: false
  fail: Fail
}

const run2 = <T extends object>(prefix:string, sample:T, json:InputJSON):Success<T>|Failure => {
  type K = keyof T
  const result:InputJSON = {}
  const checks = get(sample)
  const funcs = getFuncs(sample)
  for (const k in funcs) {
    const check = checks[k]
    const sampleValue = sample[k]
    let value = coerce(sampleValue, check.name ? json[check.name] : findByName(json, k))
    if (check.required !== false) {
      if (value === undefined || value === null) {
        if (check.required === "default") {
          value = Array.isArray(sampleValue) ? [] : sampleValue
        } else {
          return { success:false, fail: new Fail(prefix + k, REQ, "missing required property") }
        }
      }
      if (!sameType(sampleValue, value)) {
        return { success:false, fail:new Fail(prefix + k, TYPE, `type mismatch, expected ${typeOf(sampleValue)} but got ${typeOf(value)}`)}
      }
    }
    if (check.allowed !== undefined && check.fallback !== undefined) {
      if (check.allowed.indexOf(value as never) < 0) {
        value = check.fallback
      }
    }
    const fails = funcs[k](value as never)
    if (fails.length > 0) {
      return { success:false, fail:fails[0]!.withPrefix(prefix) }
    }
    result[k] = value
    if (Array.isArray(value)) {
      const sampleElement = (sampleValue as never)[0]
      for (let i = 0; i < value.length; i++) {
        const element = value[i]
        if (!sameType(sampleElement, element)) {
          return { success:false, fail:new Fail(prefix + k + "[" + i + "]", TYPE, `type mismatch, expected ${typeOf(sampleElement)} but got ${typeOf(element)}`)}
        }
        if (typeof(element) === "object") {
          const r = run2(prefix + k + "[" + i + "].", sampleElement, element)
          if (r.success) {
            value[i] = r
          } else if (skip) {
            log("Skipping " + r.fail.prefix + " - " + r.fail.message)
            value.splice(i, 1)
          } else {
            return r
          }
        }
      }
    } else if (!isDate(sampleValue) && typeof(value) === "object") {
      const r = run2(prefix + k + ".", sampleValue as object, value as never)
      if (r.success) {
        result[k] = r.result
      } else if (skip && check.required === false) {
        log("Skipping " + r.fail.prefix + " - " + r.fail.message)
        result[k] = undefined
      } else {
        return r
      }
    }
  }
  return { success:true, result:result as never }
}

export const run = <T extends object>(sample:T, json:InputJSON):Success<T>|Failure => {
  const r = run2("", sample, json)
  if (r.success) {
    const extensions = (sample as any)[extensionsSymbol]
    applyExtend(r.result, extensions)
    const getters = (sample as any)[gettersSymbol]
    applyGetters(r.result, getters)
  }
  return r
}

export const parse = <T extends object>(sample:T, json:string):T => {
  const r = run(sample, JSON.parse(json))
  if (r.success) {
    return r.result
  } else {
    throw new CheckError(r.fail)
  }
}

export const runOne = <T extends object, K extends keyof T>(schema:T, object:T, k:K, v:T[K]):Fail[] => {
  const check = getFuncs(schema)[k]!
  return check(v)
}

let rename = (name:string):string => {
  return name
}

export const renameWith = (namer:(name:string)=>string):void => {
  rename = namer
}

let log:(message:string)=>void = console.log

export const logWith = (logger:(message:string)=>void):void => {
  log = logger
}

}//
