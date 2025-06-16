import { CallGraphNode, CallGraphEdge } from "../models/CallGraphModels";

export class VisualizationHelpers {
  /**
   * Generate a unique color for each node type
   */
  public static getNodeTypeColor(nodeType: string): string {
    const colors: Record<string, string> = {
      endpoint: "#e1f5fe",
      service: "#e8f5e8",
      repository: "#fff3e0",
      entity: "#f3e5f5",
      dto: "#fff8e1",
      guard: "#ffebee",
      pipe: "#e0f2f1",
      interceptor: "#fce4ec",
    };

    return colors[nodeType] || "#f5f5f5";
  }

  /**
   * Generate a unique border color for each node type
   */
  public static getNodeTypeBorderColor(nodeType: string): string {
    const colors: Record<string, string> = {
      endpoint: "#0277bd",
      service: "#2e7d32",
      repository: "#f57c00",
      entity: "#7b1fa2",
      dto: "#f9a825",
      guard: "#c62828",
      pipe: "#00695c",
      interceptor: "#ad1457",
    };

    return colors[nodeType] || "#666666";
  }

  /**
   * Generate an icon for each node type
   */
  public static getNodeTypeIcon(nodeType: string): string {
    const icons: Record<string, string> = {
      endpoint: "🌐",
      service: "⚙️",
      repository: "💾",
      entity: "📋",
      dto: "📄",
      guard: "🛡️",
      pipe: "🔧",
      interceptor: "⚡",
    };

    return icons[nodeType] || "📦";
  }

  /**
   * Truncate long labels for better visualization
   */
  public static truncateLabel(label: string, maxLength: number = 30): string {
    if (label.length <= maxLength) {
      return label;
    }

    return label.substring(0, maxLength - 3) + "...";
  }

  /**
   * Sanitize text for use in various formats
   */
  public static sanitizeText(text: string): string {
    return text.replace(/[<>'"&]/g, (match) => {
      const entities: Record<string, string> = {
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
        "&": "&amp;",
      };
      return entities[match] || match;
    });
  }

  /**
   * Generate a readable path from node chain
   */
  public static generatePathDescription(nodes: CallGraphNode[]): string {
    if (nodes.length === 0) {
      return "Empty path";
    }

    if (nodes.length === 1) {
      return nodes[0].name;
    }

    const pathParts = nodes.map((node) => {
      const icon = this.getNodeTypeIcon(node.type);
      return `${icon} ${node.name}`;
    });

    return pathParts.join(" → ");
  }

  /**
   * Calculate layout suggestions based on graph size
   */
  public static suggestLayout(
    nodeCount: number,
    edgeCount: number
  ): {
    direction: "TD" | "LR" | "BT" | "RL";
    preferredWidth: number;
    preferredHeight: number;
  } {
    // For small graphs, use top-down layout
    if (nodeCount <= 10) {
      return {
        direction: "TD",
        preferredWidth: 800,
        preferredHeight: 600,
      };
    }

    // For medium graphs, use left-right if many levels
    if (nodeCount <= 30) {
      const avgConnections = edgeCount / nodeCount;
      return {
        direction: avgConnections > 2 ? "LR" : "TD",
        preferredWidth: 1200,
        preferredHeight: 800,
      };
    }

    // For large graphs, use left-right to maximize space usage
    return {
      direction: "LR",
      preferredWidth: 1600,
      preferredHeight: 1000,
    };
  }

  /**
   * Group nodes by their hierarchy level
   */
  public static groupNodesByLevel(
    nodes: CallGraphNode[],
    edges: CallGraphEdge[],
    rootNodes: string[]
  ): Map<number, CallGraphNode[]> {
    const levels = new Map<number, CallGraphNode[]>();
    const nodeToLevel = new Map<string, number>();
    const visited = new Set<string>();

    // Initialize root nodes at level 0
    for (const rootId of rootNodes) {
      nodeToLevel.set(rootId, 0);
      if (!levels.has(0)) {
        levels.set(0, []);
      }
      const rootNode = nodes.find((n) => n.id === rootId);
      if (rootNode) {
        levels.get(0)!.push(rootNode);
      }
    }

    // BFS to assign levels
    const queue = [...rootNodes.map((id) => ({ id, level: 0 }))];

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;

      if (visited.has(id)) {
        continue;
      }
      visited.add(id);

      // Find children
      const childEdges = edges.filter((e) => e.from === id);
      for (const edge of childEdges) {
        const childLevel = level + 1;

        // Only update level if this is a shorter path or node hasn't been assigned yet
        if (
          !nodeToLevel.has(edge.to) ||
          nodeToLevel.get(edge.to)! > childLevel
        ) {
          nodeToLevel.set(edge.to, childLevel);

          if (!levels.has(childLevel)) {
            levels.set(childLevel, []);
          }

          const childNode = nodes.find((n) => n.id === edge.to);
          if (childNode) {
            // Remove from previous level if exists
            for (const [lvl, levelNodes] of levels.entries()) {
              const index = levelNodes.findIndex((n) => n.id === edge.to);
              if (index !== -1) {
                levelNodes.splice(index, 1);
              }
            }

            levels.get(childLevel)!.push(childNode);
          }

          queue.push({ id: edge.to, level: childLevel });
        }
      }
    }

    return levels;
  }

  /**
   * Calculate graph complexity metrics
   */
  public static calculateComplexity(
    nodes: CallGraphNode[],
    edges: CallGraphEdge[]
  ): {
    cyclomaticComplexity: number;
    averageDegree: number;
    maxDepth: number;
    branchingFactor: number;
  } {
    const nodeCount = nodes.length;
    const edgeCount = edges.length;

    // Calculate cyclomatic complexity: E - N + 2P (where P is connected components)
    const cyclomaticComplexity = Math.max(1, edgeCount - nodeCount + 2);

    // Calculate average degree (connections per node)
    const averageDegree = nodeCount > 0 ? (edgeCount * 2) / nodeCount : 0;

    // Calculate max depth using BFS from nodes with no incoming edges
    const incomingCount = new Map<string, number>();
    nodes.forEach((n) => incomingCount.set(n.id, 0));
    edges.forEach((e) =>
      incomingCount.set(e.to, (incomingCount.get(e.to) || 0) + 1)
    );

    const rootNodes = nodes.filter((n) => incomingCount.get(n.id) === 0);
    let maxDepth = 0;

    for (const root of rootNodes) {
      const depth = this.calculateDepthFromNode(root.id, edges, new Set());
      maxDepth = Math.max(maxDepth, depth);
    }

    // Calculate branching factor (average outgoing connections)
    const outgoingCount = new Map<string, number>();
    nodes.forEach((n) => outgoingCount.set(n.id, 0));
    edges.forEach((e) =>
      outgoingCount.set(e.from, (outgoingCount.get(e.from) || 0) + 1)
    );

    const totalBranching = Array.from(outgoingCount.values()).reduce(
      (sum, count) => sum + count,
      0
    );
    const branchingFactor = nodeCount > 0 ? totalBranching / nodeCount : 0;

    return {
      cyclomaticComplexity,
      averageDegree,
      maxDepth,
      branchingFactor,
    };
  }

  /**
   * Calculate depth from a specific node
   */
  private static calculateDepthFromNode(
    nodeId: string,
    edges: CallGraphEdge[],
    visited: Set<string>
  ): number {
    if (visited.has(nodeId)) {
      return 0; // Avoid infinite recursion
    }

    visited.add(nodeId);

    const outgoingEdges = edges.filter((e) => e.from === nodeId);
    if (outgoingEdges.length === 0) {
      return 1; // Leaf node
    }

    let maxChildDepth = 0;
    for (const edge of outgoingEdges) {
      const childDepth = this.calculateDepthFromNode(
        edge.to,
        edges,
        new Set(visited)
      );
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }

    return 1 + maxChildDepth;
  }

  /**
   * Generate color palette for different visualizations
   */
  public static generateColorPalette(count: number): string[] {
    const baseColors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#96CEB4",
      "#FFEAA7",
      "#DDA0DD",
      "#98D8C8",
      "#F7DC6F",
      "#BB8FCE",
      "#85C1E9",
    ];

    if (count <= baseColors.length) {
      return baseColors.slice(0, count);
    }

    // Generate additional colors using HSL
    const colors = [...baseColors];
    const remaining = count - baseColors.length;

    for (let i = 0; i < remaining; i++) {
      const hue = ((i * 360) / remaining) % 360;
      const saturation = 60 + (i % 3) * 15; // 60%, 75%, 90%
      const lightness = 65 + (i % 2) * 10; // 65%, 75%
      colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }

    return colors;
  }
}
