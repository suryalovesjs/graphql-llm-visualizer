import * as fs from 'node:fs';
import type { SchemaNode, SchemaField } from './types';

export class SchemaVisualizer {
  /**
   * Generate an HTML visualization of the GraphQL schema
   */
  generateVisualization(schemaNodes: SchemaNode[]): string {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>GraphQL Schema Visualization</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        h1 {
          border-bottom: 2px solid #f0f0f0;
          padding-bottom: 10px;
          color: #444;
        }
        .section {
          margin-bottom: 30px;
        }
        .type-container {
          margin-bottom: 25px;
          border: 1px solid #e0e0e0;
          border-radius: 5px;
          overflow: hidden;
        }
        .type-header {
          background-color: #f5f5f5;
          padding: 10px 15px;
          font-weight: bold;
          border-bottom: 1px solid #e0e0e0;
          display: flex;
          justify-content: space-between;
        }
        .type-badge {
          background-color: #e6f7ff;
          border-radius: 4px;
          padding: 3px 8px;
          font-size: 12px;
          color: #0072b3;
        }
        .type-query .type-badge { background-color: #e6f7ff; color: #0072b3; }
        .type-mutation .type-badge { background-color: #fff2e6; color: #d46b08; }
        .type-type .type-badge { background-color: #f6ffed; color: #52c41a; }
        .type-interface .type-badge { background-color: #f9f0ff; color: #722ed1; }
        .type-description {
          padding: 0 15px;
          color: #666;
          font-style: italic;
          font-size: 14px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          padding: 10px 15px;
          text-align: left;
          border-bottom: 1px solid #e0e0e0;
        }
        th {
          background-color: #fafafa;
          font-weight: 500;
        }
        .required {
          color: #ff4d4f;
          font-weight: bold;
        }
        .list {
          color: #1890ff;
        }
        .field-description {
          color: #666;
          font-size: 13px;
        }
      </style>
    </head>
    <body>
      <h1>GraphQL Schema Visualization</h1>
      
      ${this.renderSchemaByCategory(schemaNodes)}
    </body>
    </html>
    `;
    
    return html;
  }
  
  /**
   * Save the visualization to a file
   */
  saveVisualization(html: string, outputPath: string): void {
    try {
      fs.writeFileSync(outputPath, html);
      console.log(`Visualization saved to ${outputPath}`);
    } catch (error) {
      console.error(`Failed to save visualization: ${error}`);
      throw error;
    }
  }
  
  /**
   * Render schema nodes grouped by their type
   */
  private renderSchemaByCategory(schemaNodes: SchemaNode[]): string {
    // Group nodes by type
    const categories = {
      Query: schemaNodes.filter(node => node.type === 'Query'),
      Mutation: schemaNodes.filter(node => node.type === 'Mutation'),
      Type: schemaNodes.filter(node => node.type === 'Type'),
      Interface: schemaNodes.filter(node => node.type === 'Interface'),
      Union: schemaNodes.filter(node => node.type === 'Union'),
      Enum: schemaNodes.filter(node => node.type === 'Enum'),
      Input: schemaNodes.filter(node => node.type === 'Input')
    };
    
    let html = '';
    
    // Render each category
    if (categories.Query.length > 0) {
      html += `<div class="section"><h2>Queries</h2>${this.renderNodes(categories.Query)}</div>`;
    }
    
    if (categories.Mutation.length > 0) {
      html += `<div class="section"><h2>Mutations</h2>${this.renderNodes(categories.Mutation)}</div>`;
    }
    
    if (categories.Type.length > 0) {
      html += `<div class="section"><h2>Types</h2>${this.renderNodes(categories.Type)}</div>`;
    }
    
    if (categories.Interface.length > 0) {
      html += `<div class="section"><h2>Interfaces</h2>${this.renderNodes(categories.Interface)}</div>`;
    }
    
    if (categories.Union.length > 0) {
      html += `<div class="section"><h2>Unions</h2>${this.renderNodes(categories.Union)}</div>`;
    }
    
    if (categories.Enum.length > 0) {
      html += `<div class="section"><h2>Enums</h2>${this.renderNodes(categories.Enum)}</div>`;
    }
    
    if (categories.Input.length > 0) {
      html += `<div class="section"><h2>Input Types</h2>${this.renderNodes(categories.Input)}</div>`;
    }
    
    return html;
  }
  
  /**
   * Render a list of schema nodes
   */
  private renderNodes(nodes: SchemaNode[]): string {
    return nodes.map(node => this.renderNode(node)).join('');
  }
  
  /**
   * Render a single schema node
   */
  private renderNode(node: SchemaNode): string {
    return `
      <div class="type-container type-${node.type.toLowerCase()}">
        <div class="type-header">
          <span>${node.name}</span>
          <span class="type-badge">${node.type}</span>
        </div>
        ${node.description ? `<p class="type-description">${node.description}</p>` : ''}
        ${node.fields ? this.renderFieldsTable(node.fields) : ''}
      </div>
    `;
  }
  
  /**
   * Render a table of fields
   */
  private renderFieldsTable(fields: SchemaField[]): string {
    return `
      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          ${fields.map(field => this.renderFieldRow(field)).join('')}
        </tbody>
      </table>
    `;
  }
  
  /**
   * Render a table row for a field
   */
  private renderFieldRow(field: SchemaField): string {
    let typeDisplay = field.type;
    if (field.isList) {
      typeDisplay = `<span class="list">[${typeDisplay}]</span>`;
    }
    if (field.isNonNull) {
      typeDisplay = `<span class="required">${typeDisplay}!</span>`;
    }
    
    return `
      <tr>
        <td>${field.name}</td>
        <td>${typeDisplay}</td>
        <td class="field-description">${field.description || ''}</td>
      </tr>
    `;
  }
}
