import * as fs from "fs"
import { WriteStream } from "fs"
import * as promises from "node:fs/promises"
import path from "node:path"

// tslint:disable-next-line:class-name
export class resources {
  static escape = '""'
}

export interface Attribute {
  getString?: (v: any) => string
  length?: number
}
export interface FixedLengthAttribute {
  getString?: (v: any) => string
  length: number
}
export interface Attributes {
  [key: string]: Attribute
}
export interface FixedLengthAttributes {
  [key: string]: FixedLengthAttribute
}

export interface StreamOptions {
  flags?: string | undefined
  encoding?: BufferEncoding | undefined
  fd?: number | promises.FileHandle | undefined
  mode?: number | undefined
  autoClose?: boolean | undefined
  /**
   * @default false
   */
  emitClose?: boolean | undefined
  start?: number | undefined
  highWaterMark?: number | undefined
}
export const options: StreamOptions = { flags: "a", encoding: "utf-8" }
export function createWriteStream(dir: string, filename: string, opts?: BufferEncoding | StreamOptions): WriteStream {
  const o = opts ? opts : options
  fs.mkdirSync(dir, { recursive: true })
  return fs.createWriteStream(path.join(dir, filename), o)
}
export function createLogWriter(dir: string, filename: string, opts?: BufferEncoding | StreamOptions, suffix?: string): LogWriter {
  return new LogWriter(createWriteStream(dir, filename, opts), suffix)
}
// tslint:disable-next-line:max-classes-per-file
export class LogWriter {
  protected suffix: string
  constructor(
    protected writer: WriteStream,
    suffix?: string,
  ) {
    this.suffix = suffix ? suffix : "\n"
    this.write = this.write.bind(this)
    this.end = this.end.bind(this)
  }
  write(data: string): boolean {
    return this.writer.write(data + this.suffix)
  }
  end(cb?: () => void): void {
    this.writer.end(cb)
  }
}
export function createFileWriter(dir: string, filename: string, opts?: BufferEncoding | StreamOptions): FileWriter {
  return new FileWriter(createWriteStream(dir, filename, opts))
}
// tslint:disable-next-line:max-classes-per-file
export class FileWriter {
  constructor(protected writer: WriteStream) {
    this.write = this.write.bind(this)
    this.end = this.end.bind(this)
  }
  write(chunk: string | Buffer | Uint8Array): boolean {
    return this.writer.write(chunk)
  }
  end(cb?: () => void): void {
    this.writer.end(cb)
  }
}

const e = ""
const s = "string"
const n = "number"
export function toCSV<T>(obj: T, separator: string, attrs: Attributes, end?: string): string {
  const o: any = obj
  const keys = Object.keys(attrs)
  const cols: string[] = []
  // tslint:disable-next-line:prefer-for-of
  for (let i = 0; i < keys.length; i++) {
    const name = keys[i]
    const v = o[name]
    const attr = attrs[name]
    if (v == null) {
      cols.push(e)
    } else {
      if (attr.getString) {
        const v2 = attr.getString(v)
        cols.push(v2)
      } else {
        if (typeof v === s) {
          cols.push(escapeCSV(v, separator))
        } else if (typeof v === n) {
          cols.push(v.toString())
        } else if (v instanceof Date) {
          cols.push(v.toISOString())
        } else {
          cols.push("" + v)
        }
      }
    }
  }
  const ss = cols.join(separator)
  if (end && end.length > 0) {
    return ss + end
  } else {
    return ss
  }
}
export function escapeCSV(v: string, separator: string): string {
  const needsQuote = v.includes(separator) || v.includes('"') || v.includes("\r") || v.includes("\n")

  if (!needsQuote) return v

  return `"${v.replace(/"/g, resources.escape)}"`
}
// tslint:disable-next-line:max-classes-per-file
export class CSVFormatter<T> {
  constructor(
    protected attributes: Attributes,
    protected separator: string,
    end?: string,
  ) {
    this.end = end && end.length > 0 ? end : "\n"
    this.format = this.format.bind(this)
  }
  end: string
  format(v: T): string {
    return toCSV<T>(v, this.separator, this.attributes, this.end)
  }
}
export function pad(v: string, l: number, p: string): string {
  if (v.length > l) {
    return v.substring(0, l)
  } else {
    const c = l - v.length
    const a: string[] = []
    for (let i = 0; i < c; i++) {
      a.push(p)
    }
    return a.join("") + v
  }
}
export function toFixedLength<T>(obj: T, attrs: FixedLengthAttributes, p: string, end?: string): string {
  const o: any = obj
  const keys = Object.keys(attrs)
  const cols: string[] = []
  // tslint:disable-next-line:prefer-for-of
  for (let i = 0; i < keys.length; i++) {
    const name = keys[i]
    const v = o[name]
    const attr = attrs[name]
    let v2 = ""
    if (v != null) {
      if (attr.getString) {
        v2 = attr.getString(v)
      } else {
        if (typeof v === s) {
          v2 = v
        } else if (typeof v === n) {
          v2 = v.toString()
        } else if (v instanceof Date) {
          v2 = v.toISOString()
        } else {
          v2 = "" + v
        }
      }
    }
    cols.push(pad(v2, attr.length, p))
  }
  if (end && end.length > 0) {
    cols.push(end)
  }
  return cols.join("")
}
// tslint:disable-next-line:max-classes-per-file
export class FixedLengthFormatter<T> {
  constructor(
    protected attributes: FixedLengthAttributes,
    p?: string,
    end?: string,
  ) {
    this.end = end && end.length > 0 ? end : "\n"
    this.pad = p && p.length > 0 ? p : " "
    this.format = this.format.bind(this)
  }
  end: string
  pad: string
  format(v: T): string {
    return toFixedLength<T>(v, this.attributes, this.pad, this.end)
  }
}

export function getPrefix(v: string, date: Date, offset?: number, separator?: string): string {
  if (offset !== undefined) {
    const d = addDays(date, offset)
    return v + dateToString(d, separator)
  } else {
    return v + dateToString(date, separator)
  }
}
export function dateToString(date: Date, separator?: string): string {
  const year = date.getFullYear()
  let month: number | string = date.getMonth() + 1
  let dt: number | string = date.getDate()

  if (dt < 10) {
    dt = "0" + dt.toString()
  }
  if (month < 10) {
    month = "0" + month
  }
  if (separator !== undefined) {
    return "" + year + separator + month + separator + dt
  } else {
    return "" + year + month + dt
  }
}
export function timeToString(date: Date, separator?: string): string {
  let hh: number | string = date.getHours()
  let mm: number | string = date.getMinutes()
  let ss: number | string = date.getSeconds()
  if (hh < 10) {
    hh = "0" + hh.toString()
  }
  if (ss < 10) {
    ss = "0" + ss.toString()
  }
  if (mm < 10) {
    mm = "0" + mm
  }
  if (separator !== undefined) {
    return "" + hh + separator + mm + separator + ss
  } else {
    return "" + hh + mm + ss
  }
}
export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function toString(v: any): string {
  if (typeof v === "string") {
    return v
  } else {
    return JSON.stringify(v)
  }
}
