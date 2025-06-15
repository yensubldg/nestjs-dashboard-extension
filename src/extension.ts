// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { ApiTreeProvider } from "./ApiTreeProvider";
import { EntityTreeProvider } from "./EntityTreeProvider";
import { NestParser } from "./parser/NestParser";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  const parser = new NestParser();
  const apiTreeDataProvider = new ApiTreeProvider(parser);
  const entityTreeDataProvider = new EntityTreeProvider(parser);

  vscode.window.registerTreeDataProvider("apiEndpoints", apiTreeDataProvider);
  vscode.window.registerTreeDataProvider("entities", entityTreeDataProvider);
  context.subscriptions.push(
    vscode.commands.registerCommand("nestjsDashboard.refresh", () => {
      apiTreeDataProvider.refresh();
      entityTreeDataProvider.refresh();
    }),
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
    ),
    vscode.commands.registerCommand("nestjsDashboard.openEntity", (entity) => {
      if (entity && entity.filePath && entity.lineNumber) {
        const uri = vscode.Uri.file(entity.filePath);
        vscode.window.showTextDocument(uri).then((editor) => {
          const position = new vscode.Position(entity.lineNumber - 1, 0);
          editor.selection = new vscode.Selection(position, position);
          editor.revealRange(new vscode.Range(position, position));
        });
      }
    }),
    vscode.commands.registerCommand(
      "nestjsDashboard.expandAndOpenEntity",
      async (entity) => {
        if (entity && entity.filePath && entity.lineNumber) {
          // Expand the entity in the tree
          entityTreeDataProvider.expandAndOpenEntity(entity);

          // Open the file
          const uri = vscode.Uri.file(entity.filePath);
          await vscode.window.showTextDocument(uri).then((editor) => {
            const position = new vscode.Position(entity.lineNumber - 1, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position));
          });
        }
      }
    )
  );

  const tsWatcher = vscode.workspace.createFileSystemWatcher("**/*.ts");
  tsWatcher.onDidChange(() => {
    apiTreeDataProvider.refresh();
    entityTreeDataProvider.refresh();
  });
  tsWatcher.onDidCreate(() => {
    apiTreeDataProvider.refresh();
    entityTreeDataProvider.refresh();
  });
  tsWatcher.onDidDelete(() => {
    apiTreeDataProvider.refresh();
    entityTreeDataProvider.refresh();
  });
  context.subscriptions.push(tsWatcher);

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "nestjs-dashboard" is now active!'
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
