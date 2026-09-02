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
New version:

A lightweight TypeScript utility library for file writing, date/time formatting, CSV serialization, and fixed-length record generation.

The library provides both functional APIs and reusable formatter classes, making it suitable for batch exports, logging, file generation, and integration with systems that require CSV or fixed-width records.

## Features

* Recursive directory creation
* File and log stream writers
* Custom value conversion through `getString`
* Configurable CSV serialization
* Fixed-length record serialization
* Reusable CSV and fixed-length formatter classes
* Date formatting with optional separators
* Time formatting with optional separators
* Date arithmetic with `addDays`
* Minimal dependencies and lightweight implementation

old:
- Date/time formatting
- Filename prefix generation
- File writing
- CSV schema-based serialization
- Fixed-length serialization
- Custom value conversion through `getString`
- Formatting classes implementing a common `format()` shape
- Zero runtime dependencies

### Examples:
- [postgres-export-sample](https://github.com/typescript-sample/postgres-export-sample): export data from Postgres to CSV.
- [mssql-export-sample](https://github.com/typescript-sample/mssql-export-sample): export data from MS SQL to CSV.
- [oracle-export-sample](https://github.com/typescript-sample/oracle-export-sample): export data from Oracle to CSV.
- [mysql-export-csv-sample](https://github.com/typescript-sample/mysql-export-csv-sample): export data from MySql to CSV.
- [mysql-export-sample](https://github.com/typescript-sample/mysql-export-sample): export data from MySql to fixed-length format file.

## Installation

```bash
npm install export-kit
```

or

```bash
yarn add export-kit
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
                    Attributes
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
   CSVFormatter                FixedLengthFormatter
         │                               │
         └───────────────┬───────────────┘
                         │
   Formatted String (to CSV or fixed-length format)
                         │
                 Stream File Writer 
                         │
                         ▼
                    Output File
```

The formatter is responsible only for converting objects into text.

The writer is responsible only for writing text.

This separation keeps export logic independent from file I/O.

## CSV Formatting

CSV output is controlled by an attribute schema. The schema also determines the column order.

```ts
import { Attributes, toCSV } from "export-kit"

const schema: Attributes = {
  id: {},
  name: {},
  active: {}
}

const value = {
  id: 1001,
  name: "John",
  active: true
}

const csv = toCSV(value, ",", schema)

console.log(csv)
// 1001,John,true
```

Generated output

```text
1001,John,true
```

### Custom Value Conversion

Each attribute can define a `getString` function.

```ts
import { Attributes, dateToString, toCSV } from "export-kit"

const schema: Attributes = {
  id: {},
  name: {},
  createdAt: {
    getString: (value: Date) => dateToString(value, "-")
  }
}

const value = {
  id: 1001,
  name: "John",
  createdAt: new Date(2026, 7, 18)
}

const csv = toCSV(value, ",", schema)

console.log(csv)
// 1001,John,2026-08-18
```

Generated output

```text
1001,John,2026-08-18
```

### CSV Escaping

String values are automatically escaped when they contain:

* The configured separator
* A double quote
* A carriage return
* A newline

For example:

```ts
const schema: Attributes = {
  name: {}
}

const value = {
  name: 'John "Smith"'
}

console.log(toCSV(value, ",", schema))
// "John ""Smith"""
```

Generated output

```text
"John ""Smith"""
```

### `CSVFormatter`

`CSVFormatter` is useful when the same schema is used repeatedly.

```ts
import { Attributes, CSVFormatter } from "export-kit"

const schema: Attributes = {
  id: {},
  name: {}
}

const formatter = new CSVFormatter(schema, ",")

console.log(formatter.format({
  id: 1,
  name: "Alice"
}))

console.log(formatter.format({
  id: 2,
  name: "Bob"
}))
```

By default, each formatted record ends with `\n`.

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

## Fixed-Length Records

The library can generate fixed-length records using a schema that defines the length of every field.

```ts
import { FixedLengthAttributes, toFixedLength } from "export-kit"

const schema: FixedLengthAttributes = {
  id: {
    length: 5
  },
  name: {
    length: 10
  }
}

const value = {
  id: "123",
  name: "Alice"
}

const result = toFixedLength(
  value,
  schema,
  " "
)

console.log(result)
// "  123     Alice"
```

Fields are left-padded using the configured padding character.

### Custom Conversion

As with CSV formatting, attributes can provide `getString`.

```ts
const schema: FixedLengthAttributes = {
  id: {
    length: 8,
    getString: (value: number) => value.toString()
  },
  name: {
    length: 20
  }
}
```

### `FixedLengthFormatter`

For repeated formatting with the same schema:

```ts
import { FixedLengthAttributes, FixedLengthFormatter } from "export-kit"

const schema: FixedLengthAttributes = {
  id: { length: 8 },
  name: { length: 20 }
}

const formatter = new FixedLengthFormatter(schema)

const record = formatter.format({
  id: 123,
  name: "Alice"
})
```

The default padding character is a space and the default record terminator is `\n`.

Custom values can be supplied:

```ts
const schema: FixedLengthAttributes = {
  id: { length: 8 },
  name: { length: 20 }
}

const formatter = new FixedLengthFormatter(
  schema,
  "0",
  "\r\n"
)
```

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

Custom stream options can be provided.

### `FileWriter`

`FileWriter` is a small wrapper around a `WriteStream`.

```ts
import { FileWriter, createWriteStream } from "export-kit"

const writer = new FileWriter(
  createWriteStream("./output", "data.txt")
)

writer.write("hello\n")
writer.end()
```

### `LogWriter`

`LogWriter` appends a configurable suffix to every write. The default suffix is a newline.

```ts
import { LogWriter } from "export-kit"

const writer = new LogWriter("application.log", "./logs")

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
const writer = new LogWriter(
  "data.txt",
  "./output",
  undefined,
  "|"
)

writer.write("one")
writer.write("two")
```

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

## License

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
