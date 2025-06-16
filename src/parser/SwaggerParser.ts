import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { Project, SourceFile, SyntaxKind, CallExpression } from "ts-morph";
import { SwaggerInfo } from "./NestParser";

export class SwaggerParser {
  private rootPath: string;

  constructor() {
    const folders = vscode.workspace.workspaceFolders;
    this.rootPath = folders?.[0]?.uri.fsPath || "";
  }

  public detectSwagger(): SwaggerInfo {
    const mainTsPath = this.findMainFile();

    if (!mainTsPath) {
      return { isEnabled: false };
    }

    try {
      const project = new Project();
      const sourceFile = project.addSourceFileAtPath(mainTsPath);

      return this.parseSwaggerSetup(sourceFile);
    } catch (error) {
      console.warn("Error parsing main.ts for Swagger setup:", error);
      return { isEnabled: false };
    }
  }

  private findMainFile(): string | null {
    // Common locations for main.ts
    const possiblePaths = [
      path.join(this.rootPath, "src", "main.ts"),
      path.join(this.rootPath, "apps", "api", "src", "main.ts"),
      path.join(this.rootPath, "apps", "backend", "src", "main.ts"),
      path.join(this.rootPath, "main.ts"),
    ];

    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    }

    // Search recursively for main.ts files
    return this.searchForMainFile(this.rootPath);
  }

  private searchForMainFile(dir: string): string | null {
    try {
      const files = fs.readdirSync(dir, { withFileTypes: true });

      for (const file of files) {
        const fullPath = path.join(dir, file.name);

        if (file.isFile() && file.name === "main.ts") {
          // Check if this looks like a NestJS main file
          const content = fs.readFileSync(fullPath, "utf8");
          if (
            content.includes("NestFactory") ||
            content.includes("bootstrap")
          ) {
            return fullPath;
          }
        } else if (
          file.isDirectory() &&
          !file.name.startsWith(".") &&
          file.name !== "node_modules"
        ) {
          const result = this.searchForMainFile(fullPath);
          if (result) {
            return result;
          }
        }
      }
    } catch (error) {
      // Ignore permission errors and continue
    }

    return null;
  }

  private parseSwaggerSetup(sourceFile: SourceFile): SwaggerInfo {
    const swaggerInfo: SwaggerInfo = { isEnabled: false };

    // Look for SwaggerModule imports
    const imports = sourceFile.getImportDeclarations();
    const hasSwaggerImport = imports.some((imp) =>
      imp.getModuleSpecifierValue().includes("@nestjs/swagger")
    );

    if (!hasSwaggerImport) {
      return swaggerInfo;
    }

    swaggerInfo.isEnabled = true;

    // Use simple text parsing instead of complex AST traversal
    const fileContent = sourceFile.getFullText();

    // Look for SwaggerModule.setup() calls using regex
    const setupMatch = fileContent.match(
      /SwaggerModule\.setup\(\s*['"`]([^'"`]+)['"`]/
    );
    if (setupMatch) {
      swaggerInfo.setupPath = setupMatch[1];
    }

    // Look for setTitle calls
    const titleMatch = fileContent.match(/\.setTitle\(\s*['"`]([^'"`]+)['"`]/);
    if (titleMatch) {
      swaggerInfo.title = titleMatch[1];
    }

    // Look for setVersion calls
    const versionMatch = fileContent.match(
      /\.setVersion\(\s*['"`]([^'"`]+)['"`]/
    );
    if (versionMatch) {
      swaggerInfo.version = versionMatch[1];
    }

    return swaggerInfo;
  }

  public getSwaggerUrl(port: number = 3000): string | null {
    const swaggerInfo = this.detectSwagger();

    if (!swaggerInfo.isEnabled || !swaggerInfo.setupPath) {
      return null;
    }

    return `http://localhost:${port}/${swaggerInfo.setupPath}`;
  }

  public async openSwaggerUI(): Promise<void> {
    const swaggerInfo = this.detectSwagger();

    if (!swaggerInfo.isEnabled) {
      vscode.window.showWarningMessage(
        "Swagger is not configured in this project. Add @nestjs/swagger to your dependencies and configure it in main.ts"
      );
      return;
    }

    if (!swaggerInfo.setupPath) {
      vscode.window.showWarningMessage(
        "Swagger setup path not found. Make sure SwaggerModule.setup() is called in main.ts"
      );
      return;
    }

    // Ask user for the port number
    const portInput = await vscode.window.showInputBox({
      prompt: "Enter the port your NestJS application is running on",
      value: "3000",
      validateInput: (value) => {
        const port = parseInt(value);
        if (isNaN(port) || port < 1 || port > 65535) {
          return "Please enter a valid port number (1-65535)";
        }
        return null;
      },
    });

    if (!portInput) {
      return;
    }

    const port = parseInt(portInput);
    const swaggerUrl = `http://localhost:${port}/${swaggerInfo.setupPath}`;

    // Open in external browser
    await vscode.env.openExternal(vscode.Uri.parse(swaggerUrl));

    vscode.window
      .showInformationMessage(`Opened Swagger UI: ${swaggerUrl}`, "Copy URL")
      .then((selection) => {
        if (selection === "Copy URL") {
          vscode.env.clipboard.writeText(swaggerUrl);
        }
      });
  }

  public generateSwaggerTemplate(): string {
    return `import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Your API Title')
    .setDescription('Your API Description')
    .setVersion('1.0')
    .addBearerAuth() // If using JWT authentication
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
}
bootstrap();
`;
  }

  public async createSwaggerSetup(): Promise<void> {
    const mainFilePath = this.findMainFile();

    if (!mainFilePath) {
      vscode.window.showErrorMessage("Could not find main.ts file");
      return;
    }

    const choice = await vscode.window.showInformationMessage(
      "This will modify your main.ts file to add Swagger configuration. Continue?",
      "Yes, add Swagger",
      "Cancel"
    );

    if (choice !== "Yes, add Swagger") {
      return;
    }

    try {
      const template = this.generateSwaggerTemplate();

      // Open a new document with the template for the user to review
      const doc = await vscode.workspace.openTextDocument({
        content: template,
        language: "typescript",
      });

      await vscode.window.showTextDocument(doc);

      vscode.window.showInformationMessage(
        "Swagger template created. Please review and integrate it into your main.ts file."
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to create Swagger template: ${error}`
      );
    }
  }
}
