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

---

## API Summary

| API                    | Purpose                                    |
| ---------------------- | ------------------------------------------ |
| `LogWriter`            | Write strings with a suffix                |
| `FileWriter`           | Lightweight `WriteStream` wrapper          |
| `toCSV`                | Convert an object to CSV                   |
| `CSVFormatter`         | Reusable CSV formatter                     |
| `toFixedLength`        | Convert an object to a fixed-length record |
| `FixedLengthFormatter` | Reusable fixed-length formatter            |
| `dateToString`         | Format a date                              |
| `timeToString`         | Format a time                              |

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
