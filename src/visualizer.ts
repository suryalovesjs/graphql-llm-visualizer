// src/visualizer.ts
import {
  AnalysisResult,
  VisualizationOptions,
  SchemaNode,
  ResolverInfo,
  Connection,
} from "./types";
import * as fs from "node:fs";
import * as path from "node:path";

export class GraphQLVisualizer {
  /**
   * Generate a visualization of the GraphQL service
   */
  async generateVisualization(
    analysisResult: AnalysisResult,
    options: VisualizationOptions = {}
  ): Promise<string> {
    // Default options
    const visualizationOptions: VisualizationOptions = {
      layout: "hierarchical",
      theme: "light",
      groupBySource: true,
      showDependencies: true,
      ...options,
    };

    // Generate visualization
    return this.generateD3Visualization(analysisResult, visualizationOptions);
  }

  /**
   * Generate a D3.js visualization
   */
  private async generateD3Visualization(
    analysisResult: AnalysisResult,
    options: VisualizationOptions
  ): Promise<string> {
    const { schema, resolvers, connections } = analysisResult;

    // Prepare nodes and edges for the graph
    const nodes = this.prepareNodes(schema, resolvers, options);
    const edges = this.prepareEdges(connections, options);

    // Generate HTML with D3.js
    const html = this.generateD3HTML(nodes, edges, options);

    return html;
  }

  /**
   * Prepare nodes for the visualization
   */
  private prepareNodes(
    schema: SchemaNode[],
    resolvers: ResolverInfo[],
    options: VisualizationOptions
  ): any[] {
    const nodes: any[] = [];

    // Add schema nodes
    for (const node of schema) {
      nodes.push({
        id: node.name,
        label: node.name,
        group: "schema",
        type: node.type,
        fields: node.fields?.map((f) => f.name).join(", "),
      });
    }

    // Add resolver nodes
    for (const resolver of resolvers) {
      const parts = resolver.path.split(".");
      const parentType = parts[0];
      const fieldName = parts[1];

      nodes.push({
        id: resolver.path,
        label: fieldName,
        group: "resolver",
        parentType,
        sourceType: resolver.sourceType,
        databaseInfo: resolver.databaseInfo,
        apiInfo: resolver.apiInfo,
      });

      // Add data source nodes if option enabled
      if (
        options.groupBySource &&
        resolver.sourceType !== "unknown" &&
        resolver.sourceType !== "computed"
      ) {
        let sourceNodeId = "";
        let sourceNodeLabel = "";

        if (resolver.sourceType === "database" && resolver.databaseInfo) {
          const { type, model } = resolver.databaseInfo;
          sourceNodeId = `db_${type}_${model || "unknown"}`;
          sourceNodeLabel = model ? `${model} (${type})` : type;
        } else if (resolver.sourceType === "api" && resolver.apiInfo) {
          const { type, endpoint } = resolver.apiInfo;
          sourceNodeId = `api_${type}_${endpoint || "unknown"}`;
          sourceNodeLabel = endpoint ? `${endpoint} (${type})` : type;
        }

        if (sourceNodeId && !nodes.some((n) => n.id === sourceNodeId)) {
          nodes.push({
            id: sourceNodeId,
            label: sourceNodeLabel,
            group: "dataSource",
            sourceType: resolver.sourceType,
          });
        }
      }
    }

    return nodes;
  }

  /**
   * Prepare edges for the visualization
   */
  private prepareEdges(
    connections: Connection[],
    options: VisualizationOptions
  ): any[] {
    const edges: any[] = [];

    // Add connection edges
    for (const connection of connections) {
      edges.push({
        source: connection.from,
        target: connection.to,
        type: connection.type,
        label: connection.type,
      });
    }

    return edges;
  }

  /**
   * Generate HTML with D3.js for the visualization
   */
  private generateD3HTML(
    nodes: any[],
    edges: any[],
    options: VisualizationOptions
  ): string {
    // Generate colors based on node groups and types
    const nodeColorMap = this.generateNodeColorMap(nodes, options);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GraphQL Service Visualization</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: ${options.theme === "dark" ? "#1e1e1e" : "#f5f5f5"};
      color: ${options.theme === "dark" ? "#f5f5f5" : "#333"};
    }
    #graph-container {
      width: 100%;
      height: 100vh;
    }
    .node {
      cursor: pointer;
    }
    .link {
      stroke-opacity: 0.6;
    }
    .node-label {
      font-size: 12px;
      pointer-events: none;
      user-select: none;
    }
    .tooltip {
      position: absolute;
      background-color: ${options.theme === "dark" ? "#333" : "white"};
      color: ${options.theme === "dark" ? "white" : "black"};
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 10px;
      font-size: 12px;
      max-width: 300px;
      z-index: 10;
      visibility: hidden;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }
    .legend {
      position: absolute;
      top: 20px;
      right: 20px;
      background-color: ${options.theme === "dark" ? "#333" : "white"};
      padding: 10px;
      border-radius: 4px;
      border: 1px solid #ddd;
      font-size: 12px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      margin-bottom: 5px;
    }
    .legend-color {
      width: 15px;
      height: 15px;
      margin-right: 5px;
      border-radius: 2px;
    }
    .controls {
      position: absolute;
      top: 20px;
      left: 20px;
      background-color: ${options.theme === "dark" ? "#333" : "white"};
      padding: 10px;
      border-radius: 4px;
      border: 1px solid #ddd;
      font-size: 12px;
    }
    button {
      background-color: ${options.theme === "dark" ? "#555" : "#eee"};
      border: none;
      padding: 5px 10px;
      margin: 2px;
      border-radius: 3px;
      cursor: pointer;
      color: ${options.theme === "dark" ? "white" : "black"};
    }
    button:hover {
      background-color: ${options.theme === "dark" ? "#777" : "#ddd"};
    }
  </style>
</head>
<body>
  <div id="graph-container"></div>
  <div id="tooltip" class="tooltip"></div>
  <div class="legend" id="legend"></div>
  <div class="controls">
    <button id="zoom-in">Zoom In</button>
    <button id="zoom-out">Zoom Out</button>
    <button id="reset-zoom">Reset</button>
    <div style="margin-top: 10px;">
      <button id="toggle-layout">Toggle Layout</button>
      <button id="toggle-theme">Toggle Theme</button>
    </div>
  </div>

  <script>
    // Graph data
    const nodes = ${JSON.stringify(nodes)};
    const links = ${JSON.stringify(edges)};
    
    // Node color map
    const nodeColorMap = ${JSON.stringify(nodeColorMap)};
    
    // Initialize the visualization
    let currentLayout = "${options.layout}";
    let currentTheme = "${options.theme}";
    let simulation;
    
    function initGraph() {
      const container = document.getElementById('graph-container');
      const tooltip = document.getElementById('tooltip');
      
      // Clear previous graph
      container.innerHTML = '';
      
      // Set up SVG
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      const svg = d3.select(container)
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [0, 0, width, height])
        .call(d3.zoom().on('zoom', (event) => {
          g.attr('transform', event.transform);
        }));
      
      const g = svg.append('g');
      
      // Create links
      const link = g.append('g')
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('class', 'link')
        .attr('stroke', '#999')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', d => d.type === 'references' ? '5,5' : null);
      
      // Create nodes
      const node = g.append('g')
        .selectAll('circle')
        .data(nodes)
        .join('circle')
        .attr('class', 'node')
        .attr('r', d => {
          if (d.group === 'schema' && d.type === 'Query') return 12;
          if (d.group === 'schema' && d.type === 'Mutation') return 12;
          if (d.group === 'schema') return 10;
          if (d.group === 'resolver') return 8;
          if (d.group === 'dataSource') return 15;
          return 8;
        })
        .attr('fill', d => nodeColorMap[d.group]?.[d.type || d.sourceType] || '#999')
        .call(drag(simulation));
      
      // Add node labels
      const nodeLabel = g.append('g')
        .selectAll('text')
        .data(nodes)
        .join('text')
        .attr('class', 'node-label')
        .attr('text-anchor', 'middle')
        .attr('dy', 20)
        .text(d => d.label)
        .attr('fill', currentTheme === 'dark' ? '#fff' : '#333');
      
      // Node tooltip
      node.on('mouseover', function(event, d) {
        // Show tooltip
        tooltip.style.visibility = 'visible';
        
        // Generate tooltip content based on node type
        let content = '<div><strong>' + d.label + '</strong></div>';
        
        if (d.group === 'schema') {
          content += '<div>Type: ' + d.type + '</div>';
          if (d.fields) {
            content += '<div>Fields: ' + d.fields + '</div>';
          }
        } else if (d.group === 'resolver') {
          content += '<div>Path: ' + d.id + '</div>';
          content += '<div>Source: ' + d.sourceType + '</div>';
          
          if (d.sourceType === 'database' && d.databaseInfo) {
            content += '<div>DB Type: ' + d.databaseInfo.type + '</div>';
            if (d.databaseInfo.model) {
              content += '<div>Model: ' + d.databaseInfo.model + '</div>';
            }
            if (d.databaseInfo.operation) {
              content += '<div>Operation: ' + d.databaseInfo.operation + '</div>';
            }
          } else if (d.sourceType === 'api' && d.apiInfo) {
            content += '<div>API Type: ' + d.apiInfo.type + '</div>';
            if (d.apiInfo.endpoint) {
              content += '<div>Endpoint: ' + d.apiInfo.endpoint + '</div>';
            }
            if (d.apiInfo.method) {
              content += '<div>Method: ' + d.apiInfo.method + '</div>';
            }
          }
        } else if (d.group === 'dataSource') {
          content += '<div>Type: ' + d.sourceType + '</div>';
        }
        
        tooltip.innerHTML = content;
        tooltip.style.left = (event.pageX + 10) + 'px';
        tooltip.style.top = (event.pageY - 10) + 'px';
      })
      .on('mouseout', function() {
        tooltip.style.visibility = 'hidden';
      });
      
      // Generate legend
      const legend = document.getElementById('legend');
      legend.innerHTML = '';
      
      // Create a flat array of node types and colors
      const legendItems = [];
      for (const group in nodeColorMap) {
        for (const type in nodeColorMap[group]) {
          legendItems.push({
            label: group === 'schema' ? type : 
                  (group === 'resolver' ? 'Resolver: ' + type : 
                  'Data Source: ' + type),
            color: nodeColorMap[group][type]
          });
        }
      }
      
      // Add legend items
      legendItems.forEach(item => {
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        
        const colorBox = document.createElement('div');
        colorBox.className = 'legend-color';
        colorBox.style.backgroundColor = item.color;
        
        const label = document.createElement('div');
        label.textContent = item.label;
        
        legendItem.appendChild(colorBox);
        legendItem.appendChild(label);
        legend.appendChild(legendItem);
      });
      
      // Set up force simulation based on layout
      if (currentLayout === 'hierarchical') {
        setupHierarchicalLayout(nodes, links, node, link, nodeLabel, width, height);
      } else if (currentLayout === 'force-directed') {
        simulation = setupForceDirectedLayout(nodes, links, node, link, nodeLabel, width, height);
      } else if (currentLayout === 'circular') {
        setupCircularLayout(nodes, links, node, link, nodeLabel, width, height);
      }
      
      // Setup control buttons
      d3.select('#zoom-in').on('click', () => {
        svg.transition().call(
          d3.zoom().on('zoom', (event) => {
            g.attr('transform', event.transform);
          }).scaleBy, 1.3
        );
      });
      
      d3.select('#zoom-out').on('click', () => {
        svg.transition().call(
          d3.zoom().on('zoom', (event) => {
            g.attr('transform', event.transform);
          }).scaleBy, 0.7
        );
      });
      
      d3.select('#reset-zoom').on('click', () => {
        svg.transition().call(
          d3.zoom().on('zoom', (event) => {
            g.attr('transform', event.transform);
          }).transform, d3.zoomIdentity
        );
      });
      
      d3.select('#toggle-layout').on('click', () => {
        if (currentLayout === 'hierarchical') {
          currentLayout = 'force-directed';
        } else if (currentLayout === 'force-directed') {
          currentLayout = 'circular';
        } else {
          currentLayout = 'hierarchical';
        }
        initGraph();
      });
      
      d3.select('#toggle-theme').on('click', () => {
        currentTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        // Update CSS variables
        document.body.style.backgroundColor = currentTheme === 'dark' ? '#1e1e1e' : '#f5f5f5';
        document.body.style.color = currentTheme === 'dark' ? '#f5f5f5' : '#333';
        
        // Redraw graph
        initGraph();
      });
      
      return { svg, g, node, link, nodeLabel };
    }
    
    // Setup different layouts
    function setupHierarchicalLayout(nodes, links, nodeElements, linkElements, nodeLabelElements, width, height) {
      // Create hierarchy
      const hierarchy = {};
      
      // Add schema nodes to top level
      nodes.filter(n => n.group === 'schema').forEach(n => {
        hierarchy[n.id] = { level: 0, node: n };
      });
      
      // Add resolver nodes to level 1
      nodes.filter(n => n.group === 'resolver').forEach(n => {
        hierarchy[n.id] = { level: 1, node: n };
      });
      
      // Add data source nodes to level 2
      nodes.filter(n => n.group === 'dataSource').forEach(n => {
        hierarchy[n.id] = { level: 2, node: n };
      });
      
      // Position nodes based on hierarchy
      const levels = {};
      Object.values(hierarchy).forEach(item => {
        if (!levels[item.level]) {
          levels[item.level] = [];
        }
        levels[item.level].push(item.node);
      });
      
      // Calculate positions for each level
      const levelHeight = height / (Object.keys(levels).length + 1);
      
      Object.entries(levels).forEach(([level, nodesInLevel]) => {
        const levelY = Number(level) * levelHeight + levelHeight / 2;
        const nodeWidth = width / (nodesInLevel.length + 1);
        
        nodesInLevel.forEach((node, i) => {
          node.x = (i + 1) * nodeWidth;
          node.y = levelY;
        });
      });
      
      // Update node positions
      nodeElements
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);
      
      nodeLabelElements
        .attr('x', d => d.x)
        .attr('y', d => d.y);
      
      // Update link positions
      linkElements
        .attr('x1', d => {
          const source = typeof d.source === 'object' ? d.source : nodes.find(n => n.id === d.source);
          return source.x;
        })
        .attr('y1', d => {
          const source = typeof d.source === 'object' ? d.source : nodes.find(n => n.id === d.source);
          return source.y;
        })
        .attr('x2', d => {
          const target = typeof d.target === 'object' ? d.target : nodes.find(n => n.id === d.target);
          return target.x;
        })
        .attr('y2', d => {
          const target = typeof d.target === 'object' ? d.target : nodes.find(n => n.id === d.target);
          return target.y;
        });
    }
    
    function setupForceDirectedLayout(nodes, links, nodeElements, linkElements, nodeLabelElements, width, height) {
      // Create force simulation
      const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('x', d3.forceX(width / 2).strength(0.1))
        .force('y', d3.forceY(height / 2).strength(0.1));
      
      // Update positions on tick
      simulation.on('tick', () => {
        linkElements
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
        
        nodeElements
          .attr('cx', d => d.x)
          .attr('cy', d => d.y);
        
        nodeLabelElements
          .attr('x', d => d.x)
          .attr('y', d => d.y);
      });
      
      return simulation;
    }
    
    function setupCircularLayout(nodes, links, nodeElements, linkElements, nodeLabelElements, width, height) {
      // Group nodes
      const schemaNodes = nodes.filter(n => n.group === 'schema');
      const resolverNodes = nodes.filter(n => n.group === 'resolver');
      const dataSourceNodes = nodes.filter(n => n.group === 'dataSource');
      
      // Position schema nodes in inner circle
      const centerX = width / 2;
      const centerY = height / 2;
      const innerRadius = Math.min(width, height) * 0.15;
      const middleRadius = Math.min(width, height) * 0.3;
      const outerRadius = Math.min(width, height) * 0.45;
      
      // Position nodes in circles
      positionNodesInCircle(schemaNodes, centerX, centerY, innerRadius);
      positionNodesInCircle(resolverNodes, centerX, centerY, middleRadius);
      positionNodesInCircle(dataSourceNodes, centerX, centerY, outerRadius);
      
      // Update node positions
      nodeElements
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);
      
      nodeLabelElements
        .attr('x', d => d.x)
        .attr('y', d => d.y);
      
      // Update link positions
      linkElements
        .attr('x1', d => {
          const source = typeof d.source === 'object' ? d.source : nodes.find(n => n.id === d.source);
          return source.x;
        })
        .attr('y1', d => {
          const source = typeof d.source === 'object' ? d.source : nodes.find(n => n.id === d.source);
          return source.y;
        })
        .attr('x2', d => {
          const target = typeof d.target === 'object' ? d.target : nodes.find(n => n.id === d.target);
          return target.x;
        })
        .attr('y2', d => {
          const target = typeof d.target === 'object' ? d.target : nodes.find(n => n.id === d.target);
          return target.y;
        });
    }
    
    function positionNodesInCircle(nodes, centerX, centerY, radius) {
      const angleStep = (2 * Math.PI) / nodes.length;
      
      nodes.forEach((node, i) => {
        const angle = i * angleStep;
        node.x = centerX + radius * Math.cos(angle);
        node.y = centerY + radius * Math.sin(angle);
      });
    }
    
    // Drag function
    function drag(simulation) {
      function dragstarted(event) {
        if (!event.active) simulation?.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      
      function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      
      function dragended(event) {
        if (!event.active) simulation?.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      
      return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
    }
    
    // Initialize the graph
    initGraph();
  </script>
</body>
</html>
`;
  }

  /**
   * Generate a color map for nodes based on their type/group
   */
  private generateNodeColorMap(
    nodes: any[],
    options: VisualizationOptions
  ): Record<string, Record<string, string>> {
    const colorMap: Record<string, Record<string, string>> = {
      schema: {
        Query: "#4285F4", // Google Blue
        Mutation: "#EA4335", // Google Red
        Type: "#34A853", // Google Green
        Interface: "#FBBC05", // Google Yellow
        Union: "#FF6D01", // Orange
        Enum: "#46BDC6", // Teal
        Input: "#9C27B0", // Purple
      },
      resolver: {
        database: "#2196F3", // Material Blue
        api: "#FF9800", // Material Orange
        computed: "#4CAF50", // Material Green
        unknown: "#9E9E9E", // Material Grey
      },
      dataSource: {
        database: "#1565C0", // Dark Blue
        api: "#E65100", // Dark Orange
      },
    };

    // Ensure all node types have a color
    nodes.forEach((node) => {
      if (node.group === "schema" && !colorMap.schema[node.type]) {
        colorMap.schema[node.type] = "#9E9E9E"; // Grey for unknown schema types
      } else if (
        node.group === "resolver" &&
        !colorMap.resolver[node.sourceType]
      ) {
        colorMap.resolver[node.sourceType] = "#9E9E9E"; // Grey for unknown resolver types
      } else if (
        node.group === "dataSource" &&
        !colorMap.dataSource[node.sourceType]
      ) {
        colorMap.dataSource[node.sourceType] = "#9E9E9E"; // Grey for unknown data source types
      }
    });

    return colorMap;
  }

  /**
   * Save the visualization to a file
   */
  async saveVisualization(
    visualization: string,
    outputPath: string
  ): Promise<void> {
    try {
      fs.writeFileSync(outputPath, visualization);
      console.log(`Visualization saved to ${outputPath}`);
    } catch (error) {
      throw new Error(`Failed to save visualization: ${error}`);
    }
  }
}
