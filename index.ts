import type { Query } from "./src/query.types";
import { parseQuery } from "./src/parser/query";

export function parse(query: string, validFields: string[]): Query[] {
  return parseQuery(query, validFields);
}

export * from "./src/query.types";
export { ParserError } from "./src/parser/QueryStream";
