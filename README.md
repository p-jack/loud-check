# loudo-check

`Check` is a small library for adding strict checks to objects.

```typescript
import { Check } from "loudo-check"

class User extends Check.define({
  id: { v:1, min:1 },
  email:{ v:"fake@example.com", regex:/[a-z0-9]+@[a-z]+\.[a-z]{2,3}/ },
  name:{ v:"Reba", min:1, max:100 }
}) {}

const inputJSON = `
{
  "id":1234,
  "email":"fake@example.com",
  "name":"Flugelhorn"
}
`

const user = Check.parse(User, inputJSON)
const user2 = new User({
  id:1234,
  "email":"fake@example.com",
  "name":"Flugelhorn",
})
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

`Check.define` results in a class that consists of all the 
defined properties. You can use the class to directly construct
instances, but the constructor will raise a `CheckError` if any
of the checks you defined on the properties fail.

You can also pass the class to `Check.run` to see if checks would
pass on input values, or to `Check.parse` to parse json.
