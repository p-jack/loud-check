import { Check } from "./index"

const yell = (sample:object, object:object) => {
  Check.copy(sample, object)
  Check.raise(object)
}

describe("required", ()=>{
  interface I { p?:string }
  test("is the default", ()=>{
    const sample = Check.define({p:{v:""}})
    expect(() => {yell(sample, {}) }).toThrow("p: missing required property")
    yell(sample, {p:""})
  })
  test("explicitly required", ()=>{
    const sample = Check.define({p:{v:"", required:true}})
    expect(() => {yell(sample, {}) }).toThrow("p: missing required property")
    yell(sample, {p:""})
  })
  test("not required", ()=>{
    const sample = Check.define({p:{v:"" as string|undefined, required:false}})
    yell(sample, {p:""})
    yell(sample, {})
  })
  test("non-required fields are still validated if present", ()=>{
    const sample = Check.define({
      p:{v:0 as number|undefined, required:false, min:0}
    })
    expect(() => {yell(sample, {p:-1})}).toThrow("p: value of -1 < minimum value of 0")
  })
})

function newDate(year:number):Date {
  return new Date(Date.UTC(year, 1, 1, 0, 0, 0, 0))
}

describe("min", ()=>{
  test("number", ()=>{
    const sample = Check.define({v:{ v:10, min:10 }})
    expect(() => {yell(sample, {v:5}) }).toThrow("v: value of 5 < minimum value of 10")
    yell(sample, {v:10})
    yell(sample, {v:11})
    yell(sample, {v:110000})
  })
  test("BigInt", ()=>{
    const sample = Check.define({v:{ v:BigInt(10), min:10 }})
    expect(() => {yell(sample, {v:BigInt(5)}) }).toThrow("v: value of 5 < minimum value of 10")
    yell(sample, {v:BigInt(10)})
    yell(sample, {v:BigInt(11)})
    yell(sample, {v:BigInt(110000)})
  })
  test("Date", ()=>{
    const sample = Check.define({v:{ v:newDate(1970), min:10 }})
    expect(() => {yell(sample, {v:newDate(1969)}) }).toThrow("< minimum value of")
    yell(sample, {v:newDate(1970)})
    yell(sample, {v:newDate(2000)})
    yell(sample, {v:newDate(110000)})
  })
  test("string (length)", ()=>{
    const sample = Check.define({v:{ v:"1234567890", min:10 }})
    expect(() => {yell(sample, {v:"12345"}) }).toThrow("v: length of 5 < minimum length of 10")
    yell(sample, {v:"1234567890"})
    yell(sample, {v:"1234567890A"})
    yell(sample, {v:"1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ"})
  })
  test("set (size)", ()=>{
    const sample = Check.define({v:{ v:new Set([1,2,3]), min:3 }})
    expect(() => {yell(sample, {v:new Set([1])}) }).toThrow("v: size of 1 < minimum size of 3")
    yell(sample, {v: new Set([1, 2, 3])})
    yell(sample, {v: new Set([1, 2, 3, 4])})
    yell(sample, {v: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])})
  })
})

describe("max", ()=>{
  test("number", ()=>{
    const sample = Check.define({v:{ v:0, max:10 }})
    expect(() => {yell(sample, {v:50}) }).toThrow("v: value of 50 > maximum value of 10")
    yell(sample, {v:10})
    yell(sample, {v:9})
    yell(sample, {v:-110000})
  })
  test("BigInt", ()=>{
    const sample = Check.define({v:{ v:BigInt(10), max:BigInt(10) }})
    expect(() => {yell(sample, {v:BigInt(50)}) }).toThrow("v: value of 50 > maximum value of 10")
    yell(sample, {v:BigInt(10)})
    yell(sample, {v:BigInt(9)})
    yell(sample, {v:BigInt(-110000)})
  })
  test("Date", ()=>{
    const sample = Check.define({v:{ v:newDate(0), max:newDate(1970) }})
    expect(() => {yell(sample, {v:newDate(1971)}) }).toThrow("> maximum value of")
    yell(sample, {v:newDate(1969)})
    yell(sample, {v:newDate(1800)})
  })
  test("string (length)", ()=>{
    const sample = Check.define({v:{ v:"", max:3 }})
    expect(() => {yell(sample, {v:"12345"}) }).toThrow("v: length of 5 > maximum length of 3")
    yell(sample, {v:"123"})
    yell(sample, {v:"12"})
    yell(sample, {v:""})
  })
  test("set (size)", ()=>{
    const sample = Check.define({v:{ v:new Set([0]), max:3 }})
    expect(() => {yell(sample, {v:new Set([1,2,3,4,5])}) }).toThrow("v: size of 5 > maximum size of 3")
    yell(sample, {v: new Set([1, 2, 3])})
    yell(sample, {v: new Set([1, 2])})
    yell(sample, {v: new Set([])})
  })
})

describe("allowed", ()=>{
  test("allowed", ()=>{
    const sample = Check.define({v:{ v:"a", allowed:["a","b","c"]}})
    expect(() => {yell(sample, {v:"d"}) }).toThrow("v: invalid value: d - valid values are: a,b,c")
    yell(sample, {v:"a"})
    yell(sample, {v:"b"})
    yell(sample, {v:"c"})
  })
})

test("regex", () => {
  const sample = Check.define({s:{ v:"abc", regex:/abc/}})
  expect(() => {yell(sample, {s:"a"})}).toThrow("s: invalid value: a - must match /abc/")
  expect(() => {yell(sample, {s:""})}).toThrow("s: invalid value:  - must match /abc/")
  yell(sample, {s:"abc"})
  yell(sample, {s:"123abc"})
  yell(sample, {s:"1abc1"})
})

describe("integer", () => {
  test("true by default", () => {
    const sample = Check.define({n:{v:0}})
    expect(() => {yell(sample, {n:3.1})}).toThrow("n: value of 3.1 is not a safe integer")
    expect(() => {yell(sample, {n:2**53})}).toThrow("n: value of 9007199254740992 is not a safe integer")
    yell(sample, {n:-1000})
    yell(sample, {n:2**53-1})
  })
  test("explicitly set to true", () => {
    const sample = Check.define({n:{v:0, integer:true}})
    expect(() => {yell(sample, {n:3.1})}).toThrow("n: value of 3.1 is not a safe integer")
    expect(() => {yell(sample, {n:2**53})}).toThrow("n: value of 9007199254740992 is not a safe integer")
    yell(sample, {n:-1000})
    yell(sample, {n:2**53-1})
  })
  test("false", () => {
    const sample = Check.define({n:{v:0, integer:false}})
    yell(sample, {n:-1000})
    yell(sample, {n:2**53-1})
    yell(sample, {n:2**53})
    yell(sample, {n:3.14})
  })
})

test("custom", ()=>{
  const sample = Check.define({
    v:{
      v:0,
      custom:(value:number)=>{
        if (value % 2 !== 0) {
          return { code:"EVEN", message:"must be even"}
        }
      }
    }
  })
  expect(() => {yell(sample, {v:1}) }).toThrow("must be even")
  yell(sample, {v:0})
})

test("throws error if never defined", ()=>{
  expect(() => {Check.run({x:5})}).toThrow("No checks defined.")
})

test("runOne", () => {
  const sample = Check.define({ n:{ v:10, min:0 }})
  const obj = { n:0 }
  Check.copy(sample, obj)
  const fails = Check.runOne(obj, "n", -1)
  expect(fails).toStrictEqual([{
    code: "MIN",
    message: "n: value of -1 < minimum value of 0"
  }])
})

test("get", () => {
  const sample = Check.define({ n:{ v:10, min:0 }})
  const obj = { n:0 }
  Check.copy(sample, obj)
  const schema = Check.get(obj)
  expect(schema).toBeDefined()
  expect(schema!.n.v).toBe(10)
  expect(schema!.n.min).toBe(0)  
})
