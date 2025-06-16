export interface CallGraphNode {
  id: string;
  name: string;
  type:
    | "endpoint"
    | "service"
    | "repository"
    | "entity"
    | "dto"
    | "guard"
    | "pipe"
    | "interceptor";
  filePath: string;
  lineNumber: number;
  metadata?: {
    httpMethod?: string;
    route?: string;
    decorators?: string[];
    parameters?: string[];
    returnType?: string;
    className?: string;
    methodName?: string;
    isDemoData?: boolean;
    injectionToken?: string;
    method?: string;
  };
}

export interface CallGraphEdge {
  from: string; // source node id
  to: string; // target node id
  type:
    | "calls"
    | "injects"
    | "uses"
    | "returns"
    | "guards"
    | "pipes"
    | "intercepts";
  metadata?: {
    method?: string;
    parameter?: string;
    injectionToken?: string;
    isDemoData?: boolean;
  };
}

export interface CallGraph {
  nodes: CallGraphNode[];
  edges: CallGraphEdge[];
  rootNodes: string[]; // endpoint node ids
}

export interface CallGraphTreeNode {
  id: string;
  label: string;
  type: CallGraphNode["type"];
  filePath?: string;
  lineNumber?: number;
  children?: CallGraphTreeNode[];
  metadata?: CallGraphNode["metadata"];
}

export interface CallGraphConfig {
  maxDepth: number;
  includeEntities: boolean;
  includeGuards: boolean;
  includePipes: boolean;
  includeInterceptors: boolean;
  visualizer: "mermaid" | "cytoscape" | "tree";
}
