import * as path from "path";
import { workspace } from "vscode";
import { Project, SyntaxKind, StringLiteral } from "ts-morph";

export interface EndpointInfo {
  method: string;
  path: string;
  controller: string;
  handlerName: string;
  summary?: string;
  filePath: string;
  lineNumber: number;
}

export interface EntityInfo {
  name: string;
  tableName?: string;
  properties: PropertyInfo[];
  filePath: string;
  lineNumber: number;
}

export interface PropertyInfo {
  name: string;
  type: string;
  decorators: string[];
}

export class NestParser {
  parseEndpoints(): EndpointInfo[] {
    const endpoints: EndpointInfo[] = [];
    const folders = workspace.workspaceFolders;
    if (!folders) {
      return endpoints;
    }
    const rootPath = folders[0].uri.fsPath;

    const project = new Project({
      tsConfigFilePath: path.join(rootPath, "tsconfig.json"),
      skipAddingFilesFromTsConfig: true,
    });

    const patterns = ["src/**/*.ts", "apps/**/*.ts", "libs/**/*.ts"];
    patterns.forEach((pattern) => {
      project.addSourceFilesAtPaths(path.join(rootPath, pattern));
    });

    project
      .getSourceFiles()
      .forEach((sourceFile: import("ts-morph").SourceFile) => {
        sourceFile
          .getClasses()
          .forEach((cls: import("ts-morph").ClassDeclaration) => {
            const controllerDecorator = cls.getDecorator("Controller");
            if (controllerDecorator) {
              let basePath = "/";
              const args = controllerDecorator.getArguments();
              if (args.length > 0) {
                const arg = args[0];
                if (arg.getKind() === SyntaxKind.StringLiteral) {
                  basePath = (arg as StringLiteral).getLiteralText();
                }
              }
              cls
                .getMethods()
                .forEach((method: import("ts-morph").MethodDeclaration) => {
                  [
                    "Get",
                    "Post",
                    "Put",
                    "Delete",
                    "Patch",
                    "Options",
                    "Head",
                    "All",
                  ].forEach((decoName) => {
                    const decorator = method.getDecorator(decoName);
                    if (decorator) {
                      let subPath = "";
                      const decoArgs = decorator.getArguments();
                      if (decoArgs.length > 0) {
                        const decArg = decoArgs[0];
                        if (decArg.getKind() === SyntaxKind.StringLiteral) {
                          subPath = (decArg as StringLiteral).getLiteralText();
                        }
                      }
                      const fullPath = path.posix.join(basePath, subPath);
                      let summary: string | undefined;
                      const jsDocs = method.getJsDocs();
                      if (jsDocs.length > 0) {
                        const comment = jsDocs[0].getComment();
                        if (typeof comment === "string") {
                          summary = comment.split(/\r?\n/)[0];
                        }
                      }
                      endpoints.push({
                        method: decoName.toUpperCase(),
                        path: fullPath,
                        controller: cls.getName() || "",
                        handlerName: method.getName(),
                        summary,
                        filePath: sourceFile.getFilePath(),
                        lineNumber: method.getStartLineNumber(),
                      });
                    }
                  });
                });
            }
          });
      });

    return endpoints;
  }

  parseEntities(): EntityInfo[] {
    const entities: EntityInfo[] = [];
    const folders = workspace.workspaceFolders;
    if (!folders) {
      return entities;
    }
    const rootPath = folders[0].uri.fsPath;

    const project = new Project({
      tsConfigFilePath: path.join(rootPath, "tsconfig.json"),
      skipAddingFilesFromTsConfig: true,
    });

    const patterns = ["src/**/*.ts", "apps/**/*.ts", "libs/**/*.ts"];
    patterns.forEach((pattern) => {
      project.addSourceFilesAtPaths(path.join(rootPath, pattern));
    });

    project
      .getSourceFiles()
      .forEach((sourceFile: import("ts-morph").SourceFile) => {
        sourceFile
          .getClasses()
          .forEach((cls: import("ts-morph").ClassDeclaration) => {
            const entityDecorator = cls.getDecorator("Entity");
            if (entityDecorator) {
              let tableName: string | undefined;
              const args = entityDecorator.getArguments();
              if (args.length > 0) {
                const arg = args[0];
                if (arg.getKind() === SyntaxKind.StringLiteral) {
                  tableName = (arg as StringLiteral).getLiteralText();
                }
              }

              const properties: PropertyInfo[] = [];
              cls.getProperties().forEach((prop) => {
                const decorators: string[] = [];
                prop.getDecorators().forEach((decorator) => {
                  decorators.push(decorator.getName());
                });

                const typeText =
                  prop.getTypeNode()?.getText() ||
                  prop.getType().getText() ||
                  "any";

                properties.push({
                  name: prop.getName(),
                  type: typeText,
                  decorators,
                });
              });

              entities.push({
                name: cls.getName() || "",
                tableName,
                properties,
                filePath: sourceFile.getFilePath(),
                lineNumber: cls.getStartLineNumber(),
              });
            }
          });
      });

    return entities;
  }
}
