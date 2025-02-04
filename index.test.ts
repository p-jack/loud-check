import { BIGINT, Check, Fail } from "./index"

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from 'vitest'

const setType = Check.collectionType({
  name: "test",
  make: () => new Set<unknown>(),
  appliesTo: x => x instanceof Set,
  add: (set:Set<unknown>, v:unknown) => { set.add(v) },
  sampleElement: set => set.values().next().value
})
Check.addType(setType)

beforeEach(() => {
  Check.skipInvalidObjects(false)
})

afterEach(() => {
  Check.warnWith(console.warn)
  Check.augmentWith(o => o)
})

describe("required", ()=>{
  interface I { p?:string }
  test("yes is the default", ()=>{
    const cls = Check.define({p:{v:"x"}})
    expect(() => {Check.raise(cls, {}) }).toThrow("p: missing required property")
    Check.raise(cls, {p:""})
  })
  test("explicitly required", ()=>{
    const cls = Check.define({p:{v:"", required:true}})
    expect(() => {Check.raise(cls, {}) }).toThrow("p: missing required property")
    Check.raise(cls, {p:""})
  })
  test("not required", ()=>{
    const cls = Check.define({p:{v:"", required:false}})
    Check.raise(cls, {p:""})
    Check.raise(cls, {})
  })
  test("default value", ()=>{
    const cls = Check.define({p:{v:"xyzzy", required:"default"}})
    const result = Check.raise(cls, {})
    expect(result.p).toBe("xyzzy")
    Check.raise(cls, {p:""})
  })
  test("default object", ()=>{
    const cls1 = Check.define({s:{v:"xyzzy"}})
    const cls2 = Check.define({o:{v:Check.sample(cls1), required:"default"}})
    const result = Check.raise(cls2, {})
    expect(result.o.s).toBe("xyzzy")
    Check.raise(cls2, {o:{s:"qworp"}})
  })
  test("default array", ()=>{
    const cls = Check.define({p:{v:[0], required:"default"}})
    const result = Check.raise(cls, {})
    expect(result.p).toStrictEqual([])
    Check.raise(cls, {p:[1,2,3]})
  })
  test("non-required fields are still validated if present", ()=>{
    const cls = Check.define({
      p:{v:0, required:false, min:0}
    })
    expect(() => {Check.raise(cls, {p:-1})}).toThrow("p: value of -1 < minimum value of 0")
  })
})

function newDate(year:number):Date {
  return new Date(Date.UTC(year, 1, 1, 0, 0, 0, 0))
}

describe("min", ()=>{
  test("number", ()=>{
    const cls = Check.define({v:{ v:10, min:10 }})
    expect(() => {Check.raise(cls, {v:5}) }).toThrow("v: value of 5 < minimum value of 10")
    Check.raise(cls, {v:10})
    Check.raise(cls, {v:11})
    Check.raise(cls, {v:110000})
  })
  test("BigInt", ()=>{
    const cls = Check.define({v:{ v:BigInt(10), min:10 }})
    expect(() => {Check.raise(cls, {v:BigInt(5)}) }).toThrow("v: value of 5 < minimum value of 10")
    Check.raise(cls, {v:BigInt(10)})
    Check.raise(cls, {v:BigInt(11)})
    Check.raise(cls, {v:BigInt(110000)})
  })
  test("Date", ()=>{
    const cls = Check.define({v:{ v:newDate(1970), min:10 }})
    expect(() => {Check.raise(cls, {v:newDate(1969)}) }).toThrow("< minimum value of")
    Check.raise(cls, {v:newDate(1970)})
    Check.raise(cls, {v:newDate(2000)})
    Check.raise(cls, {v:newDate(110000)})
  })
  test("string (length)", ()=>{
    const cls = Check.define({v:{ v:"1234567890", min:10 }})
    expect(() => {Check.raise(cls, {v:"12345"}) }).toThrow("v: length of 5 < minimum length of 10")
    Check.raise(cls, {v:"1234567890"})
    Check.raise(cls, {v:"1234567890A"})
    Check.raise(cls, {v:"1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ"})
  })
  test("set (size)", () => {
    const cls = Check.define({set:{ v:new Set([0]), min:1}})
    expect(() => {Check.raise(cls, {set:[]})}).toThrow("set: size of 0 < minimum size of 1")
    expect(() => {new cls({set:new Set([])})}).toThrow("set: size of 0 < minimum size of 1")
  })
})

describe("max", ()=>{
  test("number", ()=>{
    const cls = Check.define({v:{ v:0, max:10 }})
    expect(() => {Check.raise(cls, {v:50}) }).toThrow("v: value of 50 > maximum value of 10")
    Check.raise(cls, {v:10})
    Check.raise(cls, {v:9})
    Check.raise(cls, {v:-110000})
  })
  test("BigInt", ()=>{
    const cls = Check.define({v:{ v:BigInt(10), max:BigInt(10) }})
    expect(() => {Check.raise(cls, {v:BigInt(50)}) }).toThrow("v: value of 50 > maximum value of 10")
    Check.raise(cls, {v:BigInt(10)})
    Check.raise(cls, {v:BigInt(9)})
    Check.raise(cls, {v:BigInt(-110000)})
  })
  test("Date", ()=>{
    const cls = Check.define({v:{ v:newDate(0), max:newDate(1970) }})
    expect(() => {Check.raise(cls, {v:newDate(1971)}) }).toThrow("> maximum value of")
    Check.raise(cls, {v:newDate(1969)})
    Check.raise(cls, {v:newDate(1800)})
  })
  test("string (length)", ()=>{
    const cls = Check.define({v:{ v:"", max:3 }})
    expect(() => {Check.raise(cls, {v:"12345"}) }).toThrow("v: length of 5 > maximum length of 3")
    Check.raise(cls, {v:"123"})
    Check.raise(cls, {v:"12"})
    Check.raise(cls, {v:""})
  })
  test("set (size)", () => {
    const cls = Check.define({set:{ v:new Set([0]), max:1}})
    expect(() => {Check.raise(cls, {set:[1, 2]})}).toThrow("set: size of 2 > maximum size of 1")
    expect(() => {new cls({set:new Set([1,2])})}).toThrow("set: size of 2 > maximum size of 1")
  })
})

describe("allowed", ()=>{
  test("allowed", ()=>{
    const cls = Check.define({v:{ v:"a", allowed:["a","b","c"]}})
    expect(() => {Check.raise(cls, {v:"d"}) }).toThrow("v: invalid value: d - valid values are: a,b,c")
    Check.raise(cls, {v:"a"})
    Check.raise(cls, {v:"b"})
    Check.raise(cls, {v:"c"})
  })
  test("fallback", () => {
    const cls = Check.define({v:{ v:"a", allowed:["a","b","c"], fallback:"a"}})
    const r = Check.raise(cls, {v:"x"})
    expect(r.v).toBe("a")
  })
})

test("regex", () => {
  const cls = Check.define({s:{ v:"abc", regex:/abc/}})
  expect(() => {Check.raise(cls, {s:"a"})}).toThrow("s: invalid value: a - must match /abc/")
  expect(() => {Check.raise(cls, {s:""})}).toThrow("s: invalid value:  - must match /abc/")
  Check.raise(cls, {s:"abc"})
  Check.raise(cls, {s:"123abc"})
  Check.raise(cls, {s:"1abc1"})
})

describe("integer", () => {
  test("true by default", () => {
    const cls = Check.define({n:{v:0}})
    expect(() => {Check.raise(cls, {n:3.1})}).toThrow("n: value of 3.1 is not a safe integer")
    expect(() => {Check.raise(cls, {n:2**53})}).toThrow("n: value of 9007199254740992 is not a safe integer")
    Check.raise(cls, {n:-1000})
    Check.raise(cls, {n:2**53-1})
  })
  test("explicitly set to true", () => {
    const cls = Check.define({n:{v:0, integer:true}})
    expect(() => {Check.raise(cls, {n:3.1})}).toThrow("n: value of 3.1 is not a safe integer")
    expect(() => {Check.raise(cls, {n:2**53})}).toThrow("n: value of 9007199254740992 is not a safe integer")
    Check.raise(cls, {n:-1000})
    Check.raise(cls, {n:2**53-1})
  })
  test("false", () => {
    const cls = Check.define({n:{v:0, integer:false}})
    Check.raise(cls, {n:-1000})
    Check.raise(cls, {n:2**53-1})
    Check.raise(cls, {n:2**53})
    Check.raise(cls, {n:3.14})
  })
})

test("custom", ()=>{
  const cls = Check.define({
    v:{
      v:0,
      custom:(value:number)=>{
        if (value % 2 !== 0) {
          return new Fail("v", "EVEN", "must be even")
        }
      }
    }
  })
  expect(() => {Check.raise(cls, {v:1}) }).toThrow("must be even")
  Check.raise(cls, {v:0})
})

describe("nested objects", () => {
  test("skipping", () => {
    Check.skipInvalidObjects(true)
    const logs:string[] = []
    Check.warnWith((msg:string) => logs.push(msg))
    const cls2 = Check.define({ s: {v:"1", min:1}})
    const sample2 = Check.sample(cls2)
    const cls1 = Check.define({
      o1: {v:sample2},
      o2: {v:sample2, required:false}
    })
    const good = { o1: { s: "1" }, o2: { s:[] } }
    const r = Check.raise(cls1, good)
    expect(r.o2).toBeUndefined()
    expect(logs[0]).toBe("skipping nested object o2.s - expected string but got array")
  })
  test("not skipping", () => {
    const cls2 = Check.define({ s:{v:"1", min:1 }})
    const cls1 = Check.define({ o:{v:Check.sample(cls2) }})
    const good = { o: { s: "2" } }
    const r = Check.run(cls1, good)
    if (r.success) {
      expect(r.result.o.s).toBe("2")
    } else {
      expect(r.success).toBe(true)
    }
    const bad = { o: { s: "" } }
    expect(() => { Check.raise(cls1, bad) }).toThrow("o.s: length of 0 < minimum length of 1")
  })
  test("already checked", () => {
    const cls2 = Check.define({ s:{v:"1", min:1 }})
    const cls1 = Check.define({ o:{v:Check.sample(cls2) }})
    const o2 = new cls2({s:"22"})
    const o1a = new cls1({o:o2})
    expect(o1a.o === o2).toBe(true)
    const o1b = new cls1(o1a)
    expect(o1b.o === o2).toBe(true)
  })
})

describe("nested arrays", () => {
  test("primitive elements", () => {
    const cls = Check.define({ a:{ v:[""] } })
    const good1 = { a:["1", "2", "3"] }
    const parsed1 = Check.raise(cls, good1)
    expect(parsed1.a.length).toBe(3)
    expect(parsed1.a[0]).toBe("1")
    expect(parsed1.a[1]).toBe("2")
    expect(parsed1.a[2]).toBe("3")
    const good2 = { a:[] }
    Check.raise(cls, good2)
    const bad = { a:[1, 2, 3] }
    expect(() => { Check.raise(cls, bad)}).toThrow("a[0]: expected string but got number")
  })
  test("deep nest", () => {    
    class c1 extends Check.define({ a:{ v:[0], min:3, max:3 }}) {}
    const o1 = new c1({a:[11,22,33]})
    class c2 extends Check.define({ o:{ v:Check.sample(c1)}}) {}
    const o2 = new c2({o:o1})
    expect(o2.o.a.length).toBe(3)
    expect(o2.o.a[0]).toBe(11)
    expect(o2.o.a[1]).toBe(22)
    expect(o2.o.a[2]).toBe(33)
  })
  test("object elements", () => {
    class Element extends (Check.define({ n: { v:1, min:1 }})) {
      public get nn() { return this.n + this.n }
    }
    const sampleElement = Check.sample(Element)
    const cls = Check.define({ a:{ v:[sampleElement] }})
    const good1 = { a:[] }
    Check.raise(cls, good1)
    const good2 = { a:[{ n:11 }, { n:22 }, { n:33 }]}
    const x = Check.raise(cls, good2)
    expect(x.a[0]?.n).toBe(11)
    expect(x.a[0]?.nn).toBe(22)
    const bad1 = { a:[1,2,3] }
    expect(() => { Check.raise(cls, bad1)}).toThrow("a[0]: expected object but got number")
    const bad2 = { a:[{ n:0 }]}
    expect(() => { Check.raise(cls, bad2)}).toThrow("a[0].n: value of 0 < minimum value of 1")
  })
  test("skipping", () => {
    const logs:string[] = []
    Check.warnWith((msg:string) => logs.push(msg))
    Check.skipInvalidObjects(true)
    const sampleCls = Check.define({ n: { v:1, required:true }})
    const sampleElement = Check.sample(sampleCls)
    const cls = Check.define({ a: { v:[sampleElement] }})
    const r = Check.raise(cls, { a: [
      { n: undefined },
      { n: 2 },
      { n: undefined },
      { n: 4 },
      { n: undefined },
    ]})
    expect(r.a.length).toBe(2)
    expect(r.a[0]?.n).toBe(2)
    expect(r.a[1]?.n).toBe(4)
    expect(logs[0]).toBe("skipping element a[0].n - missing required property")
    expect(logs[1]).toBe("skipping element a[2].n - missing required property")
    expect(logs[2]).toBe("skipping element a[4].n - missing required property")

    const r2 = Check.raise(cls, { a:[
      { n: undefined },
      { n: undefined }, 
    ]})
    expect(r2.a.length).toBe(0)
  })
  test("not required", () => {
    class C2 extends Check.define({n:{v:0}}) {}
    class C1 extends Check.define({a:{v:[Check.sample(C2)], required:false}}) {}
    const o1 = Check.raise(C1, {})
    expect(o1.a).toBeUndefined()
  })
})

test("runOne", () => {
  const cls = Check.define({ n:{ v:10, min:0 }})
  const obj = { n:0 }
  const fails = Check.runOne(cls, obj, "n", -1)
  expect(fails).toHaveLength(1)
  expect(fails[0]?.prefix).toBe("n")
  expect(fails[0]?.code).toBe("MIN")
  expect(fails[0]?.message).toBe("value of -1 < minimum value of 0")
})

test("parse", () => {
  class E extends Check.define({p:{v:""}}) {}
  const e = Check.parse(E, '{"p":"s"}')
  expect(e.p).toBe("s")
  expect(()=>{ Check.parse(E, '{"p":0}')}).toThrow("p: expected string but got number")
  class A extends Check.define({a:{v:[new E({p:""})]}}) {}
  const a = Check.parse(A, '{"a":[{"p":"s"}]}')
  expect(a.a.length).toBe(1)
  expect(a.a[0]?.p).toBe("s")
  expect(E === e.constructor).toBe(true)
  expect(a.constructor === A).toBe(true)
})

test("parseArray", () => {
  class C extends Check.define({n:{v:0, min:0}}) {}
  const a = Check.parseArray(C, `[{"n":11},{"n":22},{"n":33}]`)
  expect(a.length).toBe(3)
  expect(a[0]!.n).toBe(11)
  expect(a[1]!.n).toBe(22)
  expect(a[2]!.n).toBe(33)
  expect(() => { Check.parseArray(C, `[{"n":-1}]`)}).toThrow("minimum value")
  expect(() => { Check.parseArray(C, `{}`)}).toThrow("expected input array but got object")
})

test("mismatches", () => {
  const cls1 = Check.define({a:{v:[""]}})
  expect(()=>{ Check.raise(cls1, {a:""})}).toThrow("a: expected array but got string")
  const cls2 = Check.define({s:{v:""}})
  expect(()=>{ Check.raise(cls2, {s:[]})}).toThrow("s: expected string but got array")
})

test("constructors", () => {
  class C extends Check.define({n:{v:1,min:1}}) {}
  const obj = new C({n:1})
  expect(obj.n).toBe(1)
  expect(()=>{ new C({n:0})}).toThrow("n: value of 0 < minimum value of 1")
})

test("recursive data types", () => {
  interface BarI {
    bar: number
    foo?: Foo
    plusOne: number
    add(x:number):number
  }
  class Foo extends Check.define({
    foo: { v:0 },
    bar: { v:null as unknown as BarI, required:false }
  }) {}
  class Bar extends Check.define({
    bar: { v:0 },
    foo: { v:Check.sample(Foo), required:false }
  }) implements BarI {
    get plusOne() { return this.bar + 1 }
    add(x:number) { return this.bar + x }
  }
  Check.recurse(Foo, "bar", Check.sample(Bar))
  const text = `{"foo":11,"bar":{"bar":22}}`
  const foo = Check.parse(Foo, text)
  expect(foo.bar?.add(3)).toBe(25)
  expect(foo.bar?.plusOne).toBe(23)
})

test("types", () => {
  Check.addType({
    name:"bigint",
    priority:500_000_000,
    appliesTo:(v:unknown) => typeof(v) === "bigint",
    defaultTo:(sample:BigInt) => sample,
    mismatch:(json:unknown) => {
      if (typeof(json) !== "string") return `expected bigint string but got ${typeof(json)}`
      return false
    },
    parse:(prefix:string, sample:unknown, json:unknown) => {
      try {
        return { success:true, result:BigInt(json as string) }
      } catch (e:any) {
        const msg = "message" in e ? e.message : "invalid bigint string"
        return { success:false, fail:new Fail(prefix, BIGINT, msg) }
      }
    }
  })
  class C extends Check.define({n:{v:BigInt(0)}}) {}
  const o = Check.raise(C, {n:"101"})
  expect(o.n).toBe(BigInt(101))
  expect(()=>{ Check.raise(C, {n:"xxx"})}).toThrow("n: Cannot convert xxx to a BigInt")
})

test("collection type resolution", () => {
  class A extends Check.define({a:{v:[0]}}) {}
  const a = Check.raise(A, {a:[11,22,33]})
  expect(a.a[0]).toBe(11)
  expect(a.a[1]).toBe(22)
  expect(a.a[2]).toBe(33)
  class S extends Check.define({s:{v: new Set([0])}}) {}
  const s = Check.raise(S, {s:[11,22,33]})
  expect(s.s).toBeInstanceOf(Set)
  expect(s.s.has(11)).toBe(true)
  expect(s.s.has(22)).toBe(true)
  expect(s.s.has(33)).toBe(true)
  const set = new Set([111,222,333])
  const s1 = new S({s:set})
  expect(set === s1.s).toBe(true)

})

test("augment", () => {
  let target:any = null
  let key:string|symbol = ""
  let value:any = null
  Check.augmentWith(o => new Proxy(o, {
    set:(t, k, v) => {
      target = t
      key = k
      value = v
      return true
    }
  }))
  class C extends Check.define({n:{v:0}}) {}
  const instance = new C({n:0})
  instance.n = 5
  expect(key).toBe("n")
  expect(value).toBe(5)
  expect(target).toStrictEqual(instance)
})

test("extensions", () => {
  class C extends Check.define({n:{v:0}}) { get plus1() { return this.n + 1}}
  const r = Check.run(C, {n:100})
  expect(r.success).toBe(true)
  if (r.success) {
    const o:C = r.result
    expect(o.n).toBe(100)
    expect(o.plus1).toBe(101)
  }
  const o = Check.raise(C, {n:200})
  expect(o.n).toBe(200)
  expect(o.plus1).toBe(201)
})
