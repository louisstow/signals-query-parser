export interface SoftwareQuery {
  type: "software";
  value: {
    software: Array<{
      name: string;
      version: Array<{ op: "gt" | "gte" | "lt" | "lte" | "eq"; value: string }>;
    }>;
    softwareList?: string;
    fuzzy?: boolean;
  };
}

export interface InQuery {
  type: "in";
  value: {
    field: string;
    query: string[];
    negated?: boolean;
  };
}

export type RangeQueryOp = "gt" | "gte" | "lt" | "lte" | "eq";
export interface RangeQuery {
  type: "range";
  value: {
    field: string;
    query: { [op in RangeQueryOp]?: number };
  };
}

export interface MatchQuery {
  type: "match";
  value: {
    field: string;
    query: string;
  };
}

export interface ExactQuery {
  type: "exact";
  value: {
    field: string;
    query: string;
  };
}

export interface FilterQuery {
  type: "filter";
  value: {
    filter: string;
  };
}

export interface GroupQuery {
  type: "group";
  value: {
    field: string;
  };
}

export type Query =
  | SoftwareQuery
  | ExactQuery
  | MatchQuery
  | RangeQuery
  | InQuery
  | FilterQuery
  | GroupQuery;
