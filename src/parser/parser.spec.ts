import { InputStream } from "../InputStream";
import { TokenStream } from "./TokenStream";
import { ParserError, QueryStream } from "./QueryStream";

import { parseQuery as originalParseQuery } from "./query";
import { Token } from "../BaseTokenStream";

const parseQuery = (query: string) => {
  return originalParseQuery(query, [
    "software",
    "softwareList",
    "severity",
    "description",
    "collectors",
    "id",
    "tags",
  ]);
};

describe("TokenStream", () => {
  const parse = (s: string) => {
    const inputStream = new InputStream(s);
    const tokenStream = new TokenStream(inputStream);
    const tokens: Token[] = [];

    while (!tokenStream.eof()) {
      const t = tokenStream.next();

      if (t) {
        tokens.push(t);
      }
    }

    return tokens;
  };

  test("SoftwareQuery", () => {
    expect(parse(`software in ("test" gt 1.2)`)).toEqual([
      { pos: 0, type: "ident", value: "software" },
      { pos: 9, type: "ident", value: "in" },
      { pos: 12, type: "openParen", value: "(" },
      { pos: 14, type: "string", value: "test" },
      { pos: 20, type: "ident", value: "gt" },
      { pos: 23, type: "ident", value: "1.2" },
      { pos: 26, type: "closeParen", value: ")" },
    ]);

    expect(parse(`software in ("test" =1.2>3)`)).toEqual([
      { pos: 0, type: "ident", value: "software" },
      { pos: 9, type: "ident", value: "in" },
      { pos: 12, type: "openParen", value: "(" },
      { pos: 14, type: "string", value: "test" },
      { pos: 20, type: "operator", value: "=" },
      { pos: 21, type: "ident", value: "1.2" },
      { pos: 24, type: "operator", value: ">" },
      { pos: 25, type: "ident", value: "3" },
      { pos: 26, type: "closeParen", value: ")" },
    ]);

    expect(parse(`software in (test = 1.2, another > 5 < 10)`)).toStrictEqual([
      { pos: 0, type: "ident", value: "software" },
      { pos: 9, type: "ident", value: "in" },
      { pos: 12, type: "openParen", value: "(" },
      { pos: 13, type: "ident", value: "test" },
      { pos: 18, type: "operator", value: "=" },
      { pos: 20, type: "ident", value: "1.2" },
      { pos: 23, type: "comma", value: "," },
      { pos: 25, type: "ident", value: "another" },
      { pos: 33, type: "operator", value: ">" },
      { pos: 35, type: "ident", value: "5" },
      { pos: 37, type: "operator", value: "<" },
      { pos: 39, type: "ident", value: "10" },
      { pos: 41, type: "closeParen", value: ")" },
    ]);
  });
});

test("QueryStream", () => {
  expect(
    parseQuery(`software in (test = 1.2, another > 5 < 10)`)
  ).toMatchSnapshot();

  expect(
    parseQuery(`software in (test =1.2, another >5<10)`)
  ).toMatchSnapshot();

  expect(parseQuery(`software in (test, another)`)).toMatchSnapshot();

  expect(
    parseQuery(`software = test = 1.2, "another" > 5 < 10`)
  ).toMatchSnapshot();

  expect(parseQuery(`description match "my query"`)).toMatchSnapshot();

  expect(
    parseQuery(`collectors in ("a:thing", "c:another")`)
  ).toMatchSnapshot();

  expect(parseQuery(`severity > 2 < 5`)).toMatchSnapshot();

  expect(parseQuery(`id = CVE-2020-123`)).toMatchSnapshot();

  expect(
    parseQuery(`id = CVE-2020-123 | severity > 4 | description like "Apple"`)
  ).toMatchSnapshot();

  expect(parseQuery(`"CVE-2020-123"`)).toMatchSnapshot();

  expect(parseQuery(`software in @software_list`)).toMatchSnapshot();

  expect(parseQuery(`software = @software_list`)).toMatchSnapshot();

  expect(
    parseQuery(`software = @software_list | filter THING`)
  ).toMatchSnapshot();

  expect(parseQuery(`tags in ("a", "b")`)).toMatchSnapshot();

  expect(parseQuery(`tags not in ("a", "b")`)).toMatchSnapshot();
});

test("Grouping", () => {
  expect(
    parseQuery(`tags in ("vendor/microsoft") | group tags`)
  ).toMatchSnapshot();
});

test("Error handling", () => {
  try {
    parseQuery(`thing`);
  } catch (err) {
    const e = err as ParserError;
    expect(e.message).toMatch(/Invalid field/);
    expect(e.columnNumber).toBe(0);
    expect(e.example).toMatchSnapshot();
  }

  try {
    parseQuery(`severity >`);
  } catch (err) {
    const e = err as ParserError;
    expect(e.message).toMatch(/Expected a number/);
    expect(e.columnNumber).toBe(10);
    expect(e.example).toMatchSnapshot();
  }

  try {
    parseQuery(`severity > "test"`);
  } catch (err) {
    const e = err as ParserError;
    expect(e.message).toMatch(/Expected a number/);
    expect(e.columnNumber).toBe(12);
    expect(e.example).toMatchSnapshot();
  }

  try {
    parseQuery(`severity > x`);
  } catch (err) {
    const e = err as ParserError;
    expect(e.message).toMatch(/Not a number/);
    expect(e.columnNumber).toBe(11);
    expect(e.example).toMatchSnapshot();
  }

  try {
    parseQuery(`description ~`);
  } catch (err) {
    const e = err as ParserError;
    expect(e.message).toMatch(/Unexpected value/);
    expect(e.columnNumber).toBe(13);
    expect(e.example).toMatchSnapshot();
  }

  try {
    parseQuery(`description # "test"`);
  } catch (err) {
    const e = err as ParserError;
    expect(e.message).toMatch(/Invalid operator/);
    expect(e.columnNumber).toBe(12);
    expect(e.example).toMatchSnapshot();
  }

  try {
    parseQuery(`software in x = , y > 2`);
  } catch (err) {
    const e = err as ParserError;
    expect(e.message).toMatch(/Expected version/);
    expect(e.columnNumber).toBe(16);
    expect(e.example).toMatchSnapshot();
  }

  try {
    parseQuery(`software in x % 2, y > 2`);
  } catch (err) {
    const e = err as ParserError;
    expect(e.message).toMatch(/Invalid version operator/);
    expect(e.columnNumber).toBe(14);
    expect(e.example).toMatchSnapshot();
  }

  try {
    parseQuery(`software in |`);
  } catch (err) {
    const e = err as ParserError;
    expect(e.message).toMatch(/Expected software query/);
    expect(e.columnNumber).toBe(12);
    expect(e.example).toMatchSnapshot();
  }

  try {
    parseQuery(
      `description in "this is a very long description" | software in |`
    );
  } catch (err) {
    const e = err as ParserError;
    expect(e.message).toMatch(/Expected software query/);
    expect(e.columnNumber).toBe(63);
    expect(e.example).toMatchSnapshot();
  }

  try {
    parseQuery(`collectors in (a, ")`);
  } catch (err) {
    const e = err as ParserError;
    expect(e.message).toMatch(/Unclosed string/);
    expect(e.columnNumber).toBe(20);
    expect(e.example).toMatchSnapshot();
  }

  try {
    parseQuery(`collectors in (a, b`);
  } catch (err) {
    const e = err as ParserError;
    expect(e.message).toMatch(/Expected closing parenthesis/);
    expect(e.columnNumber).toBe(19);
    expect(e.example).toMatchSnapshot();
  }

  try {
    parseQuery(`software in (x = 1, y > 2`);
  } catch (err) {
    const e = err as ParserError;
    expect(e.message).toMatch(/Expected closing parenthesis/);
    expect(e.columnNumber).toBe(25);
    expect(e.example).toMatchSnapshot();
  }

  expect.hasAssertions();
});

describe("Misc tests", () => {
  // expect(parseQuery(`collectors in (a, ")`)).toEqual([
  //   {
  //     type: "in",
  //     value: {
  //       field: "collectors",
  //       query: ["a"],
  //     },
  //   },
  // ]);
});
