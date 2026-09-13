# export-kit

**Simple, schema-driven data export library for TypeScript.**

`export-kit` helps you transform JavaScript objects into structured text formats such as **CSV** and **fixed-length records**, then write them efficiently to files. It is designed for batch jobs, scheduled exports, banking files, legacy integrations, reporting, and ETL pipelines.

Unlike full ETL frameworks, `export-kit` focuses on one responsibility:

> **Convert objects into export formats with minimal code.**

```text
                                export-kit
                                     │
                 ┌───────────────────┴───────────────────┐
                 │                                       │
             Formatter<T>                             File I/O
                 │                                       │
       ┌─────────┴─────────┐                   ┌─────────┴─────────┐
       │                   │                   │                   │
CSV Formatter    Fixed Length Formatter     FileWriter          LogWriter
       │                   │
       │                   │
   CSV text         fixed-width text
```

## Features

* Format objects as CSV
  * Properly escape CSV values containing separators, quotes, or line breaks
  * Customize field formatting with `getString`
  * Reusable `CSVFormatter`
* Format objects as fixed-length records
  * Customize field formatting with `getString`
  * Reusable `FixedLengthFormatter`
* Write text to files using Node.js streams
  * Automatically create output directories
  * Append to files by default
  * Keep file-writing and formatting concerns separate
* Generate date and time strings for file names and batch processing
  * Date formatting with optional separators
  * Time formatting with optional separators
  * Date arithmetic with `addDays`
* Minimal dependencies and lightweight implementation

## Installation

```bash
npm install export-kit
```

## Design

The library deliberately keeps serialization logic independent from file output.

```text
Object
  │
  ├── CSV schema ──────────────► CSV string
  │                               │
  │                               └──► CSVFormatter
  │
  └── Fixed-length schema ─────► Fixed-width string
                                  │
                                  └──► FixedLengthFormatter

String/data
  │
  ├── FileWriter
  └── LogWriter
          │
          └── Node.js WriteStream
```

This makes the formatting functions useful independently of the file-writing layer.

```text
Formatting
  ├── CSV
  └── Fixed Length

Writing
  ├── FileWriter
  └── LogWriter

Date utilities
  ├── dateToString
  ├── timeToString
  ├── addDays
  └── getPrefix
```

---

## File Writing

### `createWriteStream`

Creates the destination directory when necessary and returns a Node.js `WriteStream`.

```ts
import { createWriteStream } from "export-kit"

const writer = createWriteStream("./output", "data.txt")

writer.write("hello\n")
writer.end()
```

The default stream options append to the file using UTF-8 encoding:

```ts
{
  flags: "a",
  encoding: "utf-8"
}
```

Custom stream options can be provided:

```ts
const writer = createWriteStream(
  "./output",
  "users.csv",
  {
    flags: "w",
    encoding: "utf-8"
  }
)
```

### `FileWriter`

`FileWriter` is a small wrapper around a `WriteStream`.

```ts
import { createFileWriter } from "export-kit"

const writer = createFileWriter("./output", "data.txt")

writer.write("Hello\n")
writer.end()
```

### `LogWriter`

`LogWriter` writes a string and automatically appends a suffix to every record.

The default suffix is `\n`.

```ts
import { createLogWriter } from "export-kit"

const writer = createLogWriter("./output", "application.log")

writer.write("Application started")
writer.write("Application stopped")
writer.end()
```

The resulting file contains:

```text
Application started
Application stopped
```

A custom suffix can be supplied:

```ts
const writer = createLogWriter(
  "./output",
  "data.txt",
  undefined,
  "\r\n"
)

writer.write("Application started")
writer.write("Application stopped")
```

---

## Types

### `Attribute`

```ts
interface Attribute {
  getString?: (v: any) => string
  length?: number
}

interface Attributes {
  [key: string]: Attribute
}
```

### `FixedLengthAttribute`

```ts
interface FixedLengthAttribute {
  getString?: (v: any) => string
  length: number
}

interface FixedLengthAttributes {
  [key: string]: FixedLengthAttribute
}
```


### Architecture

```text
                  Business Object
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
    Attributes                 FixedLengthAttribute
         │                               │
         ▼                               ▼
   CSVFormatter                FixedLengthFormatter
         │                               │
CSV Formatted String        Fixed-length Formatted String
         │                               │
         └───────────────┬───────────────┘
                         │
                 Stream File Writer 
                         │
                         ▼
                    Output File
```

The formatter is responsible only for converting objects into text.

The writer is responsible only for writing text.

This separation keeps export logic independent from file I/O.

---

## CSV Formatting

```text
   User
     │
     ▼
CSVFormatter
     │
     ▼
 CSV Text
```

Supports:

- Configurable separators
- Automatic escaping
- ISO date formatting
- Custom field formatting

### `toCSV`
CSV output is controlled by an attribute schema. The schema also determines the column order.

```ts
import { Attributes, toCSV } from "export-kit"

const schema: Attributes = {
  id: {},
  name: {},
  email: {}
}

const user = {
  id: 101,
  name: "John",
  email: "john@example.com"
}

const result = toCSV(user, ",", schema)

console.log(result)
```

Output:

```text
101,John,john@example.com
```

### Custom Value Formatting

Each attribute can define a `getString` function.

```ts
import { Attributes, toCSV } from "export-kit"

const schema: Attributes = {
  id: {},
  name: {},
  birthday: {
    getString: (value: Date) =>
      value.toISOString().substring(0, 10)
  }
}

const user = {
  id: 101,
  name: "John",
  birthday: new Date(2006, 8, 18)
}

const result = toCSV(user, ",", schema)

console.log(result)
```

Output:

```text
101,John,2026-08-18
```

### CSV Escaping

`escapeCSV` automatically quotes values when they contain:

* the separator
* double quotes
* carriage returns
* line breaks

Double quotes are escaped according to CSV rules.

```ts
import { escapeCSV } from "export-kit"

escapeCSV('John "Smith"', ",")
```

Result:

```text
"John ""Smith"""
```

Another example:

```ts
import { Attributes, toCSV } from "export-kit"

const schema: Attributes = {
  id: {},
  name: {},
  birthday: {
    getString: (value: Date) =>
      value.toISOString().substring(0, 10)
  }
}

const user = {
  id: 101,
  name: 'John "Smith"',
  birthday: new Date(2006, 8, 18)
}

const result = toCSV(user, ",", schema)

console.log(result)
```

Output:

```text
101,"John ""Smith""",2026-08-18
```

### `CSVFormatter`

`CSVFormatter` is useful when the same schema is used repeatedly.

```ts
import { Attributes, CSVFormatter } from "export-kit"

const schema: Attributes = {
  id: {},
  name: {}
}

const user01 = { id: 101, name: "John" }
const user02 = { id: 102, name: "Bob" }

const formatter = new CSVFormatter(schema, ",")

console.log(formatter.format(user01))
console.log(formatter.format(user02))
```

By default, each formatted record ends with `\n`.

Output:

```text
101,John
102,Bob
```

A custom record terminator can be supplied:

```ts
const schema: Attributes = {
  id: {},
  name: {}
}

const formatter = new CSVFormatter(
  schema,
  ",",
  "\r\n"
)
```

### `CSVFormatter` combines with `FileWriter`

```ts
import { Attributes, createFileWriter, CSVFormatter } from "export-kit"

const schema: Attributes = {
  id: {},
  name: {}
}

const user01 = { id: 101, name: "John" }
const user02 = { id: 102, name: "Bob" }

const formatter = new CSVFormatter(schema, ",")

const writer = createFileWriter("./output", "data.txt")

writer.write(formatter.format(user01))
writer.write(formatter.format(user02))

writer.end()
```

Output:

```
101,John
102,Bob
```

## Fixed-Length Formatting

The library can generate fixed-length records using a schema that defines the length of every field.

```text
       User
         │
         ▼
FixedLengthFormatter
         │
         ▼
 Fixed-Length Text
```

Supports:

- Configurable field widths
- Automatic padding
- Custom formatting

## `toFixedLength`

```ts
import { FixedLengthAttributes, toFixedLength } from "export-kit"

const schema: FixedLengthAttributes = {
  id: { length: 5 },
  name: { length: 10 }
}

const user = {
  id: 101,
  name: "John"
}

const result = toFixedLength(user, schema, " ")

console.log(result)
```

Output:
```
  101      John
```
Fields are left-padded using the configured padding character.

### Padding

The `pad()` utility performs left padding:

```ts
import { pad } from "export-kit"

pad("123", 5, "0")
// "00123"

pad("ABC", 6, " ")
// "   ABC"
```

When a value is longer than the requested length, it is truncated:

```ts
pad("ABCDEFG", 5, " ")
// "ABCDE"
```

Therefore, field lengths should be chosen carefully when generating files consumed by external systems.

### Custom field formatting

As with CSV formatting, attributes can provide `getString`.

```ts
import { FixedLengthAttributes, toFixedLength } from "export-kit"

const schema: FixedLengthAttributes = {
  id: {
    length: 5,
    getString: (value: number) => value.toString()
  },
  name: {
    length: 10
  },
  birthday: {
    length: 10,
    getString: (value: Date) =>
      value.toISOString().substring(0, 10)
  }
}

const user = {
  id: 101,
  name: "John",
  birthday: new Date(2006, 8, 18)
}

const result = toFixedLength(user, schema, " ")

console.log(result)
```

Output:

```
  101      John2006-08-18
```

### `FixedLengthFormatter`

For repeated formatting with the same schema:

```ts
import { FixedLengthAttributes, FixedLengthFormatter } from "export-kit"

const schema: FixedLengthAttributes = {
  id: { length: 5 },
  name: { length: 10 }
}

const user01 = { id: 101, name: "John" }
const user02 = { id: 102, name: "Bob" }

const formatter = new FixedLengthFormatter(schema)

const line1 = formatter.format(user01)
const line2 = formatter.format(user02)
```

The default padding character is a space and the default record terminator is `\n`.

Output:

```
  101      John
  102       Bob
```

Custom values can be supplied:

```ts
const schema: FixedLengthAttributes = {
  id: { length: 5 },
  name: { length: 10 }
}

const formatter = new FixedLengthFormatter(
  schema,
  "0",
  "\r\n"
)
```

### `FixedLengthFormatter` combines with `FileWriter`

```ts
import { createFileWriter, FixedLengthAttributes, FixedLengthFormatter } from "export-kit"

const schema: FixedLengthAttributes = {
  id: { length: 5 },
  name: { length: 10 }
}

const user01 = { id: 101, name: "John" }
const user02 = { id: 102, name: "Bob" }

const formatter = new FixedLengthFormatter(schema, ",")

const writer = createFileWriter("./output", "data.txt")

writer.write(formatter.format(user01))
writer.write(formatter.format(user02))

writer.end()
```

Output:

```
  101      John
  102       Bob
```

---

## Export Pipeline

The formatting and writing APIs can be combined to build streaming export pipelines.

For example:

```ts
import { Attributes, createFileWriter, CSVFormatter } from "export-kit"

const schema: Attributes = {
  id: {},
  name: {},
  email: {}
}

const formatter = new CSVFormatter(schema, ",")

const writer = createFileWriter("./output", "users.csv")

const users = [
  {
    id: 101,
    name: "John",
    email: "john@example.com"
  },
  {
    id: 102,
    name: "Bob",
    email: "bob@example.com"
  }
]

for (const user of users) {
  writer.write(formatter.format(user))
}

writer.end()
```

Output:

```
101,John,john@example.com
102,Bob,bob@example.com
```

Conceptually:

```text
Domain Objects
      │
      ▼
  Formatter
      │
      ▼
Formatted Records
      │
      ▼
    Writer
      │
      ▼
     File
```

This separation allows formatting logic to remain independent from file I/O.

---

## Date Utilities

### `dateToString`

Formats a `Date` as `YYYYMMDD` or `YYYY-MM-DD` when a separator is supplied.

```ts
import { dateToString } from "export-kit"

const date = new Date(2026, 7, 18)

console.log(dateToString(date))
// 20260818

console.log(dateToString(date, "-"))
// 2026-08-18
```

### `timeToString`

Formats a `Date` as `HHMMSS` or `HH:MM:SS`.

```ts
import { timeToString } from "export-kit"

console.log(timeToString(new Date()))
// 235901

console.log(timeToString(new Date(), ":"))
// 23:59:01
```

### `addDays`

Creates a new `Date` with the specified number of days added.

```ts
import { addDays } from "export-kit"

const tomorrow = addDays(new Date(), 1)
const previousDay = addDays(new Date(), -1)
```

### `getPrefix`

Combines a prefix with a formatted date, optionally applying a day offset.

```ts
import { getPrefix } from "export-kit"

const prefix = getPrefix("orders_", new Date())
// orders_20260818

const previous = getPrefix("orders_", new Date(), -1)
// orders_20260817
```

## Utility Functions

The following functions are exported:

```ts
getPrefix
dateToString
timeToString
addDays
mkdirSync
createWriteStream
toCSV
escapeCSV
pad
toFixedLength
toString
```

---

## API Summary

| API                    | Purpose                                    |
| ---------------------- | ------------------------------------------ |
| `createWriteStream`    | Create a writable file stream              |
| `createLogWriter`      | Create a line-oriented writer              |
| `LogWriter`            | Write strings with a suffix                |
| `FileWriter`           | Lightweight `WriteStream` wrapper          |
| `toCSV`                | Convert an object to CSV                   |
| `escapeCSV`            | Escape a CSV value                         |
| `CSVFormatter`         | Reusable CSV formatter                     |
| `pad`                  | Pad or truncate a string                   |
| `toFixedLength`        | Convert an object to a fixed-length record |
| `FixedLengthFormatter` | Reusable fixed-length formatter            |
| `dateToString`         | Format a date                              |
| `timeToString`         | Format a time                              |
| `addDays`              | Add or subtract days                       |
| `getPrefix`            | Generate date-based prefixes               |
| `toString`             | Convert a value to a string                |

---

## Ecosystem Integration

Several [**core-ts**](https://github.com/core-ts) libraries can work together.

I would characterize the ecosystem like this:
```text
                   Application
                        │
       ┌────────────────┼────────────────┐
       │                │                │
       ▼                ▼                ▼
 config-plus       logger-core      pg-exporter
                                         │
                                         ▼
                                    export-kit
                                         │
                                         ▼
                                       Files
```

or

```text
config-plus
     │
     ├── configuration
     │
logger-core
     │
     ├── logging
     │
pg-exporter
     │
     ├── PostgreSQL streaming
     │
export-kit
     │
     ├── CSV formatting
     ├── file writing
     └── logging writers
```

| Library                                                    | Purpose                           |
|------------------------------------------------------------|-----------------------------------|
| [`config-plus`](https://www.npmjs.com/package/config-plus) | Configuration merging             |
| [`logger-core`](https://www.npmjs.com/package/logger-core) | Structured logging                |
| [`pg-exporter`](https://www.npmjs.com/package/pg-exporter) | PostgreSQL Export orchestration   |
| [`export-kit`](https://www.npmjs.com/package/export-kit)   | CSV and fixed-length formatting, file writing |
| [`onecore`](https://www.npmjs.com/package/onecore)         | Shared model/schema definitions|

Each library focuses on a single responsibility.

This is a good example of **small libraries composed into an application rather than one giant framework**.

### Relationship with `pg-exporter`
```text
                pg-exporter
                     │
             PostgreSQL Stream
                     │
                     ▼
                 export-kit
                     │
                 Formatter<T>
                     │
                     ▼
          ┌──────────┴──────────┐
          │                     │
         CSV                Fixed Length
          │                     │
          └──────────┬──────────┘
                     ▼
                 File Writer
                     │
                     ▼
                   File
```
This is a **very good layering**.

`pg-exporter` shouldn't need to know how CSV or fixed-width serialization works, while `export-kit` shouldn't need to know anything about PostgreSQL.

## Examples:
- [postgres-export-sample](https://github.com/typescript-sample/postgres-export-sample): export data from Postgres to CSV.
- [mssql-export-sample](https://github.com/typescript-sample/mssql-export-sample): export data from MS SQL to CSV.
- [oracle-export-sample](https://github.com/typescript-sample/oracle-export-sample): export data from Oracle to CSV.
- [mysql-export-csv-sample](https://github.com/typescript-sample/mysql-export-csv-sample): export data from MySql to CSV.
- [mysql-export-sample](https://github.com/typescript-sample/mysql-export-sample): export data from MySql to fixed-length format file.

## License

MIT

# export-kit

A lightweight TypeScript utility library for generating CSV and fixed-length text files, writing formatted records to streams, and handling common date/time formatting tasks.

## Installation

```bash
npm install export-kit
```

## File Writing

### `createWriteStream`

Creates a writable file stream and automatically creates the target directory when necessary.

```ts
import { createWriteStream } from "export-kit"

const writer = createWriteStream("./output", "users.csv")
```

By default, files are opened in append mode with UTF-8 encoding.

```ts
export const options = {
  flags: "a",
  encoding: "utf-8"
}
```

Custom stream options can be provided:

```ts
const writer = createWriteStream(
  "./output",
  "users.csv",
  {
    flags: "w",
    encoding: "utf-8"
  }
)
```

## LogWriter

`LogWriter` writes a string and automatically appends a suffix to every record.

The default suffix is `\n`.

```ts
import { createLogWriter } from "export-kit"

const writer = createLogWriter("./output", "application.log")

writer.write("Application started")
writer.write("Processing completed")

writer.end()
```

The result is:

```text
Application started
Processing completed
```

A custom suffix can be supplied:

```ts
const writer = createLogWriter(
  "./output",
  "data.txt",
  undefined,
  "\r\n"
)
```

## FileWriter

`FileWriter` provides a small abstraction over Node.js `WriteStream`.

```ts
import { createWriteStream, FileWriter } from "export-kit"

const stream = createWriteStream("./output", "data.txt")
const writer = new FileWriter(stream)

writer.write("Hello")
writer.write(Buffer.from(" World"))

writer.end()
```

It supports:

```ts
write(chunk: string | Buffer | Uint8Array): boolean
end(cb?: () => void): void
```

---

# CSV Formatting

## `toCSV`

Convert an object into a CSV record.

```ts
import { toCSV } from "export-kit"

const user = {
  id: 1,
  name: "John",
  email: "john@example.com"
}

const attributes = {
  id: {},
  name: {},
  email: {}
}

const result = toCSV(user, ",", attributes)

console.log(result)
```

Output:

```text
1,John,john@example.com
```

The order of properties in `attributes` determines the column order.

## Custom Value Formatting

Each attribute can provide a `getString` function.

```ts
const attributes = {
  id: {},
  name: {},
  birthday: {
    getString: (value: Date) =>
      value.toISOString().substring(0, 10)
  }
}
```

This allows domain objects to remain unchanged while controlling their external representation.

## CSV Escaping

`escapeCSV` automatically quotes values when they contain:

* the separator
* double quotes
* carriage returns
* line breaks

Double quotes are escaped according to CSV rules.

```ts
import { escapeCSV } from "export-kit"

escapeCSV('John "Johnny" Smith', ",")
```

Result:

```text
"John ""Johnny"" Smith"
```

## CSVFormatter

`CSVFormatter` is useful when the same formatting configuration is used repeatedly.

```ts
import { CSVFormatter } from "export-kit"

const formatter = new CSVFormatter(
  {
    id: {},
    name: {},
    email: {}
  },
  ","
)

const line = formatter.format({
  id: 1,
  name: "John",
  email: "john@example.com"
})
```

The formatter adds a newline by default.

A custom line ending can be supplied:

```ts
const formatter = new CSVFormatter(
  attributes,
  ",",
  "\r\n"
)
```

---

# Fixed-Length Formatting

The library also supports fixed-length records, which are useful for legacy systems, batch interfaces, and other integrations that require fields at exact positions.

## `toFixedLength`

```ts
import { toFixedLength } from "export-kit"

const attributes = {
  id: {
    length: 10
  },
  name: {
    length: 20
  }
}

const result = toFixedLength(
  {
    id: 123,
    name: "John"
  },
  attributes,
  "0"
)
```

Every value is formatted to its configured length.

Values longer than the configured length are truncated.

Values shorter than the configured length are padded on the left.

## Custom Value Formatting

Fixed-length attributes also support `getString`.

```ts
const attributes = {
  id: {
    length: 10,
    getString: (value: number) =>
      value.toString()
  },
  name: {
    length: 30
  }
}
```

This is useful for formatting dates, numbers, codes, and other domain-specific values.

## FixedLengthFormatter

For reusable formatting configurations:

```ts
import { FixedLengthFormatter } from "export-kit"

const formatter = new FixedLengthFormatter(
  {
    id: {
      length: 10
    },
    name: {
      length: 30
    }
  }
)

const line = formatter.format({
  id: 123,
  name: "John"
})
```

The default padding character is a space.

A different padding character can be specified:

```ts
const formatter = new FixedLengthFormatter(
  attributes,
  "0"
)
```

A custom record terminator can also be specified:

```ts
const formatter = new FixedLengthFormatter(
  attributes,
  " ",
  "\r\n"
)
```

---

# Date and Time Utilities

## `dateToString`

Convert a `Date` to `YYYYMMDD`.

```ts
import { dateToString } from "export-kit"

dateToString(new Date())
```

Example:

```text
20260913
```

A separator can be specified:

```ts
dateToString(new Date(), "-")
```

Example:

```text
2026-09-13
```

## `timeToString`

Convert a `Date` to `HHMMSS`.

```ts
import { timeToString } from "export-kit"

timeToString(new Date())
```

Example:

```text
104830
```

With a separator:

```ts
timeToString(new Date(), ":")
```

Example:

```text
10:48:30
```

## `addDays`

Create a new `Date` with a day offset.

```ts
import { addDays } from "export-kit"

const tomorrow = addDays(new Date(), 1)
const yesterday = addDays(new Date(), -1)
```

The original `Date` is not modified.

## `getPrefix`

Generate a string containing a prefix and a formatted date.

```ts
import { getPrefix } from "export-kit"

const prefix = getPrefix("users-", new Date())
```

Example:

```text
users-20260913
```

A day offset can be specified:

```ts
const prefix = getPrefix(
  "users-",
  new Date(),
  -1
)
```

This is useful for generating date-based file names.

For example:

```ts
const filename =
  getPrefix("users-", new Date()) + ".csv"
```

Result:

```text
users-20260913.csv
```

---

# General String Conversion

`toString` converts strings directly and serializes other values with JSON.

```ts
import { toString } from "export-kit"

toString("hello")
// "hello"

toString({ id: 1, name: "John" })
// {"id":1,"name":"John"}
```

This is useful when a value may already be a string or may need a simple object representation.

## Design

The library intentionally keeps the responsibilities small:

```text
Formatting
  ├── CSV
  └── Fixed Length

Writing
  ├── FileWriter
  └── LogWriter

Date utilities
  ├── dateToString
  ├── timeToString
  ├── addDays
  └── getPrefix
```

This makes the components easy to combine with database exporters, batch processing, reporting, and other file-based integrations.

MIT

# export-kit

A lightweight TypeScript utility library for generating formatted text files, including CSV and fixed-length records.

The package provides reusable utilities for:

* Date and time formatting
* Date-based filename or prefix generation
* Directory creation and file streams
* Line-oriented file writing
* CSV generation and escaping
* Fixed-length record generation
* Custom field formatting

## Features

### Date utilities

Format dates and times using compact or separated representations:

```text
20260908
2026-09-08

153045
15:30:45
```

Generate date-based prefixes:

```text
report_20260908
```

or with an offset:

```text
report_20260907
```

### File writing

Create directories automatically and write to files using Node.js `WriteStream`.

The default stream configuration uses append mode and UTF-8 encoding.

### CSV formatting

Generate CSV records with:

* Configurable separators
* Configurable column order
* Automatic escaping of separators, quotes, and line breaks
* Custom field conversion
* Optional record terminators

### Fixed-length formatting

Generate fixed-width records with:

* Configurable field lengths
* Left padding
* Custom field conversion
* Optional record terminators

This is useful for legacy integrations, batch interfaces, and systems that require fixed-width files.

---

## Installation

```bash
npm install export-kit
```

## Usage

### Date formatting

```ts
import {
  dateToString,
  timeToString,
  getPrefix,
  addDays,
} from "export-kit"

const date = new Date(2026, 8, 8)

dateToString(date)
// "20260908"

dateToString(date, "-")
// "2026-09-08"

timeToString(date)
// "HHmmss"

timeToString(date, ":")
// "HH:mm:ss"

getPrefix("report_", date)
// "report_20260908"

getPrefix("report_", date, -1)
// "report_20260907"

const tomorrow = addDays(date, 1)
```

`dateToString()` and `timeToString()` use the local date/time represented by the `Date` object.

---

## Creating a File Stream

```ts
import { createWriteStream } from "export-kit"

const writer = createWriteStream(
  "./output",
  "data.txt",
)

writer.write("Hello\n")
writer.end()
```

The target directory is created automatically when it does not exist.

### Stream options

The default options are:

```ts
{
  flags: "a",
  encoding: "utf-8",
}
```

Additional Node.js stream options can be provided:

```ts
const writer = createWriteStream(
  "./output",
  "data.txt",
  {
    flags: "w",
    encoding: "utf-8",
  },
)
```

---

## FileWriter

`FileWriter` wraps an existing `WriteStream` and exposes a small writer interface.

```ts
import {
  FileWriter,
} from "export-kit"

const stream = createWriteStream("./output", "data.txt")

const writer = new FileWriter(stream)

writer.write("Hello\n")
writer.write("World\n")
writer.end()
```

`write()` accepts:

```ts
string | Buffer | Uint8Array
```

---

## LogWriter

`LogWriter` is a convenience wrapper for writing line-oriented text.

```ts
import { LogWriter } from "export-kit"

const writer = new LogWriter(
  "application.log",
  "./logs",
)

writer.write("Application started")
writer.write("Application completed")
writer.end()
```

By default, each call to `write()` appends a newline.

The default suffix is:

```text
\n
```

A custom suffix can be supplied:

```ts
const writer = new LogWriter(
  "data.txt",
  "./output",
  undefined,
  "\r\n",
)
```

---

# CSV

## Attribute definition

CSV columns are defined using `Attributes`.

```ts
import {
  Attributes,
  toCSV,
} from "export-kit"

const attributes: Attributes = {
  id: {},
  name: {},
  email: {},
}
```

The property order in `attributes` determines the CSV column order.

Given:

```ts
const user = {
  id: 100,
  name: "John",
  email: "john@example.com",
}
```

you can generate:

```ts
const line = toCSV(
  user,
  ",",
  attributes,
)
```

Result:

```text
100,John,john@example.com
```

---

## Custom field formatting

Use `getString` when a value requires custom serialization.

```ts
const attributes: Attributes = {
  id: {},
  name: {},
  createdAt: {
    getString: (value) =>
      value.toISOString(),
  },
}
```

This is useful for formatting:

* Dates
* Enums
* Boolean values
* Numbers
* Application-specific representations
* Complex values

---

## CSV escaping

String values are automatically escaped when they contain:

* The configured separator
* A double quote
* A carriage return
* A line feed

For example:

```ts
const attributes: Attributes = {
  name: {},
}

toCSV(
  { name: 'John, "Smith"' },
  ",",
  attributes,
)
```

produces:

```text
"John, ""Smith"""
```

The `escapeCSV()` function can also be used directly:

```ts
import { escapeCSV } from "export-kit"

escapeCSV("John, Smith", ",")
// "\"John, Smith\""
```

---

## CSV record terminator

A record terminator can be supplied as the fourth argument:

```ts
const line = toCSV(
  user,
  ",",
  attributes,
  "\r\n",
)
```

Without an `end` value, the returned string does not contain a line terminator.

---

## CSVFormatter

`CSVFormatter<T>` packages the CSV configuration into a reusable formatter.

```ts
import {
  CSVFormatter,
} from "export-kit"

const formatter = new CSVFormatter(
  attributes,
  ",",
)

const line = formatter.format(user)
```

The default record terminator is:

```text
\n
```

A custom terminator can be supplied:

```ts
const formatter = new CSVFormatter(
  attributes,
  ",",
  "\r\n",
)
```

---

# Fixed-Length Records

Fixed-length formatting produces records where every field occupies a predefined number of characters.

## Attribute definition

```ts
import {
  FixedLengthAttributes,
  toFixedLength,
} from "export-kit"

const attributes: FixedLengthAttributes = {
  id: {
    length: 5,
  },
  name: {
    length: 20,
  },
  status: {
    length: 1,
  },
}
```

Generate a record:

```ts
const line = toFixedLength(
  {
    id: 123,
    name: "John",
    status: "A",
  },
  attributes,
  "0",
)
```

Each field is padded on the left.

---

## Padding

The `pad()` utility performs left padding:

```ts
import { pad } from "export-kit"

pad("123", 5, "0")
// "00123"

pad("ABC", 6, " ")
// "   ABC"
```

When a value is longer than the requested length, it is truncated:

```ts
pad("ABCDEFG", 5, " ")
// "ABCDE"
```

Therefore, field lengths should be chosen carefully when generating files consumed by external systems.

---

## Custom field formatting

Fixed-length attributes also support `getString`:

```ts
const attributes: FixedLengthAttributes = {
  amount: {
    length: 12,
    getString: (value) =>
      Math.round(value * 100).toString(),
  },
}
```

This allows application-specific representations before padding is applied.

For example:

```text
000000001250
```

---

## Record terminator

A terminator can be supplied:

```ts
const line = toFixedLength(
  data,
  attributes,
  " ",
  "\r\n",
)
```

When using `toFixedLength()` directly, the terminator is appended after all fields.

---

## FixedLengthFormatter

For repeated formatting, use `FixedLengthFormatter<T>`:

```ts
import {
  FixedLengthFormatter,
} from "export-kit"

const formatter = new FixedLengthFormatter(
  attributes,
  "0",
  "\r\n",
)

const line = formatter.format(data)
```

Defaults:

```text
Padding: " "
End:     "\n"
```

---

# Generic String Conversion

The `toString()` utility preserves strings and serializes other values as JSON.

```ts
import { toString } from "export-kit"

toString("hello")
// "hello"

toString({ id: 1 })
// "{\"id\":1}"

toString([1, 2, 3])
// "[1,2,3]"
```

This can be useful when a value needs a simple textual representation while preserving structured values as JSON.

---

# API Overview

| API                    | Purpose                                               |
| ---------------------- | ----------------------------------------------------- |
| `getPrefix()`          | Create a prefix containing a formatted date           |
| `dateToString()`       | Format a `Date` as a date string                      |
| `timeToString()`       | Format a `Date` as a time string                      |
| `addDays()`            | Add calendar days without modifying the original date |
| `mkdirSync()`          | Create a directory recursively                        |
| `createWriteStream()`  | Create a file write stream                            |
| `FileWriter`           | Wrap an existing `WriteStream`                        |
| `LogWriter`            | Write text with an automatic suffix                   |
| `toCSV()`              | Convert an object into a CSV record                   |
| `escapeCSV()`          | Escape a CSV string                                   |
| `CSVFormatter`         | Reusable CSV formatter                                |
| `pad()`                | Left-pad or truncate a string                         |
| `toFixedLength()`      | Convert an object into a fixed-length record          |
| `FixedLengthFormatter` | Reusable fixed-length formatter                       |
| `toString()`           | Convert a value to a string or JSON                   |

---

# Design

The formatting APIs intentionally separate **data definition** from **serialization**.

For example:

```ts
const attributes: Attributes = {
  id: {},
  name: {},
  createdAt: {
    getString: (value) =>
      value.toISOString(),
  },
}
```

The formatter is then responsible only for:

1. Reading fields in the configured order
2. Converting values
3. Applying the required format
4. Returning the resulting string

This makes the same formatter reusable across file writers, batch jobs, exports, and other output pipelines.

The same design is used by both CSV and fixed-length formatting:

```text
              Object
                │
                ▼
        Attribute Definition
                │
       ┌────────┴────────┐
       ▼                 ▼
      CSV          Fixed-Length
       │                 │
       ▼                 ▼
    String Record     String Record
```

---

# TypeScript

The package is designed for TypeScript and supports generic formatters:

```ts
interface User {
  id: number
  name: string
  createdAt: Date
}

const formatter = new CSVFormatter<User>(
  attributes,
  ",",
)
```

`getString` provides an escape hatch when the default conversion rules are not sufficient.

---

# Use Cases

This library is particularly suitable for:

* CSV exports
* Batch file generation
* Fixed-width integrations
* Legacy system interfaces
* Scheduled data exports
* Application logs
* Report generation
* ETL output
* Data exchange between backend systems

---

# License

MIT

# export-kit

---

# Features



---

# Why export-kit?

Many Node.js libraries can write files.

Many libraries can generate CSV.

Few libraries provide a reusable **export framework**.

`export-kit` separates **how data is formatted** from **how data is written**, making export logic reusable across applications.

```text
             Business Object
                   │
       ┌───────────┴───────────┐
       │                       │
       ▼                       ▼
CSV Formatter         Fixed Length Formatter
       │                       │
       │                       │
   CSV text             fixed-width text
       └───────────┬───────────┘
                   │
                   ▼
               File Writer
                   │             
                   ▼
                  File
```

This separation allows the same business object to be exported into different formats without changing business logic.

---

# Supported Export Formats

## CSV

```text
   User
     │
     ▼
CSVFormatter
     │
     ▼
 CSV Text
```

Supports:

- Configurable separators
- Automatic escaping
- ISO date formatting
- Custom field formatting

```ts
import { CSVFormatter } from "export-kit"

const formatter = new CSVFormatter(customerModel, ",")

writer.write(formatter.format(customer))
```

Generated output

```text
1,john,john@example.com
```

---

## Fixed-Length Records

```text
       User
         │
         ▼
FixedLengthFormatter
         │
         ▼
 Fixed-Length Text
```

Supports:

- Configurable field widths
- Automatic padding
- Custom formatting

```ts
import { FixedLengthFormatter } from "export-kit"

const formatter = new FixedLengthFormatter(customerModel)

writer.write(formatter.format(customer))
```

Generated output

```text
          4christiana            louie85@example.org
```

Suitable for:

- Banking
- Government systems
- Legacy integrations
- Batch interfaces

---

# Schema-Driven Formatting

Instead of manually building CSV strings, define a schema describing how each field should be exported.

```typescript
const attributes = {
  id: {},
  name: {},
  birthday: {},
  salary: {
    getString: value => `$${value}`
  }
}
```

The formatter automatically converts each object according to the schema.

Benefits include:

- Reusable export definitions
- Centralized formatting rules
- Consistent exports
- Easier maintenance

---

# Custom Field Formatting

Each attribute may define its own formatter.

```text
Database Value

      1000
        │
        ▼
   getString()
        │
        ▼
     "$1000"
```

This makes it easy to customize:

- Currency
- Dates
- Enums
- Booleans
- Identifiers

without changing export logic.

---

# CSV Escaping

CSV fields are automatically escaped when necessary.

Supports values containing:

- Separators
- Quotation marks
- Carriage returns
- Newlines

This ensures generated CSV files remain compatible with standard spreadsheet applications.

---

# File Writing

`export-kit` provides lightweight file writing utilities suitable for batch processing.

```text
Formatter
    │
    ▼
FileWriter
    │
    ▼
  Disk
```

---

### Generate Batch File Names

```ts
import { getPrefix, timeToString } from "export-kit"

const now = new Date()

const filename = getPrefix("customer_", now) + "_" + timeToString(now) + ".csv"
```

Example

```text
customer_20260716_143010.csv
```

### Write Files

```ts
import { createWriteStream, FileWriter } from "export-kit"

const stream = createWriteStream("./output", "customers.csv")

const writer = new FileWriter(stream)

writer.write("Hello")
writer.end()
```

For logging scenarios, `LogWriter` provides buffered writing with configurable line endings.

---

# Streaming Support

Large exports can be written incrementally instead of generating the entire file in memory.

```text
  Object
     │
     ▼
 Formatter
     │
     ▼
Write Stream
     │
     ▼
    File
```

This approach is suitable for exporting millions of records while keeping memory usage low.

---

# Utility Functions

The library also includes small helpers commonly used in export jobs:

- Date formatting
- Time formatting
- Date arithmetic
- Directory creation

These utilities support typical batch-processing workflows without introducing additional dependencies.

---

# Typical Use Cases

- Scheduled data exports
- CSV report generation
- Banking files
- Payroll exports
- Legacy system integration
- ETL pipelines
- Data migration
- Batch processing
- Regulatory reporting
- Enterprise data exchange

---

# Design Principles

`export-kit` is built around a few simple principles:

- Single responsibility
- Schema-driven formatting
- Small, composable APIs
- Reusable export definitions
- Minimal dependencies
- Production-ready performance
- Type-safe interfaces

---

# When to Use export-kit

Choose `export-kit` when you need to:

- Export business objects to CSV
- Generate fixed-length files
- Build reusable export pipelines
- Process large datasets efficiently
- Centralize export rules

If you need a lightweight, focused library for object-to-file export, `export-kit` provides the essential building blocks without requiring a full ETL framework.

# License

MIT

