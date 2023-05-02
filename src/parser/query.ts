import { InputStream } from "../InputStream";
import { TokenStream } from "./TokenStream";
import { ParserError, QueryStream } from "./QueryStream";
import type { Query } from "../query.types";

const parseQuery = (s: string, validFields: string[]) => {
  const inputStream = new InputStream(s);
  const tokenStream = new TokenStream(inputStream);
  const queryStream = new QueryStream(tokenStream, validFields);

  return queryStream.parse() as Query[];
};

export { parseQuery, ParserError };
