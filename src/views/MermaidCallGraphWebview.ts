import * as vscode from "vscode";
import {
  CallGraph,
  CallGraphNode,
  CallGraphEdge,
} from "../models/CallGraphModels";
import {
  SequenceDiagram,
  SequenceMessage,
  SequenceNote,
  SequenceParticipant,
} from "../models/SequenceModels";
import { GraphTraversal } from "../utils/GraphTraversal";
import { SequenceHelpers } from "../utils/SequenceHelpers";

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
            const content = message.data || message.svg;
            const filename = message.filename || "call-graph";
            this.exportDiagram(content, message.format, filename);
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
        :root {
            --vscode-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            --vscode-font-size: 13px;
            --vscode-foreground: #cccccc;
            --vscode-background: #1e1e1e;
            --vscode-button-background: #0e639c;
            --vscode-button-foreground: #ffffff;
            --vscode-button-hoverBackground: #1177bb;
            --vscode-inputValidation-errorBackground: #5a1d1d;
            --vscode-inputValidation-errorBorder: #be1100;
            --vscode-inputValidation-warningBackground: #5a5a1d;
            --vscode-inputValidation-warningBorder: #be9100;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-background);
            margin: 0;
            padding: 20px;
            line-height: 1.6;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid #333;
        }

        .title {
            margin: 0;
            font-size: 1.5em;
            font-weight: 600;
        }

        .actions {
            display: flex;
            gap: 10px;
        }

        .btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s;
        }

        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }

        .stat-card {
            background-color: #2d2d30;
            border: 1px solid #3c3c3c;
            border-radius: 6px;
            padding: 15px;
            border-left: 4px solid #007acc;
        }

        .stat-title {
            font-size: 12px;
            text-transform: uppercase;
            margin-bottom: 8px;
            opacity: 0.8;
        }

        .stat-value {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 8px;
        }

        .complexity-indicator {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
        }

        .complexity-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }

        .complexity-low { background-color: #22c55e; }
        .complexity-medium { background-color: #eab308; }
        .complexity-high { background-color: #ef4444; }

        .diagram-container {
            background-color: #ffffff;
            border-radius: 8px;
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
            margin-bottom: 20px;
        }

        .warning {
            background-color: var(--vscode-inputValidation-warningBackground);
            border: 1px solid var(--vscode-inputValidation-warningBorder);
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 10px;
        }

        .warning-title {
            font-weight: 600;
            margin-bottom: 5px;
        }

        .code-block {
            background-color: #2d2d30;
            border: 1px solid #3c3c3c;
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
        <h1 class="title">🔄 ${title}</h1>
        <div class="actions">
            <button class="btn" onclick="exportDiagram('svg')">📄 Export SVG</button>
            <button class="btn" onclick="exportDiagram('png')">🖼️ Export PNG</button>
            <button class="btn" onclick="copyDiagram()">📋 Copy Code</button>
            <button class="btn" onclick="toggleCode()">🔍 Toggle Code</button>
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
            
            if (format === 'png') {
                // Convert SVG to high-quality PNG
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const img = new Image();
                
                // Get actual SVG dimensions from the rendered element
                const svgRect = svg.getBoundingClientRect();
                let svgWidth = Math.max(
                    parseInt(svg.getAttribute('width')) || 0,
                    parseInt(svg.style.width) || 0,
                    svgRect.width || 0,
                    1200 // Minimum width for quality
                );
                let svgHeight = Math.max(
                    parseInt(svg.getAttribute('height')) || 0,
                    parseInt(svg.style.height) || 0,
                    svgRect.height || 0,
                    800 // Minimum height for quality
                );
                
                // Use very high scaling for crisp output
                const baseScale = 4; // 4x base scaling for high quality
                const dpiScale = window.devicePixelRatio || 1;
                const finalScale = Math.max(baseScale, dpiScale * 2);
                
                // Set actual canvas dimensions (what gets saved)
                canvas.width = svgWidth * finalScale;
                canvas.height = svgHeight * finalScale;
                
                // Scale the drawing context
                ctx.scale(finalScale, finalScale);
                
                // Enable highest quality settings
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.textRenderingOptimization = 'optimizeQuality';
                
                // Fill with white background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, svgWidth, svgHeight);
                
                // Create optimized SVG with proper styling
                const svgClone = svg.cloneNode(true);
                svgClone.setAttribute('width', svgWidth.toString());
                svgClone.setAttribute('height', svgHeight.toString());
                svgClone.setAttribute('viewBox', '0 0 ' + svgWidth + ' ' + svgHeight);
                
                const svgString = new XMLSerializer().serializeToString(svgClone);
                const svgBlob = new Blob([svgString], {
                    type: 'image/svg+xml;charset=utf-8'
                });
                const svgUrl = URL.createObjectURL(svgBlob);
                
                img.onload = function() {
                    // Clear and redraw with white background
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, svgWidth, svgHeight);
                    
                    // Draw the SVG image
                    ctx.drawImage(img, 0, 0, svgWidth, svgHeight);
                    
                    // Convert to blob with highest quality
                    canvas.toBlob(function(blob) {
                        if (blob) {
                            const reader = new FileReader();
                            reader.onload = function() {
                                vscode.postMessage({
                                    command: 'exportDiagram',
                                    data: reader.result,
                                    format: format,
                                    filename: 'call-graph'
                                });
                            };
                            reader.readAsDataURL(blob);
                        }
                    }, 'image/png', 1.0);
                    
                    URL.revokeObjectURL(svgUrl);
                };
                
                img.onerror = function(e) {
                    console.error('Failed to load SVG for PNG conversion:', e);
                    URL.revokeObjectURL(svgUrl);
                    // Fallback: try direct SVG export
                    vscode.postMessage({
                        command: 'exportDiagram',
                        svg: svg.outerHTML,
                        format: 'svg',
                        filename: 'call-graph'
                    });
                };
                
                img.src = svgUrl;
            } else {
                // SVG export
                vscode.postMessage({
                    command: 'exportDiagram',
                    svg: svg.outerHTML,
                    format: format,
                    filename: 'call-graph'
                });
            }
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
    content: string,
    format: string,
    filename?: string
  ): Promise<void> {
    try {
      const defaultFilename = filename || "diagram";
      const saveOptions: vscode.SaveDialogOptions = {
        defaultUri: vscode.Uri.file(`${defaultFilename}.${format}`),
        filters: {
          Images: [format],
        },
      };

      const uri = await vscode.window.showSaveDialog(saveOptions);
      if (uri) {
        let buffer: Buffer;

        if (format === "png" && content.startsWith("data:image/png;base64,")) {
          // Handle PNG data URL
          const base64Data = content.replace("data:image/png;base64,", "");
          buffer = Buffer.from(base64Data, "base64");
        } else {
          // Handle SVG content
          buffer = Buffer.from(content, "utf8");
        }

        await vscode.workspace.fs.writeFile(uri, buffer);
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
   * Show sequence diagram
   */
  public showSequence(
    sequenceDiagram: SequenceDiagram,
    title: string = "Sequence Diagram"
  ): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        "sequenceDiagram",
        title,
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [this.extensionUri],
        }
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });

      this.panel.webview.onDidReceiveMessage((message) => {
        switch (message.command) {
          case "openFile":
            this.openFile(message.filePath, message.lineNumber);
            break;
          case "exportDiagram":
            const content = message.data || message.svg;
            const filename = message.filename || "sequence-diagram";
            this.exportDiagram(content, message.format, filename);
            break;
          case "copyDiagram":
            this.copyDiagramCode(message.mermaidCode);
            break;
        }
      });
    }

    this.updateSequenceWebviewContent(sequenceDiagram, title);
  }

  /**
   * Update webview content with sequence diagram
   */
  private updateSequenceWebviewContent(
    sequenceDiagram: SequenceDiagram,
    title: string
  ): void {
    if (!this.panel) return;

    const mermaidCode = this.generateMermaidSequence(sequenceDiagram);
    const stats = SequenceHelpers.getSequenceStatistics(sequenceDiagram);
    const validationErrors =
      SequenceHelpers.validateSequenceDiagram(sequenceDiagram);

    this.panel.title = title;
    this.panel.webview.html = this.getSequenceWebviewContent(
      mermaidCode,
      title,
      stats,
      validationErrors
    );
  }

  /**
   * Generate Mermaid sequence diagram
   */
  public generateMermaidSequence(sequenceDiagram: SequenceDiagram): string {
    const lines: string[] = [];

    lines.push("sequenceDiagram");
    lines.push("    autonumber");
    lines.push("");

    // Add participants
    for (const participant of sequenceDiagram.participants) {
      const sanitizedId = this.sanitizeParticipantId(participant.id);
      const sanitizedName = SequenceHelpers.sanitizeText(participant.name);

      if (
        participant.name !== participant.id &&
        sanitizedName !== sanitizedId
      ) {
        lines.push(`    participant ${sanitizedId} as ${sanitizedName}`);
      } else {
        lines.push(`    participant ${sanitizedId}`);
      }
    }

    lines.push("");

    // Sort messages and notes by order
    const sortedItems = SequenceHelpers.sortMessagesAndNotes(
      sequenceDiagram.messages,
      sequenceDiagram.notes
    );

    // Add messages and notes
    for (const item of sortedItems) {
      if (item.itemType === "message") {
        const message = item as SequenceMessage;
        const arrow = this.getSequenceArrow(message.type);
        const sanitizedMessage = SequenceHelpers.sanitizeText(message.message);
        const fromId = this.sanitizeParticipantId(message.from);
        const toId = this.sanitizeParticipantId(message.to);
        lines.push(`    ${fromId}${arrow}${toId}: ${sanitizedMessage}`);

        // Note: Activation/deactivation removed for syntax compatibility
      } else if (item.itemType === "note") {
        const note = item as SequenceNote;
        const sanitizedContent = SequenceHelpers.sanitizeText(note.content);
        const participantId = this.sanitizeParticipantId(note.participant);
        lines.push(`    Note over ${participantId}: ${sanitizedContent}`);
      }
    }

    // Note: Activation/deactivation logic removed for syntax compatibility

    return lines.join("\n");
  }

  /**
   * Get sequence arrow based on message type
   */
  private getSequenceArrow(messageType: string): string {
    switch (messageType) {
      case "sync":
        return "->>";
      case "async":
        return "-)>";
      case "return":
        return "-->>";
      default:
        return "->";
    }
  }

  /**
   * Sanitize participant ID for Mermaid syntax
   */
  private sanitizeParticipantId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_]/g, "_");
  }

  /**
   * Get sequence webview content
   */
  private getSequenceWebviewContent(
    mermaidCode: string,
    title: string,
    stats: any,
    validationErrors: string[]
  ): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js"></script>
    <style>
        :root {
            --vscode-font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            --vscode-font-size: 13px;
            --vscode-foreground: #cccccc;
            --vscode-background: #1e1e1e;
            --vscode-button-background: #0e639c;
            --vscode-button-foreground: #ffffff;
            --vscode-button-hoverBackground: #1177bb;
            --vscode-inputValidation-errorBackground: #5a1d1d;
            --vscode-inputValidation-errorBorder: #be1100;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-background);
            margin: 0;
            padding: 20px;
            line-height: 1.6;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid #333;
        }

        .title {
            margin: 0;
            font-size: 1.5em;
            font-weight: 600;
        }

        .actions {
            display: flex;
            gap: 10px;
        }

        .btn {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            transition: background-color 0.2s;
        }

        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }

        .stat-card {
            background-color: #2d2d30;
            border: 1px solid #3c3c3c;
            border-radius: 6px;
            padding: 15px;
            border-left: 4px solid #007acc;
        }

        .stat-title {
            font-size: 12px;
            text-transform: uppercase;
            margin-bottom: 8px;
            opacity: 0.8;
        }

        .stat-value {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 8px;
        }

        .complexity-indicator {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
        }

        .complexity-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }

        .complexity-low { background-color: #22c55e; }
        .complexity-medium { background-color: #eab308; }
        .complexity-high { background-color: #ef4444; }

        .warnings {
            margin-bottom: 20px;
        }

        .warning {
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 10px;
        }

        .warning-title {
            font-weight: 600;
            margin-bottom: 5px;
        }

        .diagram-container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            overflow-x: auto;
        }

        .mermaid {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 300px;
        }

        .code-block {
            background-color: #2d2d30;
            border: 1px solid #3c3c3c;
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
        <h1 class="title">📈 ${title}</h1>
        <div class="actions">
            <button class="btn" onclick="exportDiagram('svg')">📄 Export SVG</button>
            <button class="btn" onclick="exportDiagram('png')">🖼️ Export PNG</button>
            <button class="btn" onclick="copyDiagram()">📋 Copy Code</button>
            <button class="btn" onclick="toggleCode()">🔍 Toggle Code</button>
        </div>
    </div>
    
    <div class="stats">
        <div class="stat-card">
            <div class="stat-title">👥 Participants</div>
            <div class="stat-value">${stats.totalParticipants}</div>
            <div class="complexity-indicator">
                <div class="complexity-dot ${this.getComplexityClass(
                  stats.totalParticipants,
                  "participants"
                )}"></div>
                <span>${this.getComplexityLabel(
                  stats.totalParticipants,
                  "participants"
                )}</span>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-title">💬 Messages</div>
            <div class="stat-value">${stats.totalMessages}</div>
            <div class="complexity-indicator">
                <div class="complexity-dot ${this.getComplexityClass(
                  stats.totalMessages,
                  "messages"
                )}"></div>
                <span>${this.getComplexityLabel(
                  stats.totalMessages,
                  "messages"
                )}</span>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-title">📝 Notes</div>
            <div class="stat-value">${stats.totalNotes}</div>
            <div class="complexity-indicator">
                <div class="complexity-dot complexity-low"></div>
                <span>Info</span>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-title">⏱️ Est. Duration</div>
            <div class="stat-value">${stats.estimatedDuration}ms</div>
            <div class="complexity-indicator">
                <div class="complexity-dot ${this.getComplexityClass(
                  stats.estimatedDuration,
                  "duration"
                )}"></div>
                <span>${this.getComplexityLabel(
                  stats.estimatedDuration,
                  "duration"
                )}</span>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-title">🔄 Complexity</div>
            <div class="stat-value">${stats.complexity.level}</div>
            <div class="complexity-indicator">
                <div class="complexity-dot complexity-${stats.complexity.level.toLowerCase()}"></div>
                <span>Score: ${stats.complexity.score}</span>
            </div>
        </div>
    </div>
    
    ${
      validationErrors.length > 0
        ? `
    <div class="warnings">
        <div class="warning">
            <div class="warning-title">⚠️ Validation Issues</div>
            <ul>
                ${validationErrors.map((error) => `<li>${error}</li>`).join("")}
            </ul>
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
        
        // Initialize Mermaid with sequence theme
        mermaid.initialize({ 
            startOnLoad: true, 
            theme: 'base',
            sequence: {
                actorMargin: 50,
                width: 150,
                height: 65,
                boxMargin: 10,
                boxTextMargin: 5,
                noteMargin: 10,
                messageMargin: 35,
                mirrorActors: true,
                bottomMarginAdj: 1,
                useMaxWidth: true,
                rightAngles: false,
                showSequenceNumbers: true
            },
            themeVariables: {
                background: '#ffffff',
                primaryColor: '#3b82f6',
                primaryTextColor: '#1f2937',
                primaryBorderColor: '#3b82f6',
                lineColor: '#6b7280',
                secondaryColor: '#f3f4f6',
                tertiaryColor: '#e5e7eb',
                actorBkg: '#dbeafe',
                actorBorder: '#3b82f6',
                actorTextColor: '#1f2937',
                activationBkgColor: '#fef3c7',
                activationBorderColor: '#f59e0b',
                sequenceNumberColor: '#ffffff'
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
            
                         if (format === 'png') {
                 // Convert SVG to high-quality PNG
                 const canvas = document.createElement('canvas');
                 const ctx = canvas.getContext('2d');
                 const img = new Image();
                 
                 // Get SVG dimensions and ensure minimum quality size
                 const svgRect = svg.getBoundingClientRect();
                 const svgWidth = Math.max(parseInt(svg.getAttribute('width')) || svgRect.width || 800, 1200);
                 const svgHeight = Math.max(parseInt(svg.getAttribute('height')) || svgRect.height || 600, 800);
                 
                 // Use 4x scaling for very high quality
                 const qualityScale = 4;
                 
                 // Set canvas dimensions
                 canvas.width = svgWidth * qualityScale;
                 canvas.height = svgHeight * qualityScale;
                 
                 // Scale context
                 ctx.scale(qualityScale, qualityScale);
                 ctx.imageSmoothingEnabled = true;
                 ctx.imageSmoothingQuality = 'high';
                 
                 // White background
                 ctx.fillStyle = '#ffffff';
                 ctx.fillRect(0, 0, svgWidth, svgHeight);
                 
                 // Create SVG with proper dimensions
                 const svgClone = svg.cloneNode(true);
                 svgClone.setAttribute('width', svgWidth.toString());
                 svgClone.setAttribute('height', svgHeight.toString());
                 
                 const svgString = new XMLSerializer().serializeToString(svgClone);
                 const svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
                 const svgUrl = URL.createObjectURL(svgBlob);
                 
                 img.onload = function() {
                     ctx.fillStyle = '#ffffff';
                     ctx.fillRect(0, 0, svgWidth, svgHeight);
                     ctx.drawImage(img, 0, 0, svgWidth, svgHeight);
                     
                     canvas.toBlob(function(blob) {
                         if (blob) {
                             const reader = new FileReader();
                             reader.onload = function() {
                                 vscode.postMessage({
                                     command: 'exportDiagram',
                                     data: reader.result,
                                     format: format,
                                     filename: 'sequence-diagram'
                                 });
                             };
                             reader.readAsDataURL(blob);
                         }
                     }, 'image/png', 1.0);
                     
                     URL.revokeObjectURL(svgUrl);
                 };
                 
                 img.onerror = function() {
                     console.error('PNG conversion failed, falling back to SVG');
                     URL.revokeObjectURL(svgUrl);
                     vscode.postMessage({
                         command: 'exportDiagram',
                         svg: svg.outerHTML,
                         format: 'svg',
                         filename: 'sequence-diagram'
                     });
                 };
                 
                 img.src = svgUrl;
             } else {
                // SVG export
                vscode.postMessage({
                    command: 'exportDiagram',
                    svg: svg.outerHTML,
                    format: format,
                    filename: 'sequence-diagram'
                });
            }
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
    </script>
</body>
</html>`;
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
