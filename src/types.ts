// src/types.ts

/**
 * Represents a node in the GraphQL schema
 */
export interface SchemaNode {
    type: 'Query' | 'Mutation' | 'Type' | 'Interface' | 'Union' | 'Enum' | 'Input';
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
  
  /**
   * Information about a resolver function
   */
  export interface ResolverInfo {
    typeName: string;
    fieldName: string;
    path: string;
    code: string;
    sourceType: 'database' | 'api' | 'computed' | 'unknown';
    databaseInfo?: {
      type: 'prisma' | 'mongoose' | 'sequelize' | 'typeorm' | 'raw-sql' | 'other';
      model?: string;
      operation?: 'findMany' | 'findUnique' | 'create' | 'update' | 'delete' | 'other';
    };
    apiInfo?: {
      type: 'rest' | 'graphql' | 'grpc' | 'other';
      endpoint?: string;
      method?: string;
    };
    dependencies?: string[]; // other resolvers or types this depends on
  }
  
  /**
   * Represents a connection between two nodes in the visualization
   */
  export interface Connection {
    from: string;
    to: string;
    type: 'references' | 'extends' | 'implements' | 'calls' | 'resolves';
    description?: string;
  }
  
  /**
   * Result of the analysis process
   */
  export interface AnalysisResult {
    schema: SchemaNode[];
    resolvers: ResolverInfo[];
    connections: Connection[];
  }
  
  /**
   * Options for customizing the visualization
   */
  export interface VisualizationOptions {
    layout?: 'hierarchical' | 'force-directed' | 'circular';
    theme?: 'light' | 'dark';
    groupBySource?: boolean;
    showDependencies?: boolean;
  }
  
  /**
   * Configuration for the LLM provider
   */
  export interface LLMConfig {
    provider: 'openai' | 'anthropic' | 'custom' | 'none';
    apiKey?: string;
    model?: string;
    endpoint?: string;
  }