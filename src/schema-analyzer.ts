// src/schema-analyzer.ts
import {
  type GraphQLSchema,
  introspectionFromSchema,
  type IntrospectionObjectType,
  type IntrospectionInterfaceType,
} from "graphql";
import type { SchemaNode, SchemaField } from "./types";
import * as fs from "node:fs";
import { buildSubgraphSchema } from "@apollo/subgraph";
import { parse } from "graphql";
import ora from "ora";

export class SchemaAnalyzer {
  private schema: GraphQLSchema | null = null;

  /**
   * Load a GraphQL schema from a file or string
   */
  async loadSchema(schemaPath: string): Promise<void> {
    const spinner = ora("Loading GraphQL schema...").start();
    try {
      let schemaString: string;

      if (fs.existsSync(schemaPath)) {
        schemaString = fs.readFileSync(schemaPath, "utf8");
      } else {
        // Assume it's a schema string directly
        schemaString = schemaPath;
      }

      // Parse and build the subgraph schema
      const documentNode = parse(schemaString);
      this.schema = buildSubgraphSchema(documentNode);
      spinner.succeed("GraphQL schema loaded successfully");
    } catch (error) {
      spinner.fail(`Failed to load GraphQL schema: ${error}`);
      throw new Error(`Failed to load GraphQL schema: ${error}`);
    }
  }

  /**
   * Analyze the loaded schema and extract nodes and fields
   */
  analyze(): SchemaNode[] {
    if (!this.schema) {
      throw new Error("No schema loaded. Call loadSchema() first.");
    }

    const introspection = introspectionFromSchema(this.schema);
    const schemaNodes: SchemaNode[] = [];

    // Process types from introspection
    const types = introspection.__schema.types.filter(
      (type) => !type.name.startsWith("__") // Filter out introspection types
    );

    for (const type of types) {
      const nodeType = this.determineNodeType(type);
      if (!nodeType) continue; // Skip if not a type we're interested in

      const node: SchemaNode = {
        type: nodeType,
        name: type.name,
        description: type.description || undefined,
      };

      // Add fields if present
      if (type.kind === "OBJECT" || type.kind === "INTERFACE") {
        node.fields = (
          type as IntrospectionObjectType | IntrospectionInterfaceType
        ).fields.map(
          (field: any): SchemaField => ({
            name: field.name,
            type: this.getTypeName(field.type),
            isNonNull: this.isNonNull(field.type),
            isList: this.isList(field.type),
            description: field.description || undefined,
          })
        );
      }

      schemaNodes.push(node);
    }

    return schemaNodes;
  }

  /**
   * Determine what kind of GraphQL type this is
   */
  private determineNodeType(type: any): SchemaNode["type"] | null {
    const kind = type.kind;
    const name = type.name;

    switch (kind) {
      case "OBJECT":
        return name === "Query"
          ? "Query"
          : name === "Mutation"
          ? "Mutation"
          : "Type";
      case "INTERFACE":
        return "Interface";
      case "UNION":
        return "Union";
      case "ENUM":
        return "Enum";
      case "INPUT_OBJECT":
        return "Input";
      default:
        return null; // Scalar or other type we're not visualizing
    }
  }

  private getTypeName(typeObj: any): string {
    if (typeObj.kind === "NON_NULL") {
      return this.getTypeName(typeObj.ofType);
    }
    if (typeObj.kind === "LIST") {
      return this.getTypeName(typeObj.ofType);
    }
    return typeObj.name;
  }

  private isNonNull(typeObj: any): boolean {
    return typeObj.kind === "NON_NULL";
  }

  private isList(typeObj: any): boolean {
    if (typeObj.kind === "NON_NULL") {
      return this.isList(typeObj.ofType);
    }
    return typeObj.kind === "LIST";
  }

  /**
   * Find direct dependencies between types in the schema
   */
  findTypeDependencies(): Record<string, string[]> {
    if (!this.schema) {
      throw new Error("No schema loaded. Call loadSchema() first.");
    }

    const dependencies: Record<string, string[]> = {};
    const typeMap = this.schema.getTypeMap();

    // Iterate through all types
    for (const typeName in typeMap) {
      if (typeName.startsWith("__")) continue; // Skip introspection types

      const type = typeMap[typeName];
      dependencies[typeName] = [];

      // Check fields for type dependencies
      if ("getFields" in type && typeof type.getFields === "function") {
        const fields = type.getFields();

        for (const fieldName in fields) {
          const field = fields[fieldName];
          let fieldType = field.type;

          // Unwrap non-null and list types
          while (
            fieldType.toString().includes("[") ||
            fieldType.toString().includes("!")
          ) {
            if ("ofType" in fieldType) {
              fieldType = fieldType.ofType;
            } else {
              break;
            }
          }

          // Add dependency if it's not a scalar
          if (
            fieldType.toString() &&
            !["ID", "String", "Int", "Float", "Boolean"].includes(
              fieldType.toString()
            )
          ) {
            if (!dependencies[typeName].includes(fieldType.toString())) {
              dependencies[typeName].push(fieldType.toString());
            }
          }
        }
      }
    }

    return dependencies;
  }
}
