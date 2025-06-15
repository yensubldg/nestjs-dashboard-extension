import * as vscode from "vscode";
import { NestParser, EntityInfo, PropertyInfo } from "./parser/NestParser";

type EntityNode = EntityInfo | PropertyInfo;

export class EntityTreeProvider implements vscode.TreeDataProvider<EntityNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    EntityNode | undefined | void
  > = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<EntityNode | undefined | void> =
    this._onDidChangeTreeData.event;

  private expandedEntities: Set<string> = new Set();

  constructor(private parser: NestParser) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: EntityNode): vscode.TreeItem {
    if (this.isEntityInfo(element)) {
      const label = element.tableName
        ? `${element.name} (${element.tableName})`
        : element.name;

      // Check if this entity should be expanded
      const isExpanded = this.expandedEntities.has(element.name);
      const item = new vscode.TreeItem(
        label,
        isExpanded
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed
      );
      item.contextValue = "entity";
      item.iconPath = new vscode.ThemeIcon(
        "symbol-class",
        new vscode.ThemeColor("symbolIcon.classForeground")
      );
      item.command = {
        command: "nestjsDashboard.expandAndOpenEntity",
        title: "Expand and Open Entity",
        arguments: [element],
      };
      item.tooltip = `Entity: ${element.name}${
        element.tableName ? ` (Table: ${element.tableName})` : ""
      }`;
      return item;
    } else {
      // PropertyInfo
      const decoratorText =
        element.decorators.length > 0
          ? ` @${element.decorators.join(", @")}`
          : "";
      const item = new vscode.TreeItem(
        `${element.name}: ${element.type}`,
        vscode.TreeItemCollapsibleState.None
      );
      item.description = decoratorText;
      item.contextValue = "property";

      // Add property-specific icons based on decorators
      if (
        element.decorators.includes("PrimaryGeneratedColumn") ||
        element.decorators.includes("PrimaryColumn")
      ) {
        item.iconPath = new vscode.ThemeIcon(
          "key",
          new vscode.ThemeColor("charts.yellow")
        );
      } else if (element.decorators.includes("Column")) {
        item.iconPath = new vscode.ThemeIcon(
          "symbol-field",
          new vscode.ThemeColor("symbolIcon.fieldForeground")
        );
      } else if (
        element.decorators.includes("OneToMany") ||
        element.decorators.includes("ManyToOne") ||
        element.decorators.includes("OneToOne") ||
        element.decorators.includes("ManyToMany")
      ) {
        item.iconPath = new vscode.ThemeIcon(
          "references",
          new vscode.ThemeColor("charts.blue")
        );
      } else {
        item.iconPath = new vscode.ThemeIcon(
          "symbol-property",
          new vscode.ThemeColor("symbolIcon.propertyForeground")
        );
      }

      return item;
    }
  }

  getChildren(element?: EntityNode): Thenable<EntityNode[]> {
    if (!element) {
      const entities = this.parser.parseEntities();
      return Promise.resolve(entities);
    } else if (this.isEntityInfo(element)) {
      return Promise.resolve(element.properties);
    } else {
      return Promise.resolve([]);
    }
  }

  private isEntityInfo(element: EntityNode): element is EntityInfo {
    return (element as EntityInfo).properties !== undefined;
  }

  expandAndOpenEntity(entity: EntityInfo): void {
    // Add to expanded entities set
    this.expandedEntities.add(entity.name);
    // Refresh the tree to show the expanded state
    this.refresh();
  }
}
