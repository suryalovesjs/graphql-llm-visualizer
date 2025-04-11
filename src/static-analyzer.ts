import type { SchemaNode, ResolverInfo, Connection, AnalysisResult } from './types.js';

export class StaticAnalyzer {
  /**
   * Analyze connections between schema and resolvers using static analysis
   */
  analyzeConnections(
    schemaNodes: SchemaNode[],
    resolverInfos: ResolverInfo[]
  ): AnalysisResult {
    const connections: Connection[] = [];
    
    // Map resolvers to their types and fields
    for (const resolver of resolverInfos) {
      // Connect resolver to its type
      connections.push({
        from: `${resolver.typeName}.${resolver.fieldName}`,
        to: resolver.typeName,
        type: 'resolves',
        description: `Resolver for ${resolver.typeName}.${resolver.fieldName}`
      });
      
      // Connect resolver to its data source if known
      if (resolver.sourceType === 'database' && resolver.databaseInfo) {
        const { type, model } = resolver.databaseInfo;
        connections.push({
          from: `${resolver.typeName}.${resolver.fieldName}`,
          to: `DB:${model || 'unknown'}`,
          type: 'calls',
          description: `Accesses ${model || 'unknown'} via ${type}`
        });
      } else if (resolver.sourceType === 'api' && resolver.apiInfo) {
        const { type, endpoint } = resolver.apiInfo;
        connections.push({
          from: `${resolver.typeName}.${resolver.fieldName}`,
          to: `API:${endpoint || type}`,
          type: 'calls',
          description: `Calls ${type} API ${endpoint ? `at ${endpoint}` : ''}`
        });
      }
      
      // Add dependencies between resolvers
      if (resolver.dependencies) {
        for (const dependency of resolver.dependencies) {
          connections.push({
            from: `${resolver.typeName}.${resolver.fieldName}`,
            to: dependency,
            type: 'calls',
            description: `Depends on ${dependency}`
          });
        }
      }
    }
    
    // Add schema type relationships
    for (const node of schemaNodes) {
      if (node.fields) {
        for (const field of node.fields) {
          // Skip scalar types
          if (!['ID', 'String', 'Int', 'Float', 'Boolean'].includes(field.type)) {
            connections.push({
              from: node.name,
              to: field.type.replace(/[\[\]!]/g, ''), // Remove [] and ! from type names
              type: 'references',
              description: `${node.name} references ${field.type} via ${field.name} field`
            });
          }
        }
      }
    }
    
    return {
      schema: schemaNodes,
      resolvers: resolverInfos,
      connections
    };
  }
} 