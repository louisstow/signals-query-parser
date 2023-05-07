import { BaseTokenStream } from "../BaseTokenStream";
import type { InputStream } from "../InputStream";

const PIPE = "|";
const QUOTE = '"';
const OPEN_PAREN = "(";
const CLOSE_PAREN = ")";
const COMMA = ",";

const isNumeric = (c: string) => /^[0-9\.\-]+$/.test(c);
const isSep = (c: string) =>
  c === PIPE || c === OPEN_PAREN || c === CLOSE_PAREN || c === COMMA;
const isText = (c: string) => !isNumeric(c);
const isWhitespace = (c: string) =>
  c === " " || c === "\t" || c === "\n" || c === "\r";
const isIdent = (c: string) => !isWhitespace(c) && !isSep(c);

class TokenStream extends BaseTokenStream {
  constructor(input: InputStream) {
    super(input);
  }

  readString(expectClosingQuote = true) {
    return {
      pos: this.istream.pos,
      type: "string",
      value: this.readEscapedString({ expectClosingQuote }),
    };
  }

  readNumber() {
    return {
      pos: this.istream.pos,
      type: "number",
      value: this.readWhile(isNumeric),
    };
  }

  readIdent() {
    return {
      pos: this.istream.pos,
      type: "ident",
      value: this.readWhile(isIdent),
    };
  }

  readNext() {
    this.readWhile(isWhitespace);

    if (this.istream.eof()) {
      return null;
    }

    const c = this.istream.peek();

    if (c === PIPE) {
      this.istream.next();
      return {
        type: "pipe",
        value: c,
        pos: this.istream.pos - 1,
      };
    }

    if (c === OPEN_PAREN) {
      this.istream.next();
      return {
        type: "openParen",
        value: c,
        pos: this.istream.pos - 1,
      };
    }

    if (c === CLOSE_PAREN) {
      this.istream.next();
      return {
        type: "closeParen",
        value: c,
        pos: this.istream.pos - 1,
      };
    }

    if (c === COMMA) {
      this.istream.next();
      return {
        type: "comma",
        value: c,
        pos: this.istream.pos - 1,
      };
    }

    if (c === QUOTE) {
      this.istream.next();
      return this.readString(true);
    }

    // if (isNumeric(c)) {
    //   return this.readNumber();
    // }

    if (isIdent(c)) {
      return this.readIdent();
    }

    throw new Error(
      `Unable to parse query character: ${c} at ${this.istream.pos}`
    );
  }
}

/**
 * RangeQuery: severity < 2 > 3
 * InQuery: collectors in ("12")
 * MatchQuery: description match "my string"
 * ExactQuery: id = "CVE-2020-123"
 * SoftwareQuery: software in ("Adobe Acrobat" gt 1.3)
 * CanonicalQuery: software in @software_list
 * CanonicalQuery: software = @software_list
 * SoftwareQuery: software = "Adobe Acrobat"
 */

export { TokenStream };
