# loudo-check

`Check` is a small library for adding strict checks to objects.

```typescript
import { Check } from "loudo-check"

const user0 = Check.define({
  id: { v:"A18C978A-7A2C-4EA4-BBFF-75C1EF30FCC3", min:36, max:36 },
  email:{ v:"fake@example.com", regex:/[a-z0-9]+@[a-z]+\.[a-z]{2,3}/ },
  name:{ v:"Reba", min:1, max:100 }
})

type User = typeof user0

const user:User = {
  id: "1234",
  email: "fake@example.com",
  name: "Flugelhorn"
}

Check.copy(user0, user)
const fails = Check.run(user)
console.log(fails)
// id: length of 4 < minimum length of 36

Check.raise(user)
// raises a CheckError with above message

```

## Defining Checks

Use `Check.define` and pass in a schema consisting of
various `Check.Property` objects that define the properties
and the checks for that property.

`Check.Property` consists of the following fields:

* The `v` field is a sample value for the property that should pass
  all of its checks. The `v` field is mandatory; every other 
  field 
* The `required` field determines whether the property is required.
  If unspecified, it defaults to true.
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
fields of those properties. That is a *sample object*, and can
be used to copy the schema to other conforming objects (via
`Check.copy`.)

