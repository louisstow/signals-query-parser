class InputStream {
  input: string;
  state: number[];
  pos: number;

  constructor(input: string) {
    this.state = [];
    this.pos = 0;
    this.input = input;
  }

  reset(input: string) {
    this.input = input;
    this.pos = 0;
  }

  next() {
    return this.input[this.pos++];
  }

  peek() {
    return this.input[this.pos];
  }

  eof() {
    return this.pos >= this.input.length;
  }

  // stack methods to go back in time if we find a dead-end
  save() {
    this.state.push(this.pos);
  }

  restore() {
    const pos = this.state.pop();
    if (pos !== undefined) {
      this.pos = pos;
    }
  }
}

export { InputStream };
