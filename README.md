# GraphQL LLM Visualizer [WIP]

A TypeScript library that uses Large Language Models (LLMs) to analyze GraphQL services and create visual representations of their architecture.

## Features

- **Schema Analysis**: Parse GraphQL schemas to extract types, queries, mutations, and their relationships
- **Resolver Analysis**: Analyze resolver implementations to detect data sources (DB, API, computed)
- **LLM-Enhanced Understanding**: Use LLMs to understand complex relationships between schema and resolvers
- **Interactive Visualization**: Generate interactive D3.js visualizations of your GraphQL service
- **Multiple Layouts**: Choose between hierarchical, force-directed, or circular layouts
- **Customization Options**: Customize colors, themes, and grouping options

## Installation

```bash
npm install graphql-llm-visualizer
```

Or install globally to use the CLI:

```bash
npm install -g graphql-llm-visualizer
```

## CLI Usage

The easiest way to use GraphQL LLM Visualizer is through its CLI:

### Initialize a new project

```bash
graphql-visualizer init
```

This interactive command will guide you through setting up a configuration file.

### Analyze a GraphQL service

```bash
graphql-visualizer analyze --schema ./schema.graphql --resolvers ./src/resolvers
```

### Options

- `-s, --schema <path>`: Path to GraphQL schema file
- `-r, --resolvers <paths...>`: Paths to resolver files/directories
- `-o, --output <path>`: Output path for visualization HTML (default: "graphql-visualization.html")
- `-l, --layout <type>`: Visualization layout (hierarchical, force-directed, circular) (default: "hierarchical")
- `-t, --theme <theme>`: Visualization theme (light, dark) (default: "light")
- `-g, --group-by-source`: Group resolvers by data source (default: true)
- `-d, --show-dependencies`: Show dependencies between resolvers (default: true)
- `--llm-provider <provider>`: LLM provider (openai, anthropic, custom) (default: "openai")
- `--llm-api-key <key>`: API key for LLM provider
- `--llm-model <model>`: Model name for LLM provider
- `--llm-endpoint <endpoint>`: Custom endpoint for LLM provider

### Use a config file

Create a `graphql-visualizer.json` file or run `graphql-visualizer init` to generate one. Then:

```bash
graphql-visualizer config
```

## Programmatic Usage

You can also use the library programmatically in your TypeScript/JavaScript projects:

```typescript
import { 
  SchemaAnalyzer, 
  ResolverAnalyzer, 
  LLMAnalyzer, 
  GraphQLVisualizer 
} from 'graphql-llm-visualizer';

async function analyzeGraphQLService() {
  // 1. Analyze schema
  const schemaAnalyzer = new SchemaAnalyzer();
  await schemaAnalyzer.loadSchema('./schema.graphql');
  const schemaNodes = schemaAnalyzer.analyze();
  
  // 2. Analyze resolvers
  const resolverAnalyzer = new ResolverAnalyzer();
  await resolverAnalyzer.loadResolverFiles(['./src/resolvers']);
  const resolverInfos = await resolverAnalyzer.analyzeResolvers();
  
  // 3. Use LLM to analyze connections
  const llmAnalyzer = new LLMAnalyzer({
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4',
  });
  const analysisResult = await llmAnalyzer.analyzeConnections(schemaNodes, resolverInfos);
  
  // 4. Generate visualization
  const visualizer = new GraphQLVisualizer();
  const visualization = await visualizer.generateVisualization(analysisResult, {
    layout: 'hierarchical',
    theme: 'light',
    groupBySource: true,
    showDependencies: true,
  });
  
  // 5. Save visualization
  await visualizer.saveVisualization(visualization, 'graphql-visualization.html');
}
```

## How It Works

GraphQL LLM Visualizer works in several stages:

1. **Schema Parsing**: It parses your GraphQL schema to extract types, fields, and relationships
2. **Resolver Analysis**: It analyzes your resolver implementations using static code analysis to detect patterns
3. **LLM Enhancement**: It uses an LLM (like GPT-4 or Claude) to understand complex relationships and data flows
4. **Visualization Generation**: It creates an interactive visualization showing the architecture of your service

The visualizer attempts to identify:
- Database connections (Prisma, Mongoose, TypeORM, raw SQL)
- API calls (REST, GraphQL, etc.)
- Computed values
- Dependencies between types and resolvers

## Supported Data Sources

The library can automatically detect:

### Database ORMs/Clients
- Prisma
- Mongoose
- TypeORM
- Raw SQL queries

### API Clients
- Fetch API
- Axios
- HTTP methods (get, post, etc.)
- GraphQL clients

## Example Visualization

The generated visualization will look something like this:

![Visualization Example](https://example.com/graphql-visualization.png)

It shows:
- GraphQL types (blue)
- Queries and Mutations
- Resolvers (green)
- Data sources (orange for APIs, purple for databases)
- Connections between components

## License

MIT