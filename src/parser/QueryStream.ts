import type { TokenStream } from "./TokenStream";
import type { Token } from "../BaseTokenStream";

const isPipe = (t: Token | null) => t?.type === "pipe";
const isComma = (t: Token | null) => t?.type === "comma";
const isCloseParen = (t: Token | null) => t?.type === "closeParen";
const isOpenParen = (t: Token | null) => t?.type === "openParen";
const isSep = (t: Token | null) => isPipe(t) || isComma(t) || isCloseParen(t);
const isIdent = (t: Token | null): t is Token => t?.type === "ident";
const isText = (t: Token | null): t is Token =>
  t?.type === "string" || t?.type === "ident";
const isOperator = (t: Token | null): t is Token => t?.type === "operator";

const isIdentNoGuard = (t: Token | null) => t?.type === "ident";
const isTextNoGuard = (t: Token | null) =>
  t?.type === "string" || t?.type === "ident";

const getValidOp = (s: string) => {
  switch (s.toLowerCase()) {
    case "gt":
    case ">":
      return "gt";
    case "gte":
    case ">=":
      return "gte";
    case "lt":
    case "<":
      return "lt";
    case "lte":
    case "<=":
      return "lte";
    case "eq":
    case "=":
    case "==":
      return "eq";
  }

  return null;
};

const isValidMatchOp = (s: string) => {
  switch (s.toLowerCase()) {
    case "match":
    case "like":
    case "~":
      return true;
  }

  return false;
};

const isValidEqualOp = (s: string) => {
  switch (s.toLowerCase()) {
    case "=":
    case "eq":
    case "is":
    case "in":
      return true;
  }

  return false;
};

class ParserError extends Error {
  name = "ParserError";
  columnNumber: number;
  example: string;

  constructor(message: string, columnNumber: number, example: string) {
    super(message);
    this.columnNumber = columnNumber;
    this.example = example;
  }
}

class QueryStream {
  tstream: TokenStream;
  validFields: string[];

  constructor(tstream: TokenStream, validFields: string[]) {
    this.tstream = tstream;
    this.validFields = validFields;
  }

  createParserError(message: string, columnNumber?: number) {
    const input = this.tstream.istream.input;
    const pos =
      columnNumber ?? this.tstream.current?.pos ?? this.tstream.istream.pos;

    const start = Math.max(0, pos - 20);
    const end = Math.min(input.length, pos + 20);
    const offset = pos - start;

    const example = [input.slice(start, end), " ".repeat(offset) + "^"].join(
      "\n"
    );

    return new ParserError(message, pos, example);
  }

  readWhile(predicate: (t: Token) => boolean) {
    const values = [];
    let peek: Token | null = null;

    while (
      !this.tstream.eof() &&
      (peek = this.tstream.peek()) &&
      predicate(peek)
    ) {
      const t = this.tstream.next();
      if (t) {
        values.push(t);
      }
    }

    return values;
  }

  readSoftwareVersion() {
    let versions: Array<{ op: string; value: string }> = [];
    let peek: Token | null;

    while (
      !this.tstream.eof() &&
      (peek = this.tstream.peek()) &&
      !isComma(peek) &&
      !isCloseParen(peek)
    ) {
      const opToken = this.tstream.next();
      if (!opToken) {
        break;
      }

      const valueToken = this.tstream.next();

      if (!isTextNoGuard(valueToken)) {
        throw this.createParserError(`Expected version`, valueToken?.pos);
      }

      if (isText(valueToken)) {
        const op = getValidOp(opToken.value);
        if (!op) {
          throw this.createParserError(
            `Invalid version operator '${opToken.value}'`,
            opToken.pos
          );
        }

        versions.push({
          op,
          value: valueToken.value,
        });
      }
    }

    return versions;
  }

  readSoftwareInValue() {
    const softwareToken = this.tstream.next();
    const name = isText(softwareToken) ? softwareToken.value : null;

    if (!name) {
      throw this.createParserError(
        `Expected software name`,
        softwareToken?.pos
      );
    }

    const peek = this.tstream.peek();
    const version = peek && !isSep(peek) ? this.readSoftwareVersion() : [];

    return {
      name,
      version,
    };
  }

  readSoftwareIn() {
    const software = [];
    let peek: Token | null;

    while (
      !this.tstream.eof() &&
      (peek = this.tstream.peek()) &&
      !isCloseParen(peek) &&
      !isPipe(peek)
    ) {
      this.readWhile(isComma);

      const s = this.readSoftwareInValue();
      if (s) {
        software.push(s);
      }
    }

    return software;
  }

  readSoftwareQuery() {
    const fn = this.tstream.next();

    if (!isText(fn) && !isOperator(fn)) {
      throw this.createParserError(`Unexpected operator`);
    }

    const op = fn.value.toLowerCase();
    if (!isValidEqualOp(op) && !isValidMatchOp(op)) {
      throw this.createParserError(`Unexpected operator '${fn.value}'`, fn.pos);
    }

    const fuzzy = isValidMatchOp(op);

    let hasOpenParen = false;

    if (isOpenParen(this.tstream.peek())) {
      this.tstream.next();
      hasOpenParen = true;
    }

    if (isText(this.tstream.peek())) {
      // check software query by starting with @
      const token = this.tstream.peek();

      if (isIdent(token) && token.value.startsWith("@")) {
        this.tstream.next();

        return {
          type: "software",
          value: {
            software: [],
            softwareList: token.value,
            fuzzy,
          },
        };
      }

      const software = this.readSoftwareIn();
      if (isCloseParen(this.tstream.peek())) {
        this.tstream.next();
      } else if (hasOpenParen) {
        throw this.createParserError(`Expected closing parenthesis`);
      }

      return {
        type: "software",
        value: {
          software,
          fuzzy,
        },
      };
    }

    throw this.createParserError(`Expected software query`);
  }

  readValue(field: string, type: string) {
    const valueToken = this.tstream.next();

    if (!isTextNoGuard(valueToken)) {
      throw this.createParserError(
        `Unexpected value for field '${field}'`,
        valueToken?.pos
      );
    }

    if (isText(valueToken)) {
      return {
        type,
        value: {
          field,
          query: valueToken.value,
        },
      };
    }
  }

  readIn(field: string, negated?: boolean) {
    const query: string[] = [];
    let peek: Token | null;
    let hasOpenParen = false;

    while (
      !this.tstream.eof() &&
      (peek = this.tstream.peek()) &&
      !isCloseParen(peek) &&
      !isPipe(peek)
    ) {
      this.readWhile(isComma);

      const t = this.tstream.next();

      if (isOpenParen(t)) {
        hasOpenParen = true;
      }

      if (isText(t)) {
        query.push(t.value);
      }
    }

    if (isCloseParen(this.tstream.peek())) {
      this.tstream.next();
    } else if (hasOpenParen) {
      throw this.createParserError(`Expected closing parenthesis`);
    }

    return {
      type: "in",
      value: {
        field,
        query,
        negated: negated ? true : undefined,
      },
    };
  }

  readRange(field: string, op: string) {
    const query: { [k: string]: number } = {};
    let peek: Token | null;

    const firstValue = this.tstream.next();

    if (!isIdentNoGuard(firstValue)) {
      throw this.createParserError(
        `Expected a number for field '${field}'`,
        firstValue?.pos
      );
    }

    if (isIdent(firstValue)) {
      query[op] = Number(firstValue.value);

      if (isNaN(query[op])) {
        throw this.createParserError(
          `Not a number '${firstValue.value}'`,
          firstValue.pos
        );
      }
    }

    while (
      !this.tstream.eof() &&
      (peek = this.tstream.peek()) &&
      !isPipe(peek)
    ) {
      const t = this.tstream.next();
      const validOp = (isText(t) || isOperator(t)) && getValidOp(t.value);

      if (validOp) {
        const v = this.tstream.next();

        if (!isIdentNoGuard(v)) {
          throw this.createParserError(
            `Expected a number for field '${field}'`,
            v?.pos
          );
        }

        if (isIdent(v)) {
          query[validOp] = Number(v.value);

          if (isNaN(query[validOp])) {
            throw this.createParserError(
              `Not a number '${v.value}' for field '${field}'`,
              v.pos
            );
          }
        }
      }
    }

    return {
      type: "range",
      value: {
        field,
        query,
      },
    };
  }

  readFilter() {
    const filter = this.tstream.next();
    if (!filter) {
      return null;
    }

    return {
      type: "filter",
      value: {
        filter: filter.value,
      },
    };
  }

  readGroup() {
    const group = this.tstream.next();
    if (!group) {
      return null;
    }

    return {
      type: "group",
      value: {
        field: group.value,
      },
    };
  }

  readNegated() {
    const token = this.tstream.peek();
    if (isIdent(token) && token.value == "not") {
      this.tstream.next();
      return true;
    }

    return false;
  }

  readQuery() {
    const field = this.tstream.next();

    if (!field) {
      return null;
    }

    if (field.type === "ident" && field.value === "filter") {
      return this.readFilter();
    }

    if (field.type === "ident" && field.value === "group") {
      return this.readGroup();
    }

    if (field.type === "ident" && field.value === "software") {
      return this.readSoftwareQuery();
    }

    if (!this.validFields.includes(field.value)) {
      throw this.createParserError(`Invalid field '${field.value}'`, field.pos);
    }

    const negated = this.readNegated();
    const fn = this.tstream.next();

    if (isIdent(fn) || isOperator(fn)) {
      if (fn.value.toLowerCase() === "in") {
        return this.readIn(field.value, negated);
      }

      if (isValidMatchOp(fn.value)) {
        return this.readValue(field.value, "match");
      }

      if (isValidEqualOp(fn.value)) {
        return this.readValue(field.value, "exact");
      }

      const op = getValidOp(fn.value);
      if (op !== null) {
        return this.readRange(field.value, op);
      } else {
        throw this.createParserError(`Invalid operator '${fn.value}'`, fn.pos);
      }
    }
  }

  parseToken() {
    this.readWhile(isPipe);

    if (this.tstream.eof()) {
      return null;
    }

    const token = this.tstream.peek();
    if (!token) {
      return null;
    }

    if (token.type === "ident") {
      return this.readQuery();
    }

    if (token.type === "string") {
      this.tstream.next();
      return {
        type: "match",
        value: {
          field: "aggregate",
          query: token.value,
        },
      };
    }

    throw new Error(`Unexpected token: ${token.type} ${token.value}`);
  }

  parse() {
    const q: any[] = [];
    while (!this.tstream.eof()) {
      try {
        const queryItem = this.parseToken();

        if (queryItem) {
          q.push(queryItem);
        }
      } catch (err) {
        if (err instanceof ParserError) {
          throw err;
        } else {
          const error = err as Error;
          throw this.createParserError(error.message);
        }
      }
    }

    return q;
  }
}

export { QueryStream, ParserError };
