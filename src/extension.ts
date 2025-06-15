// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { ApiTreeProvider } from "./ApiTreeProvider";
import { NestParser } from "./parser/NestParser";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const parser = new NestParser();
  const treeDataProvider = new ApiTreeProvider(parser);

  vscode.window.registerTreeDataProvider("apiEndpoints", treeDataProvider);
  context.subscriptions.push(
    vscode.commands.registerCommand("nestjsDashboard.refresh", () =>
      treeDataProvider.refresh()
    ),
    vscode.commands.registerCommand(
      "nestjsDashboard.openEndpoint",
      (endpoint) => {
        if (endpoint && endpoint.filePath && endpoint.lineNumber) {
          const uri = vscode.Uri.file(endpoint.filePath);
          vscode.window.showTextDocument(uri).then((editor) => {
            const position = new vscode.Position(endpoint.lineNumber - 1, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position));
          });
        }
      }
    )
  );

  const tsWatcher = vscode.workspace.createFileSystemWatcher("**/*.ts");
  tsWatcher.onDidChange(() => treeDataProvider.refresh());
  tsWatcher.onDidCreate(() => treeDataProvider.refresh());
  tsWatcher.onDidDelete(() => treeDataProvider.refresh());
  context.subscriptions.push(tsWatcher);

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "nestjs-dashboard" is now active!'
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
