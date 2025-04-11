// src/index.ts
export { SchemaAnalyzer } from './schema-analyzer.js';
export { ResolverAnalyzer } from './resolver-analyzer.js';
export { LLMAnalyzer } from './llm-analyzer.js';
export { StaticAnalyzer } from './static-analyzer.js';
export { GraphQLVisualizer } from './visualizer.js';
export * from './types.js';

// src/types.ts
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

export interface SchemaField {
  name: string;
  type: string;
  isNonNull: boolean;
  isList: boolean;
  description?: string;
}

export interface ResolverInfo {
  path: string; // e.g., "Query.users"
  sourceType: "database" | "api" | "computed" | "unknown";
  databaseInfo?: {
    type: "prisma" | "mongoose" | "sequelize" | "typeorm" | "raw-sql" | "other";
    model?: string;
    operation?:
      | "findMany"
      | "findUnique"
      | "create"
      | "update"
      | "delete"
      | "other";
  };
  apiInfo?: {
    type: "rest" | "graphql" | "grpc" | "other";
    endpoint?: string;
    method?: string;
  };
  dependencies?: string[]; // other resolvers or types this depends on
}

export interface AnalysisResult {
  schema: SchemaNode[];
  resolvers: ResolverInfo[];
  connections: Connection[];
}

export interface Connection {
  from: string;
  to: string;
  type: "references" | "extends" | "implements" | "calls";
  description?: string;
}

export interface VisualizationOptions {
  layout?: "hierarchical" | "force-directed" | "circular";
  theme?: "light" | "dark";
  groupBySource?: boolean;
  showDependencies?: boolean;
}

export interface LLMConfig {
  provider: "openai" | "anthropic" | "custom";
  apiKey: string;
  model?: string;
  endpoint?: string;
}
