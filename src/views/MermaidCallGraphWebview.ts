import * as vscode from "vscode";
import {
  CallGraph,
  CallGraphNode,
  CallGraphEdge,
} from "../models/CallGraphModels";
import { GraphTraversal } from "../utils/GraphTraversal";

export class MermaidCallGraphWebview {
  private panel: vscode.WebviewPanel | undefined;
  private extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  /**
   * Show the mermaid call graph webview
   */
  public show(callGraph: CallGraph, title: string = "Call Graph"): void {
    const columnToShowIn = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (this.panel) {
      // If we already have a panel, just reveal it and update content
      this.panel.reveal(columnToShowIn);
    } else {
      // Create and show a new webview panel
      this.panel = vscode.window.createWebviewPanel(
        "mermaidCallGraph",
        title,
        columnToShowIn || vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [this.extensionUri],
        }
      );

      // Reset when the current panel is closed
      this.panel.onDidDispose(() => {
        this.panel = undefined;
      }, null);

      // Handle messages from the webview
      this.panel.webview.onDidReceiveMessage((message) => {
        switch (message.command) {
          case "openFile":
            this.openFile(message.filePath, message.lineNumber);
            break;
          case "exportDiagram":
            this.exportDiagram(message.svg, message.format);
            break;
          case "copyDiagram":
            this.copyDiagramCode(message.mermaidCode);
            break;
        }
      });
    }

    // Update the webview content
    this.updateWebviewContent(callGraph, title);
  }

  /**
   * Update the webview content with new call graph data
   */
  private updateWebviewContent(callGraph: CallGraph, title: string): void {
    if (!this.panel) return;

    const mermaidCode = this.generateMermaidDiagram(callGraph);
    const stats = GraphTraversal.calculateGraphStats(callGraph);
    const circularDeps = GraphTraversal.detectCircularDependencies(callGraph);

    this.panel.webview.html = this.getWebviewContent(
      mermaidCode,
      title,
      stats,
      circularDeps
    );
  }

  /**
   * Generate Mermaid flowchart code from call graph
   */
  public generateMermaidDiagram(callGraph: CallGraph): string {
    const lines: string[] = [];

    // Determine optimal direction based on graph complexity
    const stats = GraphTraversal.calculateGraphStats(callGraph);
    const direction = this.getOptimalDirection(callGraph);

    // Start with flowchart declaration
    lines.push(`flowchart ${direction}`);
    lines.push("");

    // Add subgraphs for better organization
    const subgraphs = this.organizeIntoSubgraphs(callGraph);

    // Don't use subgraphs for now to avoid syntax issues
    if (false) {
      // Subgraphs disabled for compatibility
    } else {
      // Simple node definitions without subgraphs
      const nodeDefinitions = new Set<string>();
      for (const node of callGraph.nodes) {
        const nodeId = this.sanitizeNodeId(node.id);
        let nodeLabel = this.sanitizeNodeLabel(node.name);
        const nodeShape = this.getNodeShape(node.type);

        // Add demo indicator for demo data
        if (node.metadata?.isDemoData) {
          nodeLabel = `${nodeLabel} (demo)`;
        }

        nodeDefinitions.add(
          `    ${nodeId}${nodeShape.start}${nodeLabel}${nodeShape.end}`
        );
      }

      // Add node definitions
      lines.push("    %% Node definitions");
      lines.push(...Array.from(nodeDefinitions));
      lines.push("");
    }

    // Add edges with improved labeling
    lines.push("    %% Connections");
    for (const edge of callGraph.edges) {
      const fromId = this.sanitizeNodeId(edge.from);
      const toId = this.sanitizeNodeId(edge.to);
      const edgeLabel = this.getEdgeLabel(edge.type, edge.metadata);
      const arrow = this.getArrowStyle(edge.type);

      if (edgeLabel && edgeLabel !== "") {
        lines.push(`    ${fromId} ${arrow}|${edgeLabel}| ${toId}`);
      } else {
        lines.push(`    ${fromId} ${arrow} ${toId}`);
      }
    }

    lines.push("");

    // Add enhanced styling
    lines.push("    %% Styling");
    const nodesByType = GraphTraversal.groupNodesByType(callGraph.nodes);

    nodesByType.forEach((nodes, type) => {
      const styleClass = this.getStyleClass(type);
      for (const node of nodes) {
        const nodeId = this.sanitizeNodeId(node.id);
        lines.push(`    class ${nodeId} ${styleClass}`);
      }
    });

    lines.push("");

    // Click events disabled for syntax compatibility
    lines.push("");

    // Add enhanced class definitions
    lines.push(...this.getEnhancedClassDefinitions());

    // Add edge label styling for better visibility
    lines.push("");
    lines.push("    %% Edge label styling");
    lines.push(
      "    linkStyle default stroke:#94a3b8,stroke-width:2px,color:#ffffff"
    );

    return lines.join("\n");
  }

  /**
   * Get node shape based on type
   */
  private getNodeShape(nodeType: string): { start: string; end: string } {
    switch (nodeType) {
      case "endpoint":
        return { start: "([", end: "])" }; // Stadium shape
      case "service":
        return { start: "[", end: "]" }; // Rectangle
      case "repository":
        return { start: "[(", end: ")]" }; // Cylinder
      case "entity":
        return { start: "{{", end: "}}" }; // Hexagon
      case "dto":
        return { start: "[/", end: "/]" }; // Parallelogram
      case "guard":
        return { start: "{", end: "}" }; // Diamond
      case "pipe":
        return { start: "((", end: "))" }; // Circle
      case "interceptor":
        return { start: ">", end: "]" }; // Flag
      default:
        return { start: "[", end: "]" }; // Rectangle
    }
  }

  /**
   * Get edge label
   */
  private getEdgeLabel(edgeType: string, metadata?: any): string {
    switch (edgeType) {
      case "calls":
        return metadata?.method ? metadata.method : "calls";
      case "injects":
        return "injects";
      case "uses":
        return "uses";
      case "returns":
        return "returns";
      case "guards":
        return "guards";
      case "pipes":
        return "pipes";
      case "intercepts":
        return "intercepts";
      default:
        return "";
    }
  }

  /**
   * Get arrow style for edge type
   */
  private getArrowStyle(edgeType: string): string {
    switch (edgeType) {
      case "calls":
        return "-->";
      case "injects":
        return "-..->";
      case "uses":
        return "==>";
      case "returns":
        return "<--";
      case "guards":
        return "-.->";
      case "pipes":
        return "-->";
      case "intercepts":
        return "-->";
      default:
        return "-->";
    }
  }

  /**
   * Get CSS class name for node type
   */
  private getStyleClass(nodeType: string): string {
    return `${nodeType}Node`;
  }

  /**
   * Get optimal direction based on graph structure
   */
  private getOptimalDirection(callGraph: CallGraph): string {
    const nodeCount = callGraph.nodes.length;
    const edgeCount = callGraph.edges.length;

    // For simple graphs, use top-down
    if (nodeCount <= 5) {
      return "TD";
    }

    // For complex graphs with many connections, use left-right
    const avgConnections = nodeCount > 0 ? edgeCount / nodeCount : 0;
    if (avgConnections > 2 || nodeCount > 10) {
      return "LR";
    }

    return "TD";
  }

  /**
   * Organize nodes into subgraphs by type/layer
   */
  private organizeIntoSubgraphs(
    callGraph: CallGraph
  ): Map<string, CallGraphNode[]> {
    const subgraphs = new Map<string, CallGraphNode[]>();

    for (const node of callGraph.nodes) {
      const layer = this.getNodeLayer(node.type);
      if (!subgraphs.has(layer)) {
        subgraphs.set(layer, []);
      }
      subgraphs.get(layer)!.push(node);
    }

    return subgraphs;
  }

  /**
   * Get node layer for subgraph organization
   */
  private getNodeLayer(nodeType: string): string {
    switch (nodeType) {
      case "endpoint":
        return "presentation";
      case "service":
        return "business";
      case "repository":
        return "persistence";
      case "entity":
        return "data";
      case "guard":
      case "pipe":
      case "interceptor":
        return "middleware";
      default:
        return "other";
    }
  }

  /**
   * Get human-readable layer title
   */
  private getLayerTitle(layer: string): string {
    switch (layer) {
      case "presentation":
        return "🌐 Presentation Layer";
      case "business":
        return "⚙️ Business Logic";
      case "persistence":
        return "💾 Data Access";
      case "data":
        return "📋 Data Models";
      case "middleware":
        return "🔧 Middleware";
      default:
        return "📦 Other";
    }
  }

  /**
   * Get enhanced CSS class definitions
   */
  private getEnhancedClassDefinitions(): string[] {
    return [
      "    classDef default fill:#374151,stroke:#9ca3af,stroke-width:2px,color:#ffffff",
      "    classDef endpointNode fill:#1e3a8a,stroke:#3b82f6,stroke-width:3px,color:#ffffff,font-weight:bold",
      "    classDef serviceNode fill:#166534,stroke:#22c55e,stroke-width:2px,color:#ffffff",
      "    classDef repositoryNode fill:#ea580c,stroke:#fb923c,stroke-width:2px,color:#ffffff",
      "    classDef entityNode fill:#7c2d12,stroke:#f97316,stroke-width:2px,color:#ffffff",
      "    classDef dtoNode fill:#facc15,stroke:#eab308,stroke-width:2px,color:#000000",
      "    classDef guardNode fill:#dc2626,stroke:#ef4444,stroke-width:2px,color:#ffffff",
      "    classDef pipeNode fill:#0891b2,stroke:#06b6d4,stroke-width:2px,color:#ffffff",
      "    classDef interceptorNode fill:#be185d,stroke:#ec4899,stroke-width:2px,color:#ffffff",
    ];
  }

  /**
   * Get complexity CSS class for indicators
   */
  private getComplexityClass(value: number, type: string): string {
    switch (type) {
      case "nodes":
        if (value <= 5) return "complexity-low";
        if (value <= 15) return "complexity-medium";
        return "complexity-high";
      case "edges":
        if (value <= 5) return "complexity-low";
        if (value <= 20) return "complexity-medium";
        return "complexity-high";
      case "depth":
        if (value <= 2) return "complexity-low";
        if (value <= 4) return "complexity-medium";
        return "complexity-high";
      default:
        return "complexity-low";
    }
  }

  /**
   * Get complexity label for indicators
   */
  private getComplexityLabel(value: number, type: string): string {
    const complexityClass = this.getComplexityClass(value, type);
    switch (complexityClass) {
      case "complexity-low":
        return "Simple";
      case "complexity-medium":
        return "Moderate";
      case "complexity-high":
        return "Complex";
      default:
        return "Unknown";
    }
  }

  /**
   * Sanitize node ID for Mermaid
   */
  private sanitizeNodeId(nodeId: string): string {
    // Replace special characters with underscores and ensure it starts with a letter
    return `node_${nodeId.replace(/[^a-zA-Z0-9]/g, "_")}`;
  }

  /**
   * Sanitize node label for Mermaid
   */
  private sanitizeNodeLabel(label: string): string {
    // Escape special characters and limit length
    const maxLength = 40;
    let sanitized = label
      .replace(/["|'|`|{|}|[|\]|<|>|(|)]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength - 3) + "...";
    }

    return sanitized;
  }

  /**
   * Get the webview HTML content
   */
  private getWebviewContent(
    mermaidCode: string,
    title: string,
    stats: any,
    circularDeps: string[][]
  ): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            margin: 0;
            padding: 20px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding: 10px;
            background-color: var(--vscode-editorWidget-background);
            border-radius: 6px;
        }
        
        .title {
            font-size: 24px;
            font-weight: 600;
            margin: 0;
        }
        
        .actions {
            display: flex;
            gap: 10px;
        }
        
        .btn {
            padding: 8px 16px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        
        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        
        .stat-card {
            padding: 15px;
            background-color: var(--vscode-editorWidget-background);
            border-radius: 8px;
            border-left: 4px solid var(--vscode-focusBorder);
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
        }
        
        .stat-card::before {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 40px;
            height: 40px;
            background: linear-gradient(45deg, transparent 40%, var(--vscode-focusBorder) 50%, transparent 60%);
            opacity: 0.1;
        }
        
        .stat-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .stat-title {
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--vscode-descriptionForeground);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .stat-value {
            font-size: 28px;
            font-weight: 700;
            color: var(--vscode-editor-foreground);
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }
        
        .complexity-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 8px;
            font-size: 12px;
        }
        
        .complexity-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }
        
        .complexity-low { background-color: #4caf50; }
        .complexity-medium { background-color: #ff9800; }
        .complexity-high { background-color: #f44336; }
        
        .diagram-container {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 20px;
            overflow-x: auto;
        }
        
        .mermaid {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 400px;
        }
        
        .warnings {
            margin-top: 20px;
        }
        
        .warning {
            padding: 12px;
            background-color: var(--vscode-inputValidation-warningBackground);
            border: 1px solid var(--vscode-inputValidation-warningBorder);
            border-radius: 6px;
            margin-bottom: 10px;
        }
        
        .warning-title {
            font-weight: 600;
            margin-bottom: 5px;
        }
        
        .code-block {
            background-color: var(--vscode-textCodeBlock-background);
            border: 1px solid var(--vscode-editorWidget-border);
            border-radius: 4px;
            padding: 15px;
            margin-top: 20px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            overflow-x: auto;
            white-space: pre-wrap;
        }
        
        .hidden {
            display: none;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="title">${title}</h1>
        <div class="actions">
            <button class="btn" onclick="exportDiagram('svg')">Export SVG</button>
            <button class="btn" onclick="exportDiagram('png')">Export PNG</button>
            <button class="btn" onclick="copyDiagram()">Copy Code</button>
            <button class="btn" onclick="toggleCode()">Toggle Code</button>
        </div>
    </div>
    
    <div class="stats">
        <div class="stat-card">
            <div class="stat-title">📊 Total Nodes</div>
            <div class="stat-value">${stats.totalNodes}</div>
            <div class="complexity-indicator">
                <div class="complexity-dot ${this.getComplexityClass(
                  stats.totalNodes,
                  "nodes"
                )}"></div>
                <span>${this.getComplexityLabel(
                  stats.totalNodes,
                  "nodes"
                )}</span>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-title">🔗 Total Connections</div>
            <div class="stat-value">${stats.totalEdges}</div>
            <div class="complexity-indicator">
                <div class="complexity-dot ${this.getComplexityClass(
                  stats.totalEdges,
                  "edges"
                )}"></div>
                <span>${this.getComplexityLabel(
                  stats.totalEdges,
                  "edges"
                )}</span>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-title">🌐 Endpoints</div>
            <div class="stat-value">${stats.rootNodes}</div>
            <div class="complexity-indicator">
                <div class="complexity-dot complexity-low"></div>
                <span>Entry Points</span>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-title">📏 Avg Depth</div>
            <div class="stat-value">${stats.averageDepth.toFixed(1)}</div>
            <div class="complexity-indicator">
                <div class="complexity-dot ${this.getComplexityClass(
                  stats.averageDepth,
                  "depth"
                )}"></div>
                <span>${this.getComplexityLabel(
                  stats.averageDepth,
                  "depth"
                )}</span>
            </div>
        </div>
        ${
          stats.circularDependencies > 0
            ? `
        <div class="stat-card" style="border-left-color: #f44336;">
            <div class="stat-title">⚠️ Circular Deps</div>
            <div class="stat-value" style="color: #f44336;">${stats.circularDependencies}</div>
            <div class="complexity-indicator">
                <div class="complexity-dot complexity-high"></div>
                <span>Needs Attention</span>
            </div>
        </div>
        `
            : ""
        }
    </div>
    
    ${
      circularDeps.length > 0
        ? `
    <div class="warnings">
        <div class="warning">
            <div class="warning-title">⚠️ Circular Dependencies Detected</div>
            <div>Found ${circularDeps.length} circular dependency path(s). This may indicate architectural issues.</div>
        </div>
    </div>
    `
        : ""
    }
    
    <div class="diagram-container">
        <div class="mermaid" id="mermaid-diagram">
${mermaidCode}
        </div>
    </div>
    
    <div class="code-block hidden" id="code-block">${mermaidCode}</div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        // Initialize Mermaid with dark theme
        mermaid.initialize({ 
            startOnLoad: true, 
            theme: 'dark',
            themeVariables: {
                darkMode: true,
                background: '#2d3748',
                primaryColor: '#3b82f6',
                primaryTextColor: '#ffffff',
                primaryBorderColor: '#3b82f6',
                lineColor: '#94a3b8',
                secondaryColor: '#4a5568',
                tertiaryColor: '#2d3748',
                edgeLabelBackground: '#2d3748',
                clusterBkg: '#374151',
                clusterBorder: '#6b7280',
                defaultLinkColor: '#94a3b8',
                titleColor: '#ffffff',
                textColor: '#ffffff'
            },
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis'
            }
        });
        
        // Function to open file (called from Mermaid click events)
        window.openFile = function(filePath, lineNumber) {
            vscode.postMessage({
                command: 'openFile',
                filePath: filePath,
                lineNumber: lineNumber
            });
        };
        
        // Export diagram function
        function exportDiagram(format) {
            const svg = document.querySelector('#mermaid-diagram svg');
            if (!svg) {
                console.error('No SVG found to export');
                return;
            }
            
            vscode.postMessage({
                command: 'exportDiagram',
                svg: svg.outerHTML,
                format: format
            });
        }
        
        // Copy diagram code function
        function copyDiagram() {
            const mermaidCode = \`${mermaidCode}\`;
            vscode.postMessage({
                command: 'copyDiagram',
                mermaidCode: mermaidCode
            });
        }
        
        // Toggle code view
        function toggleCode() {
            const codeBlock = document.getElementById('code-block');
            codeBlock.classList.toggle('hidden');
        }
        
        // Auto-resize diagram container on window resize
        window.addEventListener('resize', function() {
            // Force re-render if needed
            setTimeout(() => {
                mermaid.init();
            }, 100);
        });
    </script>
</body>
</html>`;
  }

  /**
   * Open file at specific line
   */
  private async openFile(filePath: string, lineNumber: number): Promise<void> {
    try {
      const uri = vscode.Uri.file(filePath);
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);

      const position = new vscode.Position(Math.max(0, lineNumber - 1), 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position));
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open file: ${error}`);
    }
  }

  /**
   * Export diagram
   */
  private async exportDiagram(
    svgContent: string,
    format: string
  ): Promise<void> {
    try {
      const saveOptions: vscode.SaveDialogOptions = {
        defaultUri: vscode.Uri.file(`call-graph.${format}`),
        filters: {
          Images: [format],
        },
      };

      const uri = await vscode.window.showSaveDialog(saveOptions);
      if (uri) {
        // For now, just save SVG content directly
        // In a full implementation, you might want to convert SVG to PNG
        await vscode.workspace.fs.writeFile(
          uri,
          Buffer.from(svgContent, "utf8")
        );
        vscode.window.showInformationMessage(
          `Diagram exported to ${uri.fsPath}`
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to export diagram: ${error}`);
    }
  }

  /**
   * Copy diagram code to clipboard
   */
  private async copyDiagramCode(mermaidCode: string): Promise<void> {
    try {
      await vscode.env.clipboard.writeText(mermaidCode);
      vscode.window.showInformationMessage("Mermaid code copied to clipboard");
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to copy code: ${error}`);
    }
  }

  /**
   * Dispose of the webview
   */
  public dispose(): void {
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }
  }
}
