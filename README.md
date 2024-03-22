# loudo-check

`Check` is a small library for adding strict checks to objects.

```typescript
import { Check } from "loudo-check"

const userSchema = Check.define({
  id: { v:"A18C978A-7A2C-4EA4-BBFF-75C1EF30FCC3", min:36, max:36 },
  email:{ v:"fake@example.com", regex:/[a-z0-9]+@[a-z]+\.[a-z]{2,3}/ },
  name:{ v:"Reba", min:1, max:100 }
})

type User = typeof userSchema

const inputJSON = `
{
  "id":"1234",
  "email":"fake@example.com",
  "name":"Flugelhorn"
}
`

const user = Check.parse(userSchema, inputJSON)
```

## Defining Checks

Use `Check.define` and pass in a schema consisting of
various `Check.Property` objects that define the properties
and the checks for that property.

`Check.Property` consists of the following fields:

* The `v` field is a sample value for the property that should pass
  all of its checks. The `v` field is mandatory; every other 
  field is optional.
* The `required` field determines whether the property is required.
  If unspecified, it defaults to true. You can also use the special
  string value `"default"`; in that case, if the property is missing,
  the sample value (defined via `v`) will be used instead.
* The `min` field is either the minimum value for the property
  (for numbers, Dates, and BigInts) or the minimum length/size of
  an array, arraylike, string, Set, or anything else that has a
  length or a size property. If unspecified, there is no minimum.
* Similarly, the `max` field is either a maximum value (inclusive)
  or a maximum length/size (inclusive.) If unspecified, there is
  no maximum.
* The `allowed` field is a set of discrete values that are allowed.
  If unspecified, all values are allowed (if they pass the other
  checks.)
* The `regex` field is a regular expression that the string 
  representation of the property must match. If unspecified, 
  all values are allowed (if they pass the other checks.)
* The `integer` field specifies whether or not a `number` property
  must be a safe integer. If unspecified, it defaults to true.
  If false, then real numbers, NaN, and infinities are allowed.

`Check.define` results in an object that consists of all the 
defined properties, with their values initialized to the `v` 
fields of those properties. That is a _schema object_. You can
pass the schema to `Check.parse` to parse a JSON string, raising
an error if the object in the JSON does not pass the checks defined
in the sample. You can also use `Check.run` to test an object
against the schema, retrieving any failures without raising an error.

## Extending Schema Objects

It's sometimes useful to define additional getter properties or
helper functions on a schema object, and to have those extensions 
propagate to any object created via `Check.parse`.

### Adding Getters

You can use `Check.getters` to define getter functions:

```typescript
const schema = Check.define({
  x: { v:0 },
  y: { v:0 }
})

Check.getters(schema, {
  sum: (o) => { return o.x + o.y },
  min: (o) => { return Math.min(o.x, o.y) }
})

const obj = Check.parse(schema, `{"x":11, "y":22}`)
console.log(obj.sum) // 33
console.log(obj.min) // 11
```

Note that even though you define the getters as _functions_,
they become _properties_ during the parse.

### Adding Functions

You can use `Check.extend` to add functions:

```typescript
const schema = Check.define({
  x: { v:0 },
  y: { v:0 }
})

Check.extend(schema, {
  sum(this: typeof schema) {
    return this.x + this.y
  },
  min(this: typeof schema) {
    return Math.min(this.x, this.y)
  },
})

const obj = Check.parse(schema, `{"x":11, "y":22}`)
console.log(obj.sum()) // 33
console.log(obj.min()) // 11
```
