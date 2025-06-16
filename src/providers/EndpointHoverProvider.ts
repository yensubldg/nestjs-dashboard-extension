import * as vscode from "vscode";
import { NestParser, EndpointInfo } from "../parser/NestParser";
import { ConfigurationManager } from "../ConfigurationManager";

export class EndpointHoverProvider implements vscode.HoverProvider {
  private parser: NestParser;
  private config: ConfigurationManager;
  private endpointsCache: EndpointInfo[] = [];
  private lastCacheUpdate: number = 0;
  private readonly CACHE_DURATION = 30000; // 30 seconds

  constructor(parser: NestParser) {
    this.parser = parser;
    this.config = ConfigurationManager.getInstance();
  }

  private getEndpoints(): EndpointInfo[] {
    const now = Date.now();
    if (now - this.lastCacheUpdate > this.CACHE_DURATION) {
      this.endpointsCache = this.parser.parseEndpoints();
      this.lastCacheUpdate = now;
    }
    return this.endpointsCache;
  }

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    if (!this.config.enableHoverTooltips) {
      return null;
    }

    const endpoints = this.getEndpoints();
    const currentFilePath = document.uri.fsPath;

    // Find endpoints in current file
    const fileEndpoints = endpoints.filter(
      (ep) => ep.filePath === currentFilePath
    );

    if (fileEndpoints.length === 0) {
      return null;
    }

    // Find endpoint at current position
    const currentLine = position.line + 1; // Convert to 1-indexed
    const endpoint = fileEndpoints.find(
      (ep) => Math.abs(ep.lineNumber - currentLine) <= 2 // Allow some tolerance
    );

    if (!endpoint) {
      return null;
    }

    return this.createHoverContent(endpoint);
  }

  private createHoverContent(endpoint: EndpointInfo): vscode.Hover {
    const markdown = new vscode.MarkdownString();
    markdown.isTrusted = true;
    markdown.supportHtml = true;

    // Header
    markdown.appendMarkdown(`### 🚀 ${endpoint.method} ${endpoint.path}\n\n`);

    // Controller and Handler
    markdown.appendMarkdown(`**Controller:** \`${endpoint.controller}\`  \n`);
    markdown.appendMarkdown(`**Handler:** \`${endpoint.handlerName}\`  \n\n`);

    // Description
    if (endpoint.description) {
      markdown.appendMarkdown(`**Description:** ${endpoint.description}  \n\n`);
    }

    // DTOs
    if (endpoint.inputDto || endpoint.outputDto) {
      markdown.appendMarkdown(`#### 📋 Data Transfer Objects\n`);
      if (endpoint.inputDto) {
        markdown.appendMarkdown(`**Input:** \`${endpoint.inputDto}\`  \n`);
      }
      if (endpoint.outputDto) {
        markdown.appendMarkdown(`**Output:** \`${endpoint.outputDto}\`  \n`);
      }
      markdown.appendMarkdown(`\n`);
    }

    // Security & Middleware
    if (endpoint.guards && endpoint.guards.length > 0) {
      markdown.appendMarkdown(`#### 🔒 Guards\n`);
      endpoint.guards.forEach((guard) => {
        markdown.appendMarkdown(`- \`${guard}\`  \n`);
      });
      markdown.appendMarkdown(`\n`);
    }

    if (endpoint.pipes && endpoint.pipes.length > 0) {
      markdown.appendMarkdown(`#### 🔧 Pipes\n`);
      endpoint.pipes.forEach((pipe) => {
        markdown.appendMarkdown(`- \`${pipe}\`  \n`);
      });
      markdown.appendMarkdown(`\n`);
    }

    if (endpoint.interceptors && endpoint.interceptors.length > 0) {
      markdown.appendMarkdown(`#### ⚡ Interceptors\n`);
      endpoint.interceptors.forEach((interceptor) => {
        markdown.appendMarkdown(`- \`${interceptor}\`  \n`);
      });
      markdown.appendMarkdown(`\n`);
    }

    // Tags
    if (endpoint.tags && endpoint.tags.length > 0) {
      markdown.appendMarkdown(`#### 🏷️ Tags\n`);
      endpoint.tags.forEach((tag) => {
        markdown.appendMarkdown(`- \`${tag}\`  \n`);
      });
      markdown.appendMarkdown(`\n`);
    }

    // Access Level
    const accessLevel = endpoint.isPublic ? "🌐 Public" : "🔐 Protected";
    markdown.appendMarkdown(`**Access:** ${accessLevel}  \n`);

    // Module (for monorepo)
    if (endpoint.module && endpoint.module !== "main") {
      markdown.appendMarkdown(`**Module:** \`${endpoint.module}\`  \n`);
    }

    return new vscode.Hover(markdown);
  }

  public refreshCache(): void {
    this.lastCacheUpdate = 0; // Force cache refresh
  }
}
