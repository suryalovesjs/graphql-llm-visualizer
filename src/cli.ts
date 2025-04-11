#!/usr/bin/env node
// src/cli.ts
import { Command } from 'commander';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { SchemaAnalyzer } from './schema-analyzer.js';
import inquirer from 'inquirer';
import ora from 'ora';

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
  .option('-c, --config <path>', 'Path to config file', 'graphql-visualizer.json')
  .action(async (options) => {
    // Check if config file exists
    if (!fs.existsSync(options.config)) {
      console.error(`Config file not found: ${options.config}`);
      console.log('Run "graphql-visualizer init" to create a configuration first');
      process.exit(1);
    }
    
    const spinner = ora('Analyzing config file...').start();
    
    try {
      // Load config file
      const config = JSON.parse(fs.readFileSync(options.config, 'utf8'));
      // Run analysis with configuration
      await runAnalysis({
        schema: config.schema,
      });
    } catch (error) {
      spinner.fail(`Analysis failed: ${error}`);
      process.exit(1);
    }
  });

// Parse command line arguments  
program.parse(process.argv);

/**
 * Run the full analysis and visualization process
 */
async function runAnalysis(options: {
  schema: string;
}) {
  // Create spinner for progress indication
  const spinner = ora('Starting GraphQL Analysis...').start();
  try {
    // 1. Analyze schema
    spinner.text = 'Analyzing GraphQL schema...';
    const schemaAnalyzer = new SchemaAnalyzer();
    await schemaAnalyzer.loadSchema(options.schema);
    const schemaNodes = schemaAnalyzer.analyze();
    console.log('[Post Schema Analysis]', schemaNodes);
    spinner.succeed('Schema analysis complete');
    
    // 2. Analyze resolvers [WIP]
  } catch (error) {
    spinner.fail(`Analysis failed: ${error}`);
    throw error;
  }
}