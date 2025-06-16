import * as path from "path";
import { workspace } from "vscode";
import {
  Project,
  SyntaxKind,
  ClassDeclaration,
  MethodDeclaration,
} from "ts-morph";
import { ConfigurationManager } from "../ConfigurationManager";
import { EndpointInfo } from "./NestParser";
import {
  DependencyTracer,
  DependencyInfo,
  MethodCallInfo,
} from "./DependencyTracer";
import {
  CallGraph,
  CallGraphNode,
  CallGraphEdge,
  CallGraphConfig,
} from "../models/CallGraphModels";

export class CallGraphParser {
  private config = ConfigurationManager.getInstance();
  private project: Project;
  private dependencyTracer: DependencyTracer;
  private nodeCache = new Map<string, CallGraphNode>();
  private processedFiles = new Set<string>();

  constructor() {
    const folders = workspace.workspaceFolders;
    const rootPath = folders?.[0]?.uri.fsPath || "";

    this.project = new Project({
      tsConfigFilePath: path.join(rootPath, "tsconfig.json"),
      skipAddingFilesFromTsConfig: true,
    });

    // Load source files based on configuration
    this.loadSourceFiles();
    this.dependencyTracer = new DependencyTracer(this.project);
  }

  /**
   * Build a call graph from endpoints
   */
  public buildCallGraph(
    endpoints?: EndpointInfo[],
    config?: Partial<CallGraphConfig>
  ): CallGraph {
    const graphConfig: CallGraphConfig = {
      maxDepth: 5,
      includeEntities: true,
      includeGuards: true,
      includePipes: true,
      includeInterceptors: true,
      visualizer: "mermaid",
      ...config,
    };

    const nodes: CallGraphNode[] = [];
    const edges: CallGraphEdge[] = [];
    const rootNodes: string[] = [];

    // Reset caches
    this.nodeCache.clear();
    this.processedFiles.clear();

    // If no endpoints provided, get all endpoints
    if (!endpoints) {
      // We'll get endpoints from the existing parser if needed
      // For now, let's focus on the ones provided
      return { nodes: [], edges: [], rootNodes: [] };
    }

    // Process each endpoint
    for (const endpoint of endpoints) {
      const endpointNode = this.createEndpointNode(endpoint);
      nodes.push(endpointNode);
      rootNodes.push(endpointNode.id);

      // Trace dependencies from this endpoint
      const { newNodes, newEdges } = this.traceEndpointDependencies(
        endpoint,
        endpointNode.id,
        graphConfig,
        0
      );

      nodes.push(...newNodes);
      edges.push(...newEdges);
    }

    // Remove duplicates
    const uniqueNodes = this.removeDuplicateNodes(nodes);
    const uniqueEdges = this.removeDuplicateEdges(edges);

    return {
      nodes: uniqueNodes,
      edges: uniqueEdges,
      rootNodes,
    };
  }

  /**
   * Build call graph for a single endpoint
   */
  public buildEndpointCallGraph(
    endpoint: EndpointInfo,
    config?: Partial<CallGraphConfig>
  ): CallGraph {
    return this.buildCallGraph([endpoint], config);
  }

  /**
   * Create an endpoint node from endpoint info
   */
  private createEndpointNode(endpoint: EndpointInfo): CallGraphNode {
    const nodeId = `endpoint:${endpoint.controller}:${endpoint.handlerName}:${endpoint.filePath}:${endpoint.lineNumber}`;

    if (this.nodeCache.has(nodeId)) {
      return this.nodeCache.get(nodeId)!;
    }

    const node: CallGraphNode = {
      id: nodeId,
      name: `${endpoint.method} ${endpoint.path}`,
      type: "endpoint",
      filePath: endpoint.filePath,
      lineNumber: endpoint.lineNumber,
      metadata: {
        httpMethod: endpoint.method,
        route: endpoint.path,
        className: endpoint.controller,
        methodName: endpoint.handlerName,
        decorators: [
          ...(endpoint.guards || []),
          ...(endpoint.pipes || []),
          ...(endpoint.interceptors || []),
        ],
      },
    };

    this.nodeCache.set(nodeId, node);
    return node;
  }

  /**
   * Trace dependencies from an endpoint
   */
  private traceEndpointDependencies(
    endpoint: EndpointInfo,
    parentNodeId: string,
    config: CallGraphConfig,
    currentDepth: number
  ): { newNodes: CallGraphNode[]; newEdges: CallGraphEdge[] } {
    const newNodes: CallGraphNode[] = [];
    const newEdges: CallGraphEdge[] = [];

    if (currentDepth >= config.maxDepth) {
      return { newNodes, newEdges };
    }

    try {
      const sourceFile = this.project.getSourceFile(endpoint.filePath);
      if (!sourceFile || this.processedFiles.has(endpoint.filePath)) {
        return { newNodes, newEdges };
      }

      this.processedFiles.add(endpoint.filePath);

      // Find the controller class
      const controllerClass = sourceFile.getClasses().find((cls) => {
        const className = cls.getName();
        return className === endpoint.controller;
      });

      if (!controllerClass) {
        return { newNodes, newEdges };
      }

      // Extract constructor dependencies
      const dependencies =
        this.dependencyTracer.extractConstructorDependencies(controllerClass);

      console.log(
        `[CallGraph] Found ${dependencies.length} dependencies for ${endpoint.controller}:`,
        dependencies.map((d) => `${d.serviceName} (${d.serviceType})`)
      );

      for (const dependency of dependencies) {
        const { serviceNode, serviceEdge } = this.processDependency(
          dependency,
          parentNodeId,
          config,
          currentDepth + 1
        );

        if (serviceNode && serviceEdge) {
          newNodes.push(serviceNode);
          newEdges.push(serviceEdge);

          // Recursively trace service dependencies
          if (
            dependency.serviceType === "service" &&
            currentDepth < config.maxDepth - 1
          ) {
            const servicePath = this.dependencyTracer.findServiceFile(
              dependency.serviceName
            );
            if (servicePath && !this.processedFiles.has(servicePath)) {
              console.log(
                `[CallGraph] Tracing service: ${dependency.serviceName} at ${servicePath}`
              );
              const { newNodes: serviceNodes, newEdges: serviceEdges } =
                this.traceServiceDependencies(
                  servicePath,
                  dependency.serviceName,
                  serviceNode.id,
                  config,
                  currentDepth + 1
                );
              newNodes.push(...serviceNodes);
              newEdges.push(...serviceEdges);
            } else if (!servicePath) {
              console.warn(
                `[CallGraph] Could not find service file for: ${dependency.serviceName}`
              );
            }
          }
        }
      }

      // Extract method calls from the endpoint handler
      const handlerMethod = controllerClass.getMethod(endpoint.handlerName);
      if (handlerMethod) {
        const methodCalls =
          this.dependencyTracer.extractMethodCalls(handlerMethod);

        for (const methodCall of methodCalls) {
          if (methodCall.targetObject !== "this") {
            // Find the corresponding dependency
            const dependency = dependencies.find(
              (dep) => dep.parameterName === methodCall.targetObject
            );
            if (dependency) {
              const targetNodeId = this.getServiceNodeId(
                dependency.serviceName,
                ""
              );
              const callEdge: CallGraphEdge = {
                from: parentNodeId,
                to: targetNodeId,
                type: "calls",
                metadata: {
                  method: methodCall.methodName,
                },
              };
              newEdges.push(callEdge);
            }
          }
        }
      }

      // Process guards, pipes, interceptors if enabled
      if (config.includeGuards && endpoint.guards) {
        for (const guard of endpoint.guards) {
          const guardNode = this.createGuardNode(guard, endpoint.filePath);
          const guardEdge: CallGraphEdge = {
            from: parentNodeId,
            to: guardNode.id,
            type: "guards",
          };
          newNodes.push(guardNode);
          newEdges.push(guardEdge);
        }
      }

      if (config.includePipes && endpoint.pipes) {
        for (const pipe of endpoint.pipes) {
          const pipeNode = this.createPipeNode(pipe, endpoint.filePath);
          const pipeEdge: CallGraphEdge = {
            from: parentNodeId,
            to: pipeNode.id,
            type: "pipes",
          };
          newNodes.push(pipeNode);
          newEdges.push(pipeEdge);
        }
      }

      if (config.includeInterceptors && endpoint.interceptors) {
        for (const interceptor of endpoint.interceptors) {
          const interceptorNode = this.createInterceptorNode(
            interceptor,
            endpoint.filePath
          );
          const interceptorEdge: CallGraphEdge = {
            from: parentNodeId,
            to: interceptorNode.id,
            type: "intercepts",
          };
          newNodes.push(interceptorNode);
          newEdges.push(interceptorEdge);
        }
      }
    } catch (error) {
      console.warn(
        `Error tracing dependencies for endpoint ${endpoint.path}:`,
        error
      );
    }

    return { newNodes, newEdges };
  }

  /**
   * Trace dependencies from a service
   */
  private traceServiceDependencies(
    servicePath: string,
    serviceName: string,
    parentNodeId: string,
    config: CallGraphConfig,
    currentDepth: number
  ): { newNodes: CallGraphNode[]; newEdges: CallGraphEdge[] } {
    const newNodes: CallGraphNode[] = [];
    const newEdges: CallGraphEdge[] = [];

    if (
      currentDepth >= config.maxDepth ||
      this.processedFiles.has(servicePath)
    ) {
      return { newNodes, newEdges };
    }

    this.processedFiles.add(servicePath);

    try {
      const sourceFile = this.project.getSourceFile(servicePath);
      if (!sourceFile) {
        return { newNodes, newEdges };
      }

      // Find the service class
      const serviceClass = sourceFile.getClasses().find((cls) => {
        const className = cls.getName();
        return (
          className === serviceName ||
          className === serviceName.replace(/Service$/, "")
        );
      });

      if (!serviceClass) {
        return { newNodes, newEdges };
      }

      // Extract service dependencies (usually repositories)
      const dependencies =
        this.dependencyTracer.extractConstructorDependencies(serviceClass);
      const repositoryDependencies =
        this.dependencyTracer.extractRepositoryDependencies(serviceClass);

      // Process regular dependencies
      for (const dependency of dependencies) {
        const { serviceNode, serviceEdge } = this.processDependency(
          dependency,
          parentNodeId,
          config,
          currentDepth + 1
        );

        if (serviceNode && serviceEdge) {
          newNodes.push(serviceNode);
          newEdges.push(serviceEdge);
        }
      }

      // Process repository dependencies
      for (const repoDependency of repositoryDependencies) {
        const repositoryNode = this.createRepositoryNode(
          repoDependency,
          servicePath
        );
        const repositoryEdge: CallGraphEdge = {
          from: parentNodeId,
          to: repositoryNode.id,
          type: "injects",
          metadata: {
            injectionToken: repoDependency.injectionToken,
          },
        };

        newNodes.push(repositoryNode);
        newEdges.push(repositoryEdge);

        // Trace entity relationships if enabled
        if (config.includeEntities && repoDependency.injectionToken) {
          const entityPath = this.dependencyTracer.findEntityFile(
            repoDependency.injectionToken
          );
          if (entityPath) {
            const entityNode = this.createEntityNode(
              repoDependency.injectionToken,
              entityPath
            );
            const entityEdge: CallGraphEdge = {
              from: repositoryNode.id,
              to: entityNode.id,
              type: "uses",
            };

            newNodes.push(entityNode);
            newEdges.push(entityEdge);

            // Extract entity relationships
            const { newNodes: relationNodes, newEdges: relationEdges } =
              this.traceEntityRelationships(
                entityPath,
                repoDependency.injectionToken,
                entityNode.id,
                config,
                currentDepth + 1
              );
            newNodes.push(...relationNodes);
            newEdges.push(...relationEdges);
          }
        }
      }
    } catch (error) {
      console.warn(
        `Error tracing service dependencies for ${serviceName}:`,
        error
      );
    }

    return { newNodes, newEdges };
  }

  /**
   * Trace entity relationships
   */
  private traceEntityRelationships(
    entityPath: string,
    entityName: string,
    parentNodeId: string,
    config: CallGraphConfig,
    currentDepth: number
  ): { newNodes: CallGraphNode[]; newEdges: CallGraphEdge[] } {
    const newNodes: CallGraphNode[] = [];
    const newEdges: CallGraphEdge[] = [];

    if (
      currentDepth >= config.maxDepth ||
      this.processedFiles.has(entityPath)
    ) {
      return { newNodes, newEdges };
    }

    try {
      const sourceFile = this.project.getSourceFile(entityPath);
      if (!sourceFile) {
        return { newNodes, newEdges };
      }

      const entityClass = sourceFile.getClasses().find((cls) => {
        const className = cls.getName();
        return (
          className === entityName ||
          className === entityName.replace(/Entity$/, "")
        );
      });

      if (!entityClass) {
        return { newNodes, newEdges };
      }

      const relationships =
        this.dependencyTracer.extractEntityRelationships(entityClass);

      for (const relationship of relationships) {
        const relatedEntityPath = this.dependencyTracer.findEntityFile(
          relationship.targetEntity
        );
        if (relatedEntityPath) {
          const relatedEntityNode = this.createEntityNode(
            relationship.targetEntity,
            relatedEntityPath
          );
          const relationshipEdge: CallGraphEdge = {
            from: parentNodeId,
            to: relatedEntityNode.id,
            type: "uses",
            metadata: {
              method: relationship.relationType,
            },
          };

          newNodes.push(relatedEntityNode);
          newEdges.push(relationshipEdge);
        }
      }
    } catch (error) {
      console.warn(
        `Error tracing entity relationships for ${entityName}:`,
        error
      );
    }

    return { newNodes, newEdges };
  }

  /**
   * Process a dependency and create corresponding nodes/edges
   */
  private processDependency(
    dependency: DependencyInfo,
    parentNodeId: string,
    config: CallGraphConfig,
    currentDepth: number
  ): { serviceNode: CallGraphNode | null; serviceEdge: CallGraphEdge | null } {
    const nodeType = dependency.serviceType as CallGraphNode["type"];
    let filePath = "";

    // Try to find the service file
    if (dependency.serviceType === "service") {
      filePath =
        this.dependencyTracer.findServiceFile(dependency.serviceName) || "";
    } else if (dependency.serviceType === "repository") {
      filePath =
        this.dependencyTracer.findRepositoryFile(dependency.serviceName) || "";
    }

    const serviceNode = this.createServiceNode(dependency, filePath, nodeType);
    const serviceEdge: CallGraphEdge = {
      from: parentNodeId,
      to: serviceNode.id,
      type: "injects",
      metadata: {
        parameter: dependency.parameterName,
        injectionToken: dependency.injectionToken,
      },
    };

    return { serviceNode, serviceEdge };
  }

  /**
   * Create service node
   */
  private createServiceNode(
    dependency: DependencyInfo,
    filePath: string,
    nodeType: CallGraphNode["type"]
  ): CallGraphNode {
    const nodeId = this.getServiceNodeId(dependency.serviceName, filePath);

    if (this.nodeCache.has(nodeId)) {
      return this.nodeCache.get(nodeId)!;
    }

    const node: CallGraphNode = {
      id: nodeId,
      name: dependency.serviceName,
      type: nodeType,
      filePath: filePath,
      lineNumber: 1, // We'll update this if we can find the actual line
      metadata: {
        className: dependency.serviceName,
      },
    };

    this.nodeCache.set(nodeId, node);
    return node;
  }

  /**
   * Create repository node
   */
  private createRepositoryNode(
    dependency: DependencyInfo,
    filePath: string
  ): CallGraphNode {
    const nodeId = `repository:${dependency.serviceName}:${filePath}`;

    if (this.nodeCache.has(nodeId)) {
      return this.nodeCache.get(nodeId)!;
    }

    const node: CallGraphNode = {
      id: nodeId,
      name: dependency.serviceName,
      type: "repository",
      filePath: filePath,
      lineNumber: 1,
      metadata: {
        className: dependency.serviceName,
      },
    };

    this.nodeCache.set(nodeId, node);
    return node;
  }

  /**
   * Create entity node
   */
  private createEntityNode(
    entityName: string,
    filePath: string
  ): CallGraphNode {
    const nodeId = `entity:${entityName}:${filePath}`;

    if (this.nodeCache.has(nodeId)) {
      return this.nodeCache.get(nodeId)!;
    }

    const node: CallGraphNode = {
      id: nodeId,
      name: entityName,
      type: "entity",
      filePath: filePath,
      lineNumber: 1,
      metadata: {
        className: entityName,
      },
    };

    this.nodeCache.set(nodeId, node);
    return node;
  }

  /**
   * Create guard node
   */
  private createGuardNode(guardName: string, filePath: string): CallGraphNode {
    const nodeId = `guard:${guardName}:${filePath}`;

    if (this.nodeCache.has(nodeId)) {
      return this.nodeCache.get(nodeId)!;
    }

    const node: CallGraphNode = {
      id: nodeId,
      name: guardName,
      type: "guard",
      filePath: filePath,
      lineNumber: 1,
      metadata: {
        className: guardName,
      },
    };

    this.nodeCache.set(nodeId, node);
    return node;
  }

  /**
   * Create pipe node
   */
  private createPipeNode(pipeName: string, filePath: string): CallGraphNode {
    const nodeId = `pipe:${pipeName}:${filePath}`;

    if (this.nodeCache.has(nodeId)) {
      return this.nodeCache.get(nodeId)!;
    }

    const node: CallGraphNode = {
      id: nodeId,
      name: pipeName,
      type: "pipe",
      filePath: filePath,
      lineNumber: 1,
      metadata: {
        className: pipeName,
      },
    };

    this.nodeCache.set(nodeId, node);
    return node;
  }

  /**
   * Create interceptor node
   */
  private createInterceptorNode(
    interceptorName: string,
    filePath: string
  ): CallGraphNode {
    const nodeId = `interceptor:${interceptorName}:${filePath}`;

    if (this.nodeCache.has(nodeId)) {
      return this.nodeCache.get(nodeId)!;
    }

    const node: CallGraphNode = {
      id: nodeId,
      name: interceptorName,
      type: "interceptor",
      filePath: filePath,
      lineNumber: 1,
      metadata: {
        className: interceptorName,
      },
    };

    this.nodeCache.set(nodeId, node);
    return node;
  }

  /**
   * Generate service node ID
   */
  private getServiceNodeId(serviceName: string, filePath: string): string {
    return `service:${serviceName}:${filePath}`;
  }

  /**
   * Load source files based on configuration
   */
  private loadSourceFiles(): void {
    const folders = workspace.workspaceFolders;
    if (!folders) return;

    const rootPath = folders[0].uri.fsPath;
    const patterns = this.getSearchPatterns();

    patterns.forEach((pattern) => {
      try {
        this.project.addSourceFilesAtPaths(path.join(rootPath, pattern));
      } catch (error) {
        console.warn(`Failed to load files with pattern ${pattern}:`, error);
      }
    });
  }

  /**
   * Get search patterns based on configuration
   */
  private getSearchPatterns(): string[] {
    if (this.config.monorepoMode) {
      const selectedApp = this.config.selectedApp;
      if (selectedApp) {
        return [`apps/${selectedApp}/**/*.ts`, "libs/**/*.ts"];
      }
      return ["apps/**/*.ts", "libs/**/*.ts", "src/**/*.ts"];
    }

    const rootFolder = this.config.rootFolder;
    return [`${rootFolder}/**/*.ts`];
  }

  /**
   * Remove duplicate nodes
   */
  private removeDuplicateNodes(nodes: CallGraphNode[]): CallGraphNode[] {
    const seen = new Set<string>();
    return nodes.filter((node) => {
      if (seen.has(node.id)) {
        return false;
      }
      seen.add(node.id);
      return true;
    });
  }

  /**
   * Remove duplicate edges
   */
  private removeDuplicateEdges(edges: CallGraphEdge[]): CallGraphEdge[] {
    const seen = new Set<string>();
    return edges.filter((edge) => {
      const key = `${edge.from}->${edge.to}:${edge.type}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Refresh the project (reload files)
   */
  public refresh(): void {
    this.nodeCache.clear();
    this.processedFiles.clear();

    // Remove all source files and reload
    const sourceFiles = this.project.getSourceFiles();
    for (const sourceFile of sourceFiles) {
      this.project.removeSourceFile(sourceFile);
    }
    this.loadSourceFiles();
  }
}
