#!/usr/bin/env node
// src/cli.ts
import { Command } from 'commander';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { SchemaAnalyzer } from './schema-analyzer.js';
import { ResolverAnalyzer } from './resolver-analyzer.js';
import { LLMAnalyzer } from './llm-analyzer.js';
import { GraphQLVisualizer } from './visualizer.js';
import type { VisualizationOptions, LLMConfig } from './types.js';
import inquirer from 'inquirer';
import ora from 'ora';
import { StaticAnalyzer } from './static-analyzer.js';
import type { AnalysisResult } from './types.js';

// Set up command line interface
const program = new Command();

program
  .name('graphql-visualizer')
  .description('CLI tool to visualize GraphQL services')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize a new GraphQL visualizer configuration')
  .action(async () => {
    try {
      // First ask for the LLM provider
      const providerAnswer = await inquirer.prompt([
        {
          type: 'list',
          name: 'llmProvider',
          message: 'Which LLM provider would you like to use?',
          choices: ['openai', 'anthropic', 'custom', 'none']
        }
      ]);
      
      // Define the validation function type at the top of the file
      type ValidationFunction = (input: string) => boolean | string;

      // Then ask for other details
      const questions = [
        {
          type: 'input',
          name: 'projectName',
          message: 'Project name:',
          default: path.basename(process.cwd())
        },
        {
          type: 'input',
          name: 'schemaPath',
          message: 'Path to GraphQL schema file:',
          validate: ((input: string) => !!input || 'Schema path is required') as ValidationFunction
        },
        {
          type: 'input',
          name: 'resolversPath',
          message: 'Path to resolvers directory:',
          validate: ((input: string) => !!input || 'Resolvers path is required') as ValidationFunction
        }
      ];
      
      // Use type assertion when adding to questions array
      if (providerAnswer.llmProvider !== 'none') {
        questions.push({
          type: 'password',
          name: 'llmApiKey',
          message: `API key for ${providerAnswer.llmProvider}:`,
          validate: ((input: string) => !!input || 'API key is required') as ValidationFunction
        });
      }
      
      const answers = await inquirer.prompt(questions);
      
      // Create a config file
      const config = {
        projectName: answers.projectName,
        schema: answers.schemaPath,
        resolvers: [answers.resolversPath],
        llm: {
          provider: providerAnswer.llmProvider,
          apiKey: answers.llmApiKey || '',
          model: providerAnswer.llmProvider === 'openai' ? 'gpt-4' : 
                 providerAnswer.llmProvider === 'anthropic' ? 'claude-3-opus-20240229' : 
                 ''
        },
        visualization: {
          layout: 'hierarchical',
          theme: 'light',
          groupBySource: true,
          showDependencies: true
        }
      };
      
      fs.writeFileSync(
        'graphql-visualizer.json',
        JSON.stringify(config, null, 2)
      );
      
      console.log('Configuration created: graphql-visualizer.json');
      console.log('You can now run: graphql-visualizer analyze');
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('Analyze a GraphQL service using config file')
  .action(async () => {
    const configPath = 'graphql-visualizer.json';
    
    // Check if config file exists
    if (!fs.existsSync(configPath)) {
      console.error('Config file not found: graphql-visualizer.json');
      console.log('Run "graphql-visualizer init" to create a configuration first');
      process.exit(1);
    }
    
    const spinner = ora('Analyzing config file...').start();
    
    try {
      // Load config file
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      // Run analysis with configuration
      await runAnalysis({
        schema: config.schema,
        resolvers: config.resolvers,
        output: config.output || 'graphql-visualization.html',
        layout: config.visualization?.layout || 'hierarchical',
        theme: config.visualization?.theme || 'light',
        groupBySource: config.visualization?.groupBySource !== false,
        showDependencies: config.visualization?.showDependencies !== false,
        llmProvider: config.llm?.provider || 'none',
        llmApiKey: config.llm?.apiKey,
        llmModel: config.llm?.model,
        llmEndpoint: config.llm?.endpoint
      });
    } catch (error) {
      spinner.fail(`Analysis failed: ${error}`);
      process.exit(1);
    }
  });

// Add config command to load from file
program
  .command('config')
  .description('Load configuration from file')
  .option('-c, --config <path>', 'Path to config file', 'graphql-visualizer.json')
  .action(async (options) => {
    try {
      if (!fs.existsSync(options.config)) {
        console.error(`Config file not found: ${options.config}`);
        console.log('Run "graphql-visualizer init" to create a config file');
        process.exit(1);
      }
      
      const config = JSON.parse(fs.readFileSync(options.config, 'utf8'));
      await runAnalysis({
        schema: config.schema,
        resolvers: config.resolvers,
        output: config.output || 'graphql-visualization.html',
        layout: config.visualization?.layout || 'hierarchical',
        theme: config.visualization?.theme || 'light',
        groupBySource: config.visualization?.groupBySource !== false,
        showDependencies: config.visualization?.showDependencies !== false,
        llmProvider: config.llm?.provider || 'none',
        llmApiKey: config.llm?.apiKey,
        llmModel: config.llm?.model,
        llmEndpoint: config.llm?.endpoint
      });
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

// Parse command line arguments  
program.parse(process.argv);

/**
 * Run the full analysis and visualization process
 */
async function runAnalysis(options: VisualizationOptions & {
  schema: string;
  resolvers: string[];
  output: string;
  llmProvider: string;
  llmApiKey: string;
  llmModel: string;
  llmEndpoint?: string;
}) {
  // Create spinner for progress indication
  const spinner = ora(`Starting analysis using ${options.llmProvider === 'none' ? 'static' : options.llmProvider}...`).start();
  try {
    // 1. Analyze schema
    spinner.text = 'Analyzing GraphQL schema...';
    const schemaAnalyzer = new SchemaAnalyzer();
    await schemaAnalyzer.loadSchema(options.schema);
    const schemaNodes = schemaAnalyzer.analyze();
    console.log('[Post Schema Analysis]', schemaNodes);
    // 2. Analyze resolvers
    spinner.text = 'Analyzing resolver implementations...:';
    console.log('Resolver files:', options.resolvers);
    const resolverAnalyzer = new ResolverAnalyzer();
    await resolverAnalyzer.loadResolverFiles(options.resolvers);
    const resolverInfos = await resolverAnalyzer.analyzeResolvers();
    console.log('[Post Resolver Analysis]', resolverInfos);
    // // 3. Analyze connections (with or without LLM)
    // let analysisResult: AnalysisResult;
    
    // if (options.llmProvider === 'none') {
    //   // Use static analyzer
    //   spinner.text = 'Performing static analysis...';
    //   const staticAnalyzer = new StaticAnalyzer();
    //   analysisResult = staticAnalyzer.analyzeConnections(schemaNodes, resolverInfos);
    // } else {
    //   // Use LLM analyzer
    //   spinner.text = 'Analyzing with LLM...';
    //   const llmConfig: LLMConfig = {
    //     provider: options.llmProvider as 'openai' | 'anthropic' | 'custom',
    //     apiKey: options.llmApiKey,
    //     model: options.llmModel,
    //     endpoint: options.llmEndpoint,
    //   };
      
    //   const llmAnalyzer = new LLMAnalyzer(llmConfig);
    //   analysisResult = await llmAnalyzer.analyzeConnections(schemaNodes, resolverInfos);
    // }
    
    // // 4. Generate visualization
    // spinner.text = 'Generating visualization...';
    // const visualizationOptions: VisualizationOptions = {
    //   layout: options.layout,
    //   theme: options.theme,
    //   groupBySource: options.groupBySource,
    //   showDependencies: options.showDependencies,
    // };
    
    // const visualizer = new GraphQLVisualizer();
    // const visualization = await visualizer.generateVisualization(analysisResult, visualizationOptions);
    
    // // 5. Save visualization
    // spinner.text = 'Saving visualization...';
    // await visualizer.saveVisualization(visualization, options.output);
    
    // spinner.succeed(`Analysis completed! Visualization saved to ${options.output}`);
  } catch (error) {
    spinner.fail(`Analysis failed: ${error}`);
    throw error;
  }
}