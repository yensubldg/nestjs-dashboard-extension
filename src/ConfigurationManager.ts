import * as vscode from "vscode";

export class ConfigurationManager {
  private static instance: ConfigurationManager;

  public static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  private getConfig() {
    return vscode.workspace.getConfiguration("nestjsDashboard");
  }

  get rootFolder(): string {
    return this.getConfig().get("rootFolder", "src");
  }

  get enabledRouteGroups(): string[] {
    return this.getConfig().get("enabledRouteGroups", [
      "public",
      "private",
      "admin",
    ]);
  }

  get showMethodColors(): boolean {
    return this.getConfig().get("showMethodColors", true);
  }

  get enableHoverTooltips(): boolean {
    return this.getConfig().get("enableHoverTooltips", true);
  }

  get monorepoMode(): boolean {
    return this.getConfig().get("monorepoMode", false);
  }

  get selectedApp(): string {
    return this.getConfig().get("selectedApp", "");
  }

  get enableSwaggerIntegration(): boolean {
    return this.getConfig().get("enableSwaggerIntegration", true);
  }

  get enableTestGeneration(): boolean {
    return this.getConfig().get("enableTestGeneration", true);
  }

  get useGitHubCopilot(): boolean {
    return this.getConfig().get("useGitHubCopilot", true);
  }

  get copilotModel(): string {
    return this.getConfig().get("copilotModel", "gpt-4o");
  }

  // Call Graph Configuration
  get callGraphVisualizer(): string {
    return this.getConfig().get("callGraph.visualizer", "mermaid");
  }

  get callGraphMaxDepth(): number {
    return this.getConfig().get("callGraph.maxDepth", 4);
  }

  get callGraphIncludeEntities(): boolean {
    return this.getConfig().get("callGraph.includeEntities", true);
  }

  get callGraphIncludeGuards(): boolean {
    return this.getConfig().get("callGraph.includeGuards", true);
  }

  get callGraphIncludePipes(): boolean {
    return this.getConfig().get("callGraph.includePipes", false);
  }

  get callGraphIncludeInterceptors(): boolean {
    return this.getConfig().get("callGraph.includeInterceptors", false);
  }

  get callGraphEnabled(): boolean {
    return this.getConfig().get("callGraph.enableCallGraph", true);
  }

  async updateSelectedApp(appName: string): Promise<void> {
    await this.getConfig().update(
      "selectedApp",
      appName,
      vscode.ConfigurationTarget.Workspace
    );
  }

  async updateMonorepoMode(enabled: boolean): Promise<void> {
    await this.getConfig().update(
      "monorepoMode",
      enabled,
      vscode.ConfigurationTarget.Workspace
    );
  }

  onConfigurationChanged(callback: () => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("nestjsDashboard")) {
        callback();
      }
    });
  }
}
