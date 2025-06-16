import * as vscode from "vscode";
import { ApiTreeProvider } from "./ApiTreeProvider";
import { EntityTreeProvider } from "./EntityTreeProvider";
import { NestParser, EndpointInfo } from "./parser/NestParser";
import { ConfigurationManager } from "./ConfigurationManager";
import { EndpointHoverProvider } from "./providers/EndpointHoverProvider";
import { CopilotModelProvider } from "./providers/CopilotModelProvider";
import { StatisticsWebview } from "./views/StatisticsWebview";
import { MonorepoDetector } from "./parser/MonorepoDetector";
import { TestGenerator } from "./generators/TestGenerator";
import { SwaggerParser } from "./parser/SwaggerParser";
import { CallGraphParser } from "./parser/CallGraphParser";
import { CallGraphProvider } from "./providers/CallGraphProvider";
import { MermaidCallGraphWebview } from "./views/MermaidCallGraphWebview";

export function activate(context: vscode.ExtensionContext) {
  const config = ConfigurationManager.getInstance();
  const parser = new NestParser();
  const monorepoDetector = new MonorepoDetector();
  const apiTreeDataProvider = new ApiTreeProvider(parser);
  const entityTreeDataProvider = new EntityTreeProvider(parser);
  const copilotModelProvider = new CopilotModelProvider();
  const hoverProvider = new EndpointHoverProvider(parser);
  const statisticsWebview = new StatisticsWebview(context, parser);
  const testGenerator = new TestGenerator();
  const swaggerParser = new SwaggerParser();
  const callGraphParser = new CallGraphParser();
  const mermaidCallGraphWebview = new MermaidCallGraphWebview(
    context.extensionUri
  );
  const callGraphProvider = new CallGraphProvider(
    callGraphParser,
    parser,
    mermaidCallGraphWebview
  );

  // Register tree views using createTreeView for better control
  const apiTreeView = vscode.window.createTreeView("apiEndpoints", {
    treeDataProvider: apiTreeDataProvider,
    showCollapseAll: true,
  });

  const entityTreeView = vscode.window.createTreeView("entities", {
    treeDataProvider: entityTreeDataProvider,
    showCollapseAll: true,
  });

  const copilotModelTreeView = vscode.window.createTreeView("copilotModel", {
    treeDataProvider: copilotModelProvider,
  });

  const callGraphTreeView = vscode.window.createTreeView("callGraph", {
    treeDataProvider: callGraphProvider,
    showCollapseAll: true,
  });

  context.subscriptions.push(
    apiTreeView,
    entityTreeView,
    copilotModelTreeView,
    callGraphTreeView
  );

  const hoverDisposable = vscode.languages.registerHoverProvider(
    { scheme: "file", language: "typescript" },
    hoverProvider
  );
  context.subscriptions.push(hoverDisposable);

  context.subscriptions.push(
    vscode.commands.registerCommand("nestjsDashboard.refresh", () => {
      apiTreeDataProvider.refresh();
      entityTreeDataProvider.refresh();
      copilotModelProvider.refresh();
      callGraphProvider.refresh();
      hoverProvider.refreshCache();
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
          entityTreeDataProvider.expandAndOpenEntity(entity);

          const uri = vscode.Uri.file(entity.filePath);
          await vscode.window.showTextDocument(uri).then((editor) => {
            const position = new vscode.Position(entity.lineNumber - 1, 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position));
          });
        }
      }
    ),
    vscode.commands.registerCommand("nestjsDashboard.showStatistics", () => {
      statisticsWebview.show();
    }),
    vscode.commands.registerCommand("nestjsDashboard.selectApp", async () => {
      if (monorepoDetector.isMonorepo()) {
        const selectedApp = await monorepoDetector.selectApp();
        if (selectedApp !== undefined) {
          await config.updateSelectedApp(selectedApp);
          apiTreeDataProvider.refresh();
          entityTreeDataProvider.refresh();
          hoverProvider.refreshCache();
          vscode.window.showInformationMessage(
            selectedApp ? `Switched to app: ${selectedApp}` : "Showing all apps"
          );
        }
      } else {
        vscode.window.showInformationMessage("This is not a monorepo project");
      }
    }),
    vscode.commands.registerCommand(
      "nestjsDashboard.toggleMonorepoMode",
      async () => {
        const currentMode = config.monorepoMode;
        await config.updateMonorepoMode(!currentMode);
        apiTreeDataProvider.refresh();
        entityTreeDataProvider.refresh();
        vscode.window.showInformationMessage(
          `Monorepo mode ${!currentMode ? "enabled" : "disabled"}`
        );
      }
    ),
    vscode.commands.registerCommand(
      "nestjsDashboard.generateTest",
      async (endpoint) => {
        try {
          if (!config.enableTestGeneration) {
            vscode.window.showErrorMessage(
              "Test generation is disabled in settings"
            );
            return;
          }

          if (!endpoint) {
            vscode.window.showErrorMessage("No endpoint selected");
            return;
          }

          await testGenerator.generateTestForEndpoint(endpoint);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to generate test: ${error}`);
          console.error("Test generation error:", error);
        }
      }
    ),
    vscode.commands.registerCommand(
      "nestjsDashboard.generateControllerTests",
      async (controller) => {
        try {
          if (!config.enableTestGeneration) {
            vscode.window.showErrorMessage(
              "Test generation is disabled in settings"
            );
            return;
          }

          let selectedController: string;
          let controllerEndpoints: EndpointInfo[];

          if (controller && controller.name) {
            selectedController = controller.name;
            controllerEndpoints = controller.endpoints;
          } else {
            const endpoints = parser.parseEndpoints();
            const controllers = [
              ...new Set(endpoints.map((ep) => ep.controller)),
            ];

            if (controllers.length === 0) {
              vscode.window.showInformationMessage("No controllers found");
              return;
            }

            const selected = await vscode.window.showQuickPick(controllers, {
              placeHolder: "Select controller to generate tests for",
            });

            if (!selected) {
              return;
            }

            selectedController = selected;
            controllerEndpoints = endpoints.filter(
              (ep) => ep.controller === selected
            );
          }

          if (controllerEndpoints.length === 0) {
            vscode.window.showInformationMessage(
              `No endpoints found for ${selectedController}`
            );
            return;
          }

          await testGenerator.generateTestsForController(controllerEndpoints);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to generate controller tests: ${error}`
          );
          console.error("Controller test generation error:", error);
        }
      }
    ),
    vscode.commands.registerCommand("nestjsDashboard.openSwagger", async () => {
      if (config.enableSwaggerIntegration) {
        await swaggerParser.openSwaggerUI();
      } else {
        vscode.window.showErrorMessage(
          "Swagger integration is disabled in settings"
        );
      }
    }),
    vscode.commands.registerCommand(
      "nestjsDashboard.createSwaggerSetup",
      async () => {
        await swaggerParser.createSwaggerSetup();
      }
    ),
    vscode.commands.registerCommand(
      "nestjsDashboard.configureCopilot",
      async () => {
        const items = [
          {
            label: "$(settings-gear) Open Extension Settings",
            description: "Configure GitHub Copilot integration",
            action: "settings",
          },
          {
            label: "$(extensions) Install GitHub Copilot",
            description: "Install the GitHub Copilot extension",
            action: "install",
          },
          {
            label: "$(question) Learn About GitHub Copilot",
            description: "Learn how GitHub Copilot enhances test generation",
            action: "learn",
          },
        ];

        const selection = await vscode.window.showQuickPick(items, {
          placeHolder:
            "Configure GitHub Copilot for intelligent test generation",
        });

        if (selection) {
          switch (selection.action) {
            case "settings":
              await vscode.commands.executeCommand(
                "workbench.action.openSettings",
                "nestjsDashboard.useGitHubCopilot"
              );
              break;
            case "install":
              await vscode.commands.executeCommand(
                "workbench.extensions.search",
                "GitHub.copilot"
              );
              break;
            case "learn":
              await vscode.env.openExternal(
                vscode.Uri.parse("https://github.com/features/copilot")
              );
              break;
          }
        }
      }
    ),
    vscode.commands.registerCommand(
      "nestjsDashboard.selectCopilotModel",
      async () => {
        try {
          if (!vscode.lm || !vscode.lm.selectChatModels) {
            vscode.window.showErrorMessage(
              "Language Model API is not available. Please update to VSCode 1.85.0 or higher and ensure GitHub Copilot extension is installed."
            );
            return;
          }

          let availableModels: any[] = [];

          try {
            availableModels = await vscode.lm.selectChatModels({
              vendor: "copilot",
            });
          } catch (initialError) {
            const choice = await vscode.window.showWarningMessage(
              "GitHub Copilot models not available. This might be because:\n" +
                "• GitHub Copilot extension is not installed\n" +
                "• You're not authenticated with GitHub Copilot\n" +
                "• GitHub Copilot is loading\n\n" +
                "Would you like to try again or configure GitHub Copilot?",
              "Try Again",
              "Configure Copilot",
              "Cancel"
            );

            if (choice === "Try Again") {
              try {
                await vscode.window.withProgress(
                  {
                    location: vscode.ProgressLocation.Notification,
                    title: "Checking GitHub Copilot models...",
                    cancellable: false,
                  },
                  async () => {
                    availableModels = await vscode.lm.selectChatModels({
                      vendor: "copilot",
                    });
                  }
                );
              } catch (retryError) {
                vscode.window.showErrorMessage(
                  "Still unable to access GitHub Copilot models. Please ensure GitHub Copilot extension is installed and you're authenticated."
                );
                return;
              }
            } else if (choice === "Configure Copilot") {
              await vscode.commands.executeCommand(
                "nestjsDashboard.configureCopilot"
              );
              return;
            } else {
              return;
            }
          }

          if (availableModels.length === 0) {
            vscode.window.showWarningMessage(
              "No GitHub Copilot models available. Please ensure GitHub Copilot extension is installed and authenticated."
            );
            return;
          }

          const currentModel = config.copilotModel;
          interface ModelQuickPickItem extends vscode.QuickPickItem {
            modelName?: string;
          }

          const modelOptions: ModelQuickPickItem[] = [
            {
              label: currentModel === "gpt-4o" ? "$(check) gpt-4o" : "gpt-4o",
              description: "Latest and most capable model (recommended)",
              detail: availableModels.some(
                (m) =>
                  m.id?.includes("gpt-4o") ||
                  m.family === "gpt-4o" ||
                  m.name?.includes("gpt-4o")
              )
                ? "✅ Available"
                : "❌ Not available",
              modelName: "gpt-4o",
            },
            {
              label: currentModel === "gpt-4" ? "$(check) gpt-4" : "gpt-4",
              description: "High quality, good for complex tasks",
              detail: availableModels.some(
                (m) =>
                  m.id?.includes("gpt-4") ||
                  m.family === "gpt-4" ||
                  m.name?.includes("gpt-4")
              )
                ? "✅ Available"
                : "❌ Not available",
              modelName: "gpt-4",
            },
            {
              label:
                currentModel === "gpt-3.5-turbo"
                  ? "$(check) gpt-3.5-turbo"
                  : "gpt-3.5-turbo",
              description: "Faster but less capable",
              detail: availableModels.some(
                (m) =>
                  m.id?.includes("gpt-3.5") ||
                  m.family === "gpt-3.5" ||
                  m.name?.includes("gpt-3.5")
              )
                ? "✅ Available"
                : "❌ Not available",
              modelName: "gpt-3.5-turbo",
            },
          ];

          const separators: ModelQuickPickItem[] = [
            { label: "", kind: vscode.QuickPickItemKind.Separator },
            {
              label: "Available Models:",
              kind: vscode.QuickPickItemKind.Separator,
            },
          ];

          const availableModelsList: ModelQuickPickItem[] = availableModels.map(
            (model) => ({
              label: `📋 ${
                model.id || model.family || model.name || "Unknown"
              }`,
              description: `Available model (info only)`,
              detail: `Family: ${model.family || "Unknown"}, Max tokens: ${
                model.maxInputTokens || "Unknown"
              }`,
            })
          );

          const allOptions: ModelQuickPickItem[] = [
            ...modelOptions,
            ...separators,
            ...availableModelsList,
          ];

          const selection = await vscode.window.showQuickPick(allOptions, {
            placeHolder: `Current model: ${currentModel}. Select a new model.`,
            ignoreFocusOut: true,
          });

          if (selection && selection.modelName) {
            await vscode.workspace
              .getConfiguration("nestjsDashboard")
              .update(
                "copilotModel",
                selection.modelName,
                vscode.ConfigurationTarget.Workspace
              );

            await vscode.workspace
              .getConfiguration("nestjsDashboard")
              .update(
                "copilotModel",
                selection.modelName,
                vscode.ConfigurationTarget.Global
              );

            copilotModelProvider.refresh();

            vscode.window.showInformationMessage(
              `GitHub Copilot model changed to: ${selection.modelName}`
            );
          }
        } catch (error) {
          console.error("Error in selectCopilotModel:", error);
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(
            `Failed to access GitHub Copilot: ${errorMessage}. Please ensure GitHub Copilot extension is installed and you're authenticated.`
          );
        }
      }
    ),

    vscode.commands.registerCommand(
      "nestjsDashboard.showEndpointFlow",
      (endpoint: EndpointInfo) => {
        if (endpoint) {
          callGraphProvider.showEnhancedCallGraph(endpoint);
        }
      }
    ),

    vscode.commands.registerCommand(
      "nestjsDashboard.showControllerCallGraph",
      (controller: any) => {
        if (controller && controller.name) {
          callGraphProvider.showControllerCallGraph(controller.name);
        }
      }
    ),

    vscode.commands.registerCommand(
      "nestjsDashboard.showEndpointSequence",
      (endpoint: EndpointInfo) => {
        if (endpoint) {
          callGraphProvider.showEndpointSequence(endpoint);
        }
      }
    ),

    vscode.commands.registerCommand(
      "nestjsDashboard.openCallGraphNode",
      (filePath: string, lineNumber: number) => {
        if (filePath && lineNumber) {
          const uri = vscode.Uri.file(filePath);
          vscode.window.showTextDocument(uri).then((editor) => {
            const position = new vscode.Position(
              Math.max(0, lineNumber - 1),
              0
            );
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position));
          });
        }
      }
    ),

    vscode.commands.registerCommand("nestjsDashboard.refreshCallGraph", () => {
      callGraphParser.refresh();
      callGraphProvider.refresh();
    }),

    vscode.commands.registerCommand("nestjsDashboard.clearCallGraph", () => {
      callGraphProvider.clearCallGraph();
    }),

    vscode.commands.registerCommand("nestjsDashboard.exportCallGraph", () => {
      const callGraph = callGraphProvider.getCurrentCallGraph();
      if (callGraph.nodes.length === 0) {
        vscode.window.showWarningMessage("No call graph data to export");
        return;
      }

      const visualizer = config.callGraphVisualizer;
      if (visualizer === "mermaid") {
        mermaidCallGraphWebview.show(callGraph, "Call Graph Export");
      } else {
        vscode.window.showInformationMessage(
          `Export for ${visualizer} visualizer is coming soon`
        );
      }
    })
  );

  const configWatcher = config.onConfigurationChanged(() => {
    apiTreeDataProvider.refresh();
    entityTreeDataProvider.refresh();
    copilotModelProvider.refresh();
    callGraphProvider.refresh();
    hoverProvider.refreshCache();
  });
  context.subscriptions.push(configWatcher);

  const tsWatcher = vscode.workspace.createFileSystemWatcher("**/*.ts");
  const refreshAll = () => {
    apiTreeDataProvider.refresh();
    entityTreeDataProvider.refresh();
    callGraphProvider.refresh();
    hoverProvider.refreshCache();
  };

  tsWatcher.onDidChange(refreshAll);
  tsWatcher.onDidCreate(refreshAll);
  tsWatcher.onDidDelete(refreshAll);
  context.subscriptions.push(tsWatcher);

  console.log(
    'Congratulations, your extension "nestjs-dashboard" is now active!'
  );
}

export function deactivate() {}
