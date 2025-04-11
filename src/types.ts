/**
 * Represents a node in the GraphQL schema
 */
export interface SchemaNode {
  type:
    | "Query"
    | "Mutation"
    | "Type"
    | "Interface"
    | "Union"
    | "Enum"
    | "Input";
  name: string;
  fields?: SchemaField[];
  description?: string;
}

/**
 * Represents a field in a GraphQL type
 */
export interface SchemaField {
  name: string;
  type: string;
  isNonNull: boolean;
  isList: boolean;
  description?: string;
}
