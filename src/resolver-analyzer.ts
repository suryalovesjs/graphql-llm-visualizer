// src/resolver-analyzer.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import type { ResolverInfo } from './types';
import type { GraphQLSchema } from 'graphql';
import { isObjectType } from 'graphql';

export class ResolverAnalyzer {
  private resolverFiles: string[] = [];
  private resolverAnalysisResults: ResolverInfo[] = [];

  /**
   * Load resolver files for analysis
   */
  async loadResolverFiles(resolverPaths: string[]): Promise<void> {
    this.resolverFiles = [];
    
    for (const resolverPath of resolverPaths) {
      if (fs.existsSync(resolverPath)) {
        const stat = fs.statSync(resolverPath);
        
        if (stat.isDirectory()) {
          // Recursively add .ts and .js files from directory
          this.addFilesFromDirectory(resolverPath);
        } else if (stat.isFile() && (resolverPath.endsWith('.ts') || resolverPath.endsWith('.js'))) {
          this.resolverFiles.push(resolverPath);
        }
      }
    }
  }

  private addFilesFromDirectory(dirPath: string): void {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        this.addFilesFromDirectory(filePath);
      } else if (file.endsWith('.ts') || file.endsWith('.js')) {
        this.resolverFiles.push(filePath);
      }
    }
  }

  /**
   * Analyze resolver files to extract resolver information
   */
  async analyzeResolvers(): Promise<ResolverInfo[]> {
    this.resolverAnalysisResults = [];
    
    for (const resolverFile of this.resolverFiles) {
      try {
        const fileContent = fs.readFileSync(resolverFile, 'utf8');
        this.analyzeFileContent(fileContent, resolverFile);
      } catch (error) {
        console.error(`Error analyzing resolver file ${resolverFile}:`, error);
      }
    }
    
    return this.resolverAnalysisResults;
  }

  /**
   * Parse TypeScript file to detect resolver patterns
   */
  private analyzeFileContent(fileContent: string, filePath: string): void {
    // Create a TS source file
    const sourceFile = ts.createSourceFile(
      filePath,
      fileContent,
      ts.ScriptTarget.Latest,
      true
    );

    // Walk through the AST to find resolver definitions
    this.walkNode(sourceFile, filePath);
  }

  private walkNode(node: ts.Node, filePath: string, parent?: ts.Node): void {
    // Look for object literals that might be resolver maps
    if (ts.isObjectLiteralExpression(node)) {
      this.analyzeObjectLiteral(node, filePath);
    }
    
    // Look for function declarations or arrow functions that might be resolvers
    if ((ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) && 
        parent && ts.isVariableDeclaration(parent)) {
      this.analyzeFunction(node, parent, filePath);
    }
    
    // Continue walking the AST
    ts.forEachChild(node, child => this.walkNode(child, filePath, node));
  }

  /**
   * Analyze an object literal to see if it's a resolver map
   */
  private analyzeObjectLiteral(node: ts.ObjectLiteralExpression, filePath: string): void {
    // Check if this object is likely a resolver map (contains methods)
    const properties = node.properties;
    let isLikelyResolverMap = false;
    let resolverTypeName = 'unknown';
    
    // Try to determine the resolver type name from variable assignment or export
    if (node.parent && ts.isPropertyAssignment(node.parent)) {
      if (ts.isIdentifier(node.parent.name)) {
        resolverTypeName = node.parent.name.text;
        isLikelyResolverMap = true;
      }
    } else if (node.parent && ts.isVariableDeclaration(node.parent)) {
      if (ts.isIdentifier(node.parent.name)) {
        resolverTypeName = node.parent.name.text;
        
        // If name contains "resolver" or "resolvers", it's likely a resolver map
        if (resolverTypeName.toLowerCase().includes('resolver')) {
          isLikelyResolverMap = true;
        }
      }
    }
    
    if (isLikelyResolverMap) {
      // Process the resolver map properties
      for (const property of properties) {
        if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
          const fieldName = property.name.text;
          
          // If the value is a function, it's a resolver
          if (ts.isFunctionExpression(property.initializer) || 
              ts.isArrowFunction(property.initializer) ||
              ts.isIdentifier(property.initializer)) {
            
            const resolverPath = `${resolverTypeName}.${fieldName}`;
            const resolverInfo = this.analyzeResolverImplementation(
              property.initializer, 
              resolverPath,
              filePath
            );
            
            this.resolverAnalysisResults.push(resolverInfo);
          }
        }
      }
    }
  }

  /**
   * Analyze a function to see if it's a resolver
   */
  private analyzeFunction(
    node: ts.FunctionDeclaration | ts.ArrowFunction, 
    parent: ts.VariableDeclaration,
    filePath: string
  ): void {
    if (ts.isIdentifier(parent.name)) {
      const functionName = parent.name.text;
      
      // If name contains "resolver", it's likely a resolver function
      if (functionName.toLowerCase().includes('resolver')) {
        const resolverInfo = this.analyzeResolverImplementation(
          node,
          functionName,
          filePath
        );
        
        this.resolverAnalysisResults.push(resolverInfo);
      }
    }
  }

  /**
   * Analyze a resolver implementation to determine its source type
   */
  private analyzeResolverImplementation(
    node: ts.Node, 
    resolverPath: string,
    filePath: string
  ): ResolverInfo {
    const resolverInfo: ResolverInfo = {
      path: resolverPath,
      typeName: resolverPath.split('.').pop() || 'unknown',
      fieldName: resolverPath.split('.').pop() || 'unknown',
      code: node.getText(),
      sourceType: 'unknown',
    };
    
    // Get the function text
    const sourceText = node.getText();
    
    // Check for database patterns
    if (this.containsPrismaPattern(sourceText)) {
      resolverInfo.sourceType = 'database';
      resolverInfo.databaseInfo = {
        type: 'prisma',
        operation: this.detectPrismaOperation(sourceText) as NonNullable<ResolverInfo['databaseInfo']>['operation'],
        model: this.detectPrismaModel(sourceText),
      };
    } else if (this.containsMongoosePattern(sourceText)) {
      resolverInfo.sourceType = 'database';
      resolverInfo.databaseInfo = {
        type: 'mongoose',
      };
    } else if (this.containsTypeORMPattern(sourceText)) {
      resolverInfo.sourceType = 'database';
      resolverInfo.databaseInfo = {
        type: 'typeorm',
      };
    } else if (this.containsSQLPattern(sourceText)) {
      resolverInfo.sourceType = 'database';
      resolverInfo.databaseInfo = {
        type: 'raw-sql',
      };
    } 
    // Check for API patterns
    else if (this.containsRESTApiPattern(sourceText)) {
      resolverInfo.sourceType = 'api';
      resolverInfo.apiInfo = {
        type: 'rest',
        method: this.detectRESTMethod(sourceText),
        endpoint: this.detectRESTEndpoint(sourceText),
      };
    } else if (this.containsGraphQLPattern(sourceText)) {
      resolverInfo.sourceType = 'api';
      resolverInfo.apiInfo = {
        type: 'graphql',
      };
    } 
    // Check for computed values
    else if (this.isLikelyComputed(sourceText)) {
      resolverInfo.sourceType = 'computed';
    }
    
    // Detect dependencies
    resolverInfo.dependencies = this.detectDependencies(sourceText);
    
    return resolverInfo;
  }

  // Pattern detection helpers
  private containsPrismaPattern(text: string): boolean {
    return /prisma\.\w+\.\w+/.test(text);
  }

  private detectPrismaModel(text: string): string | undefined {
    const match = text.match(/prisma\.(\w+)/);
    return match ? match[1] : undefined;
  }

  private detectPrismaOperation(text: string): NonNullable<ResolverInfo['databaseInfo']>['operation'] {
    if (text.includes('.findMany')) return 'findMany';
    if (text.includes('.findUnique') || text.includes('.findFirst')) return 'findUnique';
    if (text.includes('.create')) return 'create';
    if (text.includes('.update') || text.includes('.updateMany')) return 'update';
    if (text.includes('.delete') || text.includes('.deleteMany')) return 'delete';
    return 'other';
  }

  private containsMongoosePattern(text: string): boolean {
    return /\w+\.find\(|\w+\.findById\(|\w+\.findOne\(|\w+\.create\(/.test(text);
  }

  private containsTypeORMPattern(text: string): boolean {
    return /repository\.\w+\(|getRepository\(/.test(text);
  }

  private containsSQLPattern(text: string): boolean {
    return /SELECT|INSERT|UPDATE|DELETE|FROM\s+\w+/.test(text.toUpperCase());
  }

  private containsRESTApiPattern(text: string): boolean {
    return /fetch\(|axios\.|\.get\(|\.post\(|\.put\(|\.delete\(|request\(/.test(text);
  }

  private detectRESTMethod(text: string): string | undefined {
    if (text.includes('.get(')) return 'GET';
    if (text.includes('.post(')) return 'POST';
    if (text.includes('.put(')) return 'PUT';
    if (text.includes('.delete(')) return 'DELETE';
    if (text.includes('.patch(')) return 'PATCH';
    return undefined;
  }

  private detectRESTEndpoint(text: string): string | undefined {
    // Try to extract URL from quotes after common HTTP client methods
    const match = text.match(/\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/);
    return match ? match[2] : undefined;
  }

  private containsGraphQLPattern(text: string): boolean {
    return /graphql\(|gql`|gql\s*`/.test(text);
  }

  private isLikelyComputed(text: string): boolean {
    // If it doesn't contain external data access but has logic, it's likely computed
    const hasNoDataAccess = !this.containsPrismaPattern(text) && 
                           !this.containsMongoosePattern(text) &&
                           !this.containsTypeORMPattern(text) &&
                           !this.containsSQLPattern(text) &&
                           !this.containsRESTApiPattern(text) &&
                           !this.containsGraphQLPattern(text);
                           
    const hasLogic = /return\s+\w+(\s*\+\s*|\s*-\s*|\s*\*\s*|\s*\/\s*|\s*\?\s*|\s*\.\w+)/.test(text);
    
    return hasNoDataAccess && hasLogic;
  }

  private detectDependencies(text: string): string[] {
    const dependencies: string[] = [];
    
    // Look for direct references to other resolvers
    const resolverRefMatches = text.match(/(\w+)\.resolvers\.(\w+)/g);
    if (resolverRefMatches) {
      for (const match of resolverRefMatches) {
        const parts = match.split('.');
        if (parts.length >= 3) {
          dependencies.push(`${parts[0]}.${parts[2]}`);
        }
      }
    }
    
    return dependencies;
  }

  analyzeResolversFromSchema(schema: GraphQLSchema): ResolverInfo[] {
    const resolverInfos: ResolverInfo[] = [];
    const typeMap = schema.getTypeMap();
    
    // Process each type in the schema
    for (const typeName in typeMap) {
      // Skip internal types
      if (typeName.startsWith('__')) continue;
      
      const type = typeMap[typeName];
      
      // Only object types can have resolvers
      if (isObjectType(type)) {
        const fields = type.getFields();
        
        // Process each field
        for (const fieldName in fields) {
          const field = fields[fieldName];
          
          // Try to get the resolver function
          const resolver = field.resolve;
          
          if (resolver) {
            // Create resolver info
            const resolverInfo: ResolverInfo = {
              typeName,
              fieldName,
              path: `${typeName}.${fieldName}`,
              code: resolver.toString(),
              sourceType: 'unknown' // Default
            };
            
            // Analyze the resolver function
            this.analyzeResolverFunction(resolverInfo);
            
            resolverInfos.push(resolverInfo);
          }
        }
      }
    }
    
    return resolverInfos;
  }
  
  // Analyze the resolver function to determine source type, etc.
  private analyzeResolverFunction(resolverInfo: ResolverInfo): void {
    const resolverCode = resolverInfo.code;
    
    // Detection logic
    if (this.containsPrismaPattern(resolverCode)) {
      resolverInfo.sourceType = 'database';
      resolverInfo.databaseInfo = {
        type: 'prisma',
        model: this.detectPrismaModel(resolverCode),
        operation: this.detectPrismaOperation(resolverCode)
      };
    }
    // Add other detection patterns from your existing methods
  }
}