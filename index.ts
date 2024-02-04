export namespace Check {//

export const MIN = "MIN"
export const MAX = "MAX"
export const REQ = "REQ"
export const ALLOWED = "ALLOWED"
export const REGEX = "REGEX"
export const INTEGER = "INTEGER"
export const UNKNOWN = "UNKNOWN"

export interface Fail {
  readonly code:string
  readonly message:string
}

export class CheckError extends Error {

  code:string
  
  constructor(fail:Fail) {
    super(fail.message)
    this.code = fail.code
  }
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
        return {code:MIN, message:`${name}: length of ${length} < minimum length of ${min}`}
      }
    }
  }
  if (hasProp(sample, "size")) {
    return (value:T) => {
      const size = (value as Size).size
      if (size < (min as number)) {
        return {code:MIN, message:`${name}: size of ${size} < minimum size of ${min}`}
      }
    }
  }
  return (value:T) => {
    if (value < min) {
      return {code:MIN, message:`${name}: value of ${value} < minimum value of ${min}`}
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
        return {code:MAX, message:`${name}: length of ${length} > maximum length of ${max}`}
      }
    }
  }
  if (hasProp(sample, "size")) {
    return (value:T) => {
      const length = (value as Size).size
      if (length > (max as number)) {
        return {code:MAX, message:`${name}: size of ${length} > maximum size of ${max}`}
      }
    }
  }
  return (value:T) => {
    if (value > max) {
      return {code:MAX, message:`${name}: value of ${value} > maximum value of ${max}`}
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
      return {code:ALLOWED, message:`${name}: invalid value: ${value} - valid values are: ${allowed}`}
    }
  }
}

const regexChecker = <T>(name:string, regex:RegExp|undefined):Checker<T>|undefined => {
  if (regex === undefined) {
    return undefined
  }
  return (value:T) => {
    if (!regex.test(String(value))) {
      return {code:REGEX, message:`${name}: invalid value: ${value} - must match ${regex}`}
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
      return {code:INTEGER, message:`${name}: value of ${value} is not a safe integer`}
    }
  }
}

const checkFuncsSymbol = Symbol("checkFuncs")
const checksSymbol = Symbol("checks")

export interface Property<T> {
  v:T
  required?:boolean
  min?:Limit<T>
  max?:Limit<T>
  allowed?:T[]
  integer?:boolean
  regex?:RegExp
  custom?:Checker<T>
}

interface Optimized<T> {
  name:string
  required:boolean
  passes:Checker<T>[]
}

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
  return { name, required, passes }
}

const toFunction = <T>(name:string, sample:T, p:Property<T>):(value:T)=>Fail[] => {
  const opt = optimize(name, sample, p)
  const passes = opt.passes
  passes.forEach(x => x(sample))
  if (opt.required) {
    return (value:T) => {
      if ((value === undefined) || (value === null)) {
        return [{ code:REQ, message:`${name}: missing required property`}]
      }
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

export const define = <T extends Record<string,Property<any>>>(schema:T):{[P in keyof T]:T[P]["v"]} => {
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

export const get = <T extends object>(object:T):{[P in keyof T]:Property<T>}|undefined => {
  return (object as any)[checksSymbol] as never
}

const getFuncs = <T extends object>(object:T):{[P in keyof T]:(value:T[P])=>Fail[]} => {
  if (!(checkFuncsSymbol in object)) {
    throw new TypeError("No checks defined.")
  }
  return (object as any)[checkFuncsSymbol] as never
}

export const copy = <T extends object>(sample:T, object:T) => {
  (object as any)[checksSymbol] = get(sample);
  (object as any)[checkFuncsSymbol] = getFuncs(sample)
}

export const run = <T extends object, K extends keyof T>(object:T):{[P in keyof T]:Fail[]} => {
  const result:Partial<Record<K,Fail[]>> = {}
  const o = object as any
  const checks = getFuncs(o)
  for (const k in checks) {
    const kk = k as unknown as K
    result[kk] = checks[kk](o[kk])
  }
  return result as never
}

export const runOne = <T extends object, K extends keyof T>(object:T, k:K, v:T[K]):Fail[] => {
  const check = getFuncs(object)[k]!
  return check(v)
}

export const raise = <T extends object>(object:T):void => {
  type K = keyof T
  const results = run(object)
  for (const k in results) {
    const fails = results[k]
    if (fails.length !== 0) {
      throw new CheckError(fails[0]!)
    }
  }
}


}//
