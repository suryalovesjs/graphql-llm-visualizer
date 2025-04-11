// src/llm-analyzer.ts
import type { SchemaNode, ResolverInfo, Connection, LLMConfig, AnalysisResult } from './types.js';
import axios from 'axios';

export class LLMAnalyzer {
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    this.config = config;
  }

  /**
   * Use LLM to analyze connections between schema and resolvers
   */
  async analyzeConnections(
    schemaNodes: SchemaNode[],
    resolverInfos: ResolverInfo[]
  ): Promise<AnalysisResult> {
    // Prepare context for LLM
    const schemaContext = JSON.stringify(schemaNodes, null, 2);
    const resolverContext = JSON.stringify(resolverInfos, null, 2);

    // Generate the prompt
    const prompt = this.generateAnalysisPrompt(schemaContext, resolverContext);

    // Send to LLM
    const llmResponse = await this.callLLM(prompt);

    // Parse the response to get connections
    const connections = this.parseConnectionsFromLLMResponse(llmResponse);

    // Further refine the resolver information based on LLM insights
    const enhancedResolvers = await this.enhanceResolverInfo(resolverInfos, llmResponse);

    return {
      schema: schemaNodes,
      resolvers: enhancedResolvers,
      connections,
    };
  }

  /**
   * Generate a prompt for the LLM to analyze the GraphQL service
   */
  private generateAnalysisPrompt(schemaContext: string, resolverContext: string): string {
    return `
You are an expert GraphQL service analyzer. I'll provide you with a GraphQL schema and resolver information.
Your task is to analyze the connections between schema types and resolvers, and identify data flow patterns.

SCHEMA:
${schemaContext}

RESOLVERS:
${resolverContext}

Please analyze this GraphQL service and provide the following:

1. Connections between schema types (references, implementations, etc.)
2. Connections between resolvers and data sources
3. Data flow patterns and dependencies
4. Any additional insights about the service architecture

Format your response as JSON with the following structure:
{
  "connections": [
    {
      "from": "TypeName or ResolverPath",
      "to": "TypeName or DataSource",
      "type": "references|extends|implements|calls|resolves",
      "description": "Brief description of the connection"
    }
    // more connections...
  ],
  "resolverInsights": [
    {
      "path": "ResolverPath",
      "inferred_source_type": "database|api|computed|unknown",
      "inferred_details": {
        // Additional details about the resolver
      },
      "description": "Explanation of what this resolver does"
    }
    // more resolver insights...
  ],
  "architecturePatterns": [
    "Description of identified architecture pattern"
    // more patterns...
  ]
}
`;
  }

  /**
   * Call the LLM API with the prompt
   */
  private async callLLM(prompt: string): Promise<string> {
    try {
      let response;

      if (this.config.provider === 'openai') {
        response = await axios.post(
          this.config.endpoint || 'https://api.openai.com/v1/chat/completions',
          {
            model: this.config.model || 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.config.apiKey}`,
            },
          }
        );

        return response.data.choices[0].message.content;
      }
      if (this.config.provider === 'anthropic') {
        response = await axios.post(
          this.config.endpoint || 'https://api.anthropic.com/v1/messages',
          {
            model: this.config.model || 'claude-3-opus-20240229',
            max_tokens: 4000,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.1,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': this.config.apiKey,
              'anthropic-version': '2023-06-01',
            },
          }
        );

        return response.data.content[0].text;
      }
      if (this.config.provider === 'custom') {
        // For custom providers, assume they follow a similar API structure
        response = await axios.post(
          this.config.endpoint!,
          {
            model: this.config.model,
            prompt: prompt,
            temperature: 0.1,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.config.apiKey}`,
            },
          }
        );

        // Assume the response structure has a content field
        return response.data.content || response.data.text || response.data.output;
      }

      throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
    } catch (error) {
      console.error('Error calling LLM:', error);
      throw new Error(`Failed to call LLM service: ${error}`);
    }
  }

  /**
   * Parse the LLM response to extract connections
   */
  private parseConnectionsFromLLMResponse(llmResponse: string): Connection[] {
    try {
      // Extract the JSON part from the response
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not find JSON in LLM response');
      }

      const jsonResponse = JSON.parse(jsonMatch[0]);
      
      // Extract connections
      const connections: Connection[] = jsonResponse.connections || [];
      
      return connections;
    } catch (error) {
      console.error('Error parsing LLM response:', error);
      console.log('Raw response:', llmResponse);
      return [];
    }
  }

  /**
   * Enhance resolver information based on LLM insights
   */
  private async enhanceResolverInfo(
    resolvers: ResolverInfo[],
    llmResponse: string
  ): Promise<ResolverInfo[]> {
    try {
      // Extract the JSON part from the response
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return resolvers;
      }

      const jsonResponse = JSON.parse(jsonMatch[0]);
      
      // Get resolver insights
      const resolverInsights = jsonResponse.resolverInsights || [];
      
      // Create a map for easy lookup
      const insightsMap = new Map<string, any>();
      for (const insight of resolverInsights) {
        insightsMap.set(insight.path, insight);
      }
      
      // Enhance resolvers with insights
      return resolvers.map(resolver => {
        const insight = insightsMap.get(resolver.path);
        if (!insight) return resolver;
        
        // If our detection was 'unknown' but LLM inferred something, use that
        if (resolver.sourceType === 'unknown' && insight.inferred_source_type) {
          resolver.sourceType = insight.inferred_source_type;
          
          // Add inferred details based on source type
          if (insight.inferred_source_type === 'database' && insight.inferred_details) {
            resolver.databaseInfo = insight.inferred_details;
          } else if (insight.inferred_source_type === 'api' && insight.inferred_details) {
            resolver.apiInfo = insight.inferred_details;
          }
        }
        
        // Add any additional dependencies detected by LLM
        if (insight.dependencies && Array.isArray(insight.dependencies)) {
          resolver.dependencies = [
            ...(resolver.dependencies || []),
            ...insight.dependencies
          ];
          
          // Remove duplicates
          resolver.dependencies = [...new Set(resolver.dependencies)];
        }
        
        return resolver;
      });
    } catch (error) {
      console.error('Error enhancing resolver info:', error);
      return resolvers;
    }
  }
}