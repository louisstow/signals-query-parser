import type { InputStream } from "./InputStream";

type predicateFn = (c: string) => boolean;
type Token = {
  type: string;
  value: string;
  pos?: number;
};

class BaseTokenStream {
  istream: InputStream;
  current: Token | null;

  constructor(istream: InputStream) {
    this.istream = istream;
    this.current = null;
  }

  readNext(): Token | null {
    return null;
  }

  readWhile(predicate: predicateFn) {
    let s = "";
    while (!this.istream.eof() && predicate(this.istream.peek())) {
      s += this.istream.next();
    }
    return s;
  }

  readEscapedString(
    {
      keepEscape,
      expectClosingQuote,
    }: { keepEscape?: boolean; expectClosingQuote?: boolean } = {
      keepEscape: false,
      expectClosingQuote: true,
    }
  ) {
    let escaped = false;
    let closed = false;
    let s = "";

    while (!this.istream.eof()) {
      const c = this.istream.next();

      if (escaped) {
        if (keepEscape) s += "\\";
        s += c;
        escaped = false;
      } else if (c === "\\") {
        escaped = true;
      } else if (c === '"') {
        closed = true;
        break;
      } else {
        s += c;
      }
    }

    if (!closed && expectClosingQuote) {
      throw new Error("Unclosed string");
    }

    return s;
  }

  next() {
    const tok = this.current;
    this.current = null;
    return tok || this.readNext();
  }

  peek() {
    return this.current || (this.current = this.readNext());
  }

  eof() {
    return this.peek() === null;
  }
}

export { BaseTokenStream, Token };
