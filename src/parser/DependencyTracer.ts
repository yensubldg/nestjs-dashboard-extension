import * as path from "path";
import {
  Project,
  SyntaxKind,
  ClassDeclaration,
  MethodDeclaration,
  ParameterDeclaration,
  CallExpression,
  PropertyAccessExpression,
  Identifier,
} from "ts-morph";
import { CallGraphNode, CallGraphEdge } from "../models/CallGraphModels";

export interface DependencyInfo {
  serviceName: string;
  serviceType: string;
  injectionToken?: string;
  parameterName: string;
}

export interface MethodCallInfo {
  methodName: string;
  targetObject: string;
  targetType?: string;
  lineNumber: number;
}

export class DependencyTracer {
  private project: Project;

  constructor(project: Project) {
    this.project = project;
  }

  /**
   * Extract constructor dependencies from a class
   */
  public extractConstructorDependencies(
    classDeclaration: ClassDeclaration
  ): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];
    const constructors = classDeclaration.getConstructors();

    for (const constructor of constructors) {
      const parameters = constructor.getParameters();

      for (const param of parameters) {
        const dependency = this.analyzeDependencyParameter(param);
        if (dependency) {
          dependencies.push(dependency);
        }
      }
    }

    return dependencies;
  }

  /**
   * Extract method calls from a method
   */
  public extractMethodCalls(method: MethodDeclaration): MethodCallInfo[] {
    const methodCalls: MethodCallInfo[] = [];

    // Find all call expressions in the method
    const callExpressions = method.getDescendantsOfKind(
      SyntaxKind.CallExpression
    );

    for (const callExpr of callExpressions) {
      const methodCall = this.analyzeMethodCall(callExpr);
      if (methodCall) {
        methodCalls.push(methodCall);
      }
    }

    return methodCalls;
  }

  /**
   * Extract method calls from entire class
   */
  public extractClassMethodCalls(
    classDeclaration: ClassDeclaration
  ): Map<string, MethodCallInfo[]> {
    const classMethods = new Map<string, MethodCallInfo[]>();
    const methods = classDeclaration.getMethods();

    for (const method of methods) {
      const methodName = method.getName();
      const calls = this.extractMethodCalls(method);
      classMethods.set(methodName, calls);
    }

    return classMethods;
  }

  /**
   * Find service files based on dependency names
   */
  public findServiceFile(serviceName: string): string | null {
    // First search in already loaded source files by filename
    const allFiles = this.project.getSourceFiles();

    const searchTerms = [
      serviceName.toLowerCase(),
      serviceName.replace(/Service$/, "").toLowerCase(),
      serviceName,
    ];

    for (const file of allFiles) {
      const fileName = path.basename(file.getFilePath()).toLowerCase();

      for (const term of searchTerms) {
        if (
          fileName.includes(term.toLowerCase() + ".service.ts") ||
          fileName.includes(term.toLowerCase() + ".ts")
        ) {
          // Also check if the file contains a class with the service name
          const classes = file.getClasses();
          for (const cls of classes) {
            const className = cls.getName();
            if (
              className === serviceName ||
              className === serviceName.replace(/Service$/, "") ||
              className?.toLowerCase() === serviceName.toLowerCase()
            ) {
              return file.getFilePath();
            }
          }
        }
      }
    }

    // If not found, try adding more source files and search again
    const possiblePaths = [
      `**/${serviceName.toLowerCase()}.service.ts`,
      `**/${serviceName.replace(/Service$/, "").toLowerCase()}.service.ts`,
      `**/*${serviceName}.ts`,
      `**/*${serviceName.toLowerCase()}.ts`,
      `**/services/**/${serviceName.toLowerCase()}.ts`,
      `**/src/**/${serviceName.toLowerCase()}.service.ts`,
    ];

    for (const pattern of possiblePaths) {
      try {
        this.project.addSourceFilesAtPaths(pattern);
        const files = this.project.getSourceFiles();

        // Search again in newly loaded files
        for (const file of files) {
          const classes = file.getClasses();
          for (const cls of classes) {
            const className = cls.getName();
            if (
              className === serviceName ||
              className === serviceName.replace(/Service$/, "") ||
              className?.toLowerCase() === serviceName.toLowerCase()
            ) {
              return file.getFilePath();
            }
          }
        }
      } catch (error) {
        // Continue to next pattern
      }
    }

    return null;
  }

  /**
   * Find repository files based on dependency names
   */
  public findRepositoryFile(repositoryName: string): string | null {
    const possiblePaths = [
      `**/${repositoryName.toLowerCase()}.repository.ts`,
      `**/${repositoryName
        .replace(/Repository$/, "")
        .toLowerCase()}.repository.ts`,
      `**/*${repositoryName}.ts`,
      `**/*${repositoryName.toLowerCase()}.ts`,
    ];

    for (const pattern of possiblePaths) {
      const files = this.project.getSourceFiles(pattern);
      if (files.length > 0) {
        return files[0].getFilePath();
      }
    }

    return null;
  }

  /**
   * Find entity files based on names
   */
  public findEntityFile(entityName: string): string | null {
    const possiblePaths = [
      `**/${entityName.toLowerCase()}.entity.ts`,
      `**/${entityName.replace(/Entity$/, "").toLowerCase()}.entity.ts`,
      `**/*${entityName}.ts`,
      `**/*${entityName.toLowerCase()}.ts`,
    ];

    for (const pattern of possiblePaths) {
      const files = this.project.getSourceFiles(pattern);
      if (files.length > 0) {
        return files[0].getFilePath();
      }
    }

    return null;
  }

  /**
   * Extract repository dependencies from TypeORM patterns
   */
  public extractRepositoryDependencies(
    classDeclaration: ClassDeclaration
  ): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];
    const constructors = classDeclaration.getConstructors();

    for (const constructor of constructors) {
      const parameters = constructor.getParameters();

      for (const param of parameters) {
        const decorators = param.getDecorators();

        for (const decorator of decorators) {
          const decoratorName = decorator.getName();

          if (decoratorName === "InjectRepository") {
            const args = decorator.getArguments();
            if (args.length > 0) {
              const entityType = args[0].getText();
              dependencies.push({
                serviceName: `Repository<${entityType}>`,
                serviceType: "repository",
                injectionToken: entityType,
                parameterName: param.getName(),
              });
            }
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * Extract entity relationships from decorators
   */
  public extractEntityRelationships(classDeclaration: ClassDeclaration): Array<{
    property: string;
    relationType: string;
    targetEntity: string;
  }> {
    const relationships: Array<{
      property: string;
      relationType: string;
      targetEntity: string;
    }> = [];

    const properties = classDeclaration.getProperties();

    for (const prop of properties) {
      const decorators = prop.getDecorators();

      for (const decorator of decorators) {
        const decoratorName = decorator.getName();

        if (
          ["OneToOne", "OneToMany", "ManyToOne", "ManyToMany"].includes(
            decoratorName
          )
        ) {
          const args = decorator.getArguments();
          if (args.length > 0) {
            const targetEntity = args[0].getText();
            relationships.push({
              property: prop.getName(),
              relationType: decoratorName,
              targetEntity: targetEntity.replace(/['"]/g, ""), // Remove quotes
            });
          }
        }
      }
    }

    return relationships;
  }

  /**
   * Create a call graph node from class information
   */
  public createNodeFromClass(
    classDeclaration: ClassDeclaration,
    nodeType: CallGraphNode["type"],
    metadata?: Partial<CallGraphNode["metadata"]>
  ): CallGraphNode {
    const className = classDeclaration.getName() || "Unknown";
    const filePath = classDeclaration.getSourceFile().getFilePath();
    const lineNumber = classDeclaration.getStartLineNumber();

    return {
      id: `${nodeType}:${className}:${filePath}:${lineNumber}`,
      name: className,
      type: nodeType,
      filePath,
      lineNumber,
      metadata: {
        className,
        ...metadata,
      },
    };
  }

  /**
   * Create a call graph node from method information
   */
  public createNodeFromMethod(
    method: MethodDeclaration,
    nodeType: CallGraphNode["type"],
    metadata?: Partial<CallGraphNode["metadata"]>
  ): CallGraphNode {
    const methodName = method.getName();
    const className =
      method.getParent()?.getKind() === SyntaxKind.ClassDeclaration
        ? (method.getParent() as ClassDeclaration).getName() || "Unknown"
        : "Unknown";
    const filePath = method.getSourceFile().getFilePath();
    const lineNumber = method.getStartLineNumber();

    return {
      id: `${nodeType}:${className}.${methodName}:${filePath}:${lineNumber}`,
      name: `${className}.${methodName}`,
      type: nodeType,
      filePath,
      lineNumber,
      metadata: {
        className,
        methodName,
        ...metadata,
      },
    };
  }

  private analyzeDependencyParameter(
    param: ParameterDeclaration
  ): DependencyInfo | null {
    const paramName = param.getName();
    const typeNode = param.getTypeNode();

    if (!typeNode) return null;

    const typeName = typeNode.getText();

    // Check for decorator-based injection
    const decorators = param.getDecorators();
    for (const decorator of decorators) {
      const decoratorName = decorator.getName();

      if (decoratorName === "Inject") {
        const args = decorator.getArguments();
        if (args.length > 0) {
          return {
            serviceName: typeName,
            serviceType: this.inferServiceType(typeName),
            injectionToken: args[0].getText().replace(/['"]/g, ""),
            parameterName: paramName,
          };
        }
      }
    }

    // Regular constructor injection
    if (typeName.endsWith("Service") || typeName.endsWith("Repository")) {
      return {
        serviceName: typeName,
        serviceType: this.inferServiceType(typeName),
        parameterName: paramName,
      };
    }

    return null;
  }

  private analyzeMethodCall(callExpr: CallExpression): MethodCallInfo | null {
    const expression = callExpr.getExpression();

    if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
      const propAccess = expression as PropertyAccessExpression;
      const objectExpr = propAccess.getExpression();
      const methodName = propAccess.getName();

      if (objectExpr.getKind() === SyntaxKind.ThisKeyword) {
        return {
          methodName,
          targetObject: "this",
          lineNumber: callExpr.getStartLineNumber(),
        };
      } else if (objectExpr.getKind() === SyntaxKind.Identifier) {
        const identifier = objectExpr as Identifier;
        return {
          methodName,
          targetObject: identifier.getText(),
          lineNumber: callExpr.getStartLineNumber(),
        };
      }
    }

    return null;
  }

  private inferServiceType(typeName: string): string {
    if (typeName.endsWith("Service")) return "service";
    if (typeName.endsWith("Repository") || typeName.startsWith("Repository<"))
      return "repository";
    if (typeName.endsWith("Guard")) return "guard";
    if (typeName.endsWith("Pipe")) return "pipe";
    if (typeName.endsWith("Interceptor")) return "interceptor";
    return "service"; // default
  }
}
