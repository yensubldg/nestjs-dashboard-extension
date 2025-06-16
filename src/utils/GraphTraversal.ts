import {
  CallGraph,
  CallGraphNode,
  CallGraphEdge,
} from "../models/CallGraphModels";

export class GraphTraversal {
  /**
   * Find all nodes reachable from a given node within maxDepth
   */
  public static findReachableNodes(
    graph: CallGraph,
    startNodeId: string,
    maxDepth: number = 5
  ): CallGraphNode[] {
    const visited = new Set<string>();
    const reachable: CallGraphNode[] = [];

    const dfs = (nodeId: string, depth: number) => {
      if (depth > maxDepth || visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (node) {
        reachable.push(node);
      }

      // Find all outgoing edges
      const outgoingEdges = graph.edges.filter((e) => e.from === nodeId);
      for (const edge of outgoingEdges) {
        dfs(edge.to, depth + 1);
      }
    };

    dfs(startNodeId, 0);
    return reachable;
  }

  /**
   * Build a tree structure from a graph starting from root nodes
   */
  public static buildTreeFromGraph(
    graph: CallGraph,
    rootNodeId: string,
    maxDepth: number = 5
  ):
    | (CallGraphNode & { children: (CallGraphNode & { children: any[] })[] })
    | null {
    const visited = new Set<string>();

    const buildNode = (nodeId: string, depth: number): any => {
      if (depth > maxDepth || visited.has(nodeId)) {
        return null;
      }

      visited.add(nodeId);
      const node = graph.nodes.find((n) => n.id === nodeId);
      if (!node) return null;

      const children: any[] = [];
      const outgoingEdges = graph.edges.filter((e) => e.from === nodeId);

      for (const edge of outgoingEdges) {
        const childNode = buildNode(edge.to, depth + 1);
        if (childNode) {
          children.push(childNode);
        }
      }

      return { ...node, children };
    };

    return buildNode(rootNodeId, 0);
  }

  /**
   * Find the shortest path between two nodes
   */
  public static findShortestPath(
    graph: CallGraph,
    startNodeId: string,
    endNodeId: string
  ): string[] {
    const queue: Array<{ nodeId: string; path: string[] }> = [
      { nodeId: startNodeId, path: [startNodeId] },
    ];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (nodeId === endNodeId) {
        return path;
      }

      if (visited.has(nodeId)) {
        continue;
      }

      visited.add(nodeId);

      const outgoingEdges = graph.edges.filter((e) => e.from === nodeId);
      for (const edge of outgoingEdges) {
        queue.push({
          nodeId: edge.to,
          path: [...path, edge.to],
        });
      }
    }

    return []; // No path found
  }

  /**
   * Detect circular dependencies in the graph
   */
  public static detectCircularDependencies(graph: CallGraph): string[][] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];
    const currentPath: string[] = [];

    const dfs = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = currentPath.indexOf(nodeId);
        if (cycleStart !== -1) {
          cycles.push(currentPath.slice(cycleStart).concat(nodeId));
        }
        return true;
      }

      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);
      currentPath.push(nodeId);

      const outgoingEdges = graph.edges.filter((e) => e.from === nodeId);
      for (const edge of outgoingEdges) {
        if (dfs(edge.to)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      currentPath.pop();
      return false;
    };

    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id);
      }
    }

    return cycles;
  }

  /**
   * Group nodes by their type
   */
  public static groupNodesByType(
    nodes: CallGraphNode[]
  ): Map<string, CallGraphNode[]> {
    const groups = new Map<string, CallGraphNode[]>();

    for (const node of nodes) {
      if (!groups.has(node.type)) {
        groups.set(node.type, []);
      }
      groups.get(node.type)!.push(node);
    }

    return groups;
  }

  /**
   * Calculate graph statistics
   */
  public static calculateGraphStats(graph: CallGraph) {
    const nodesByType = this.groupNodesByType(graph.nodes);
    const edgesByType = new Map<string, CallGraphEdge[]>();

    for (const edge of graph.edges) {
      if (!edgesByType.has(edge.type)) {
        edgesByType.set(edge.type, []);
      }
      edgesByType.get(edge.type)!.push(edge);
    }

    return {
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
      nodesByType: Array.from(nodesByType.entries()).reduce(
        (acc, [type, nodes]) => {
          acc[type] = nodes.length;
          return acc;
        },
        {} as Record<string, number>
      ),
      edgesByType: Array.from(edgesByType.entries()).reduce(
        (acc, [type, edges]) => {
          acc[type] = edges.length;
          return acc;
        },
        {} as Record<string, number>
      ),
      rootNodes: graph.rootNodes.length,
      averageDepth: this.calculateAverageDepth(graph),
      circularDependencies: this.detectCircularDependencies(graph).length,
    };
  }

  /**
   * Calculate average depth of the graph from root nodes
   */
  private static calculateAverageDepth(graph: CallGraph): number {
    if (graph.rootNodes.length === 0) return 0;

    let totalDepth = 0;
    let totalPaths = 0;

    for (const rootId of graph.rootNodes) {
      const depths = this.getAllDepthsFromRoot(graph, rootId);
      totalDepth += depths.reduce((sum, depth) => sum + depth, 0);
      totalPaths += depths.length;
    }

    return totalPaths > 0 ? totalDepth / totalPaths : 0;
  }

  /**
   * Get all depths from a root node to leaf nodes
   */
  private static getAllDepthsFromRoot(
    graph: CallGraph,
    rootId: string
  ): number[] {
    const depths: number[] = [];
    const visited = new Set<string>();

    const dfs = (nodeId: string, depth: number) => {
      if (visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);
      const outgoingEdges = graph.edges.filter((e) => e.from === nodeId);

      if (outgoingEdges.length === 0) {
        // Leaf node
        depths.push(depth);
      } else {
        for (const edge of outgoingEdges) {
          dfs(edge.to, depth + 1);
        }
      }
    };

    dfs(rootId, 0);
    return depths;
  }
}
