import * as vscode from "vscode";
import { NestParser, EndpointInfo } from "./parser/NestParser";

type ApiNode = ControllerNode | EndpointInfo;

interface ControllerNode {
  type: "controller";
  name: string;
  endpoints: EndpointInfo[];
}

export class ApiTreeProvider implements vscode.TreeDataProvider<ApiNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    ApiNode | undefined | void
  > = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<ApiNode | undefined | void> =
    this._onDidChangeTreeData.event;

  constructor(private parser: NestParser) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ApiNode): vscode.TreeItem {
    if (this.isControllerNode(element)) {
      const item = new vscode.TreeItem(
        element.name,
        vscode.TreeItemCollapsibleState.Collapsed
      );
      item.contextValue = "controller";
      item.iconPath = new vscode.ThemeIcon(
        "symbol-class",
        new vscode.ThemeColor("symbolIcon.classForeground")
      );
      item.tooltip = `${element.name} (${element.endpoints.length} endpoints)\nRight-click to generate tests or expand to see endpoints`;

      return item;
    } else if (this.isEndpointNode(element)) {
      const label = `${element.method} ${element.path}`;
      const item = new vscode.TreeItem(
        label,
        vscode.TreeItemCollapsibleState.None
      );

      // Keep summary in description if it exists
      if (element.summary) {
        item.description = element.summary;
      }

      item.contextValue = "endpoint";
      item.tooltip = `${element.method} ${element.path}\nLine: ${element.lineNumber}\nController: ${element.controller}\nRight-click for options`;

      // Add command for navigation to file
      item.command = {
        command: "nestjsDashboard.openEndpoint",
        title: "Open Endpoint",
        arguments: [element],
      };

      // Add method-specific icons
      switch (element.method.toUpperCase()) {
        case "GET":
          item.iconPath = new vscode.ThemeIcon(
            "arrow-down",
            new vscode.ThemeColor("charts.blue")
          );
          break;
        case "POST":
          item.iconPath = new vscode.ThemeIcon(
            "add",
            new vscode.ThemeColor("charts.green")
          );
          break;
        case "PUT":
          item.iconPath = new vscode.ThemeIcon(
            "edit",
            new vscode.ThemeColor("charts.orange")
          );
          break;
        case "PATCH":
          item.iconPath = new vscode.ThemeIcon(
            "diff-modified",
            new vscode.ThemeColor("charts.yellow")
          );
          break;
        case "DELETE":
          item.iconPath = new vscode.ThemeIcon(
            "trash",
            new vscode.ThemeColor("charts.red")
          );
          break;
        case "OPTIONS":
          item.iconPath = new vscode.ThemeIcon(
            "settings-gear",
            new vscode.ThemeColor("charts.purple")
          );
          break;
        case "HEAD":
          item.iconPath = new vscode.ThemeIcon(
            "info",
            new vscode.ThemeColor("charts.foreground")
          );
          break;
        default:
          item.iconPath = new vscode.ThemeIcon(
            "globe",
            new vscode.ThemeColor("charts.foreground")
          );
          break;
      }

      return item;
    } else {
      // Fallback for unknown node types
      return new vscode.TreeItem(
        "Unknown",
        vscode.TreeItemCollapsibleState.None
      );
    }
  }

  getChildren(element?: ApiNode): Thenable<ApiNode[]> {
    if (!element) {
      const endpoints = this.parser.parseEndpoints();
      const grouped = new Map<string, EndpointInfo[]>();
      endpoints.forEach((ep: EndpointInfo) => {
        const list = grouped.get(ep.controller) || [];
        list.push(ep);
        grouped.set(ep.controller, list);
      });
      const controllers: ControllerNode[] = [];
      grouped.forEach((eps, name) => {
        controllers.push({ type: "controller", name, endpoints: eps });
      });

      return Promise.resolve(controllers);
    } else if (this.isControllerNode(element)) {
      return Promise.resolve(element.endpoints);
    } else {
      return Promise.resolve([]);
    }
  }

  private isControllerNode(element: ApiNode): element is ControllerNode {
    return (element as any).type === "controller";
  }

  private isEndpointNode(element: ApiNode): element is EndpointInfo {
    return (
      (element as any).type !== "controller" && element.hasOwnProperty("method")
    );
  }
}
