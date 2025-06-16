import {
  SequenceDiagram,
  SequenceParticipant,
  SequenceMessage,
  SequenceNote,
  SequenceActivation,
  SequenceConfig,
} from "../models/SequenceModels";
import {
  CallGraph,
  CallGraphNode,
  CallGraphEdge,
} from "../models/CallGraphModels";
import { EndpointInfo } from "./NestParser";
import { CallGraphParser } from "./CallGraphParser";

export class SequenceFlowParser {
  private callGraphParser: CallGraphParser;

  constructor(callGraphParser: CallGraphParser) {
    this.callGraphParser = callGraphParser;
  }

  /**
   * Generate sequence diagram from endpoint
   */
  public generateSequenceFromEndpoint(
    endpoint: EndpointInfo,
    config: Partial<SequenceConfig> = {}
  ): SequenceDiagram {
    const fullConfig: SequenceConfig = {
      type: "mermaid",
      includeReturnMessages: true,
      includeDatabase: true,
      includeMiddleware: true,
      showParameterTypes: false,
      showTimings: false,
      maxDepth: 5,
      ...config,
    };

    // Generate call graph first
    const callGraph = this.callGraphParser.buildEndpointCallGraph(endpoint);

    // Extract participants from call graph
    const participants = this.extractParticipants(
      callGraph,
      endpoint,
      fullConfig
    );

    // Extract message flow from call graph
    const { messages, activations } = this.extractMessageFlow(
      callGraph,
      endpoint,
      fullConfig
    );

    // Extract notes (decorators, validations, etc.)
    const notes = this.extractNotes(endpoint, fullConfig);

    return {
      title: `${endpoint.method} ${endpoint.path}`,
      participants,
      messages,
      notes,
      activations,
      metadata: {
        endpoint: endpoint.path,
        method: endpoint.method,
        controller: endpoint.controller,
        estimatedDuration: this.estimateDuration(messages),
      },
    };
  }

  /**
   * Extract participants from call graph
   */
  private extractParticipants(
    callGraph: CallGraph,
    endpoint: EndpointInfo,
    config: SequenceConfig
  ): SequenceParticipant[] {
    const participants: SequenceParticipant[] = [];

    // Always include client
    participants.push({
      id: "Client",
      name: "Client",
      type: "client",
    });

    // Extract participants from call graph nodes
    const nodeTypeMapping: Record<string, SequenceParticipant["type"]> = {
      endpoint: "controller",
      service: "service",
      repository: "repository",
      entity: "database",
      guard: "guard",
      pipe: "pipe",
      interceptor: "interceptor",
    };

    for (const node of callGraph.nodes) {
      const participantType = nodeTypeMapping[node.type];
      if (participantType) {
        // Skip middleware if not included
        if (
          !config.includeMiddleware &&
          ["guard", "pipe", "interceptor"].includes(participantType)
        ) {
          continue;
        }

        participants.push({
          id: this.sanitizeParticipantId(node.name),
          name: node.name,
          type: participantType,
          filePath: node.filePath,
          lineNumber: node.lineNumber,
        });
      }
    }

    // Add database if repositories exist and database is included
    const hasRepository = participants.some((p) => p.type === "repository");
    if (hasRepository && config.includeDatabase) {
      participants.push({
        id: "Database",
        name: "Database",
        type: "database",
      });
    }

    // Remove duplicates and sort by type
    const uniqueParticipants = this.removeDuplicateParticipants(participants);
    return this.sortParticipants(uniqueParticipants);
  }

  /**
   * Extract message flow from call graph
   */
  private extractMessageFlow(
    callGraph: CallGraph,
    endpoint: EndpointInfo,
    config: SequenceConfig
  ): { messages: SequenceMessage[]; activations: SequenceActivation[] } {
    const messages: SequenceMessage[] = [];
    const activations: SequenceActivation[] = [];
    let order = 1;

    // Start with client request
    const endpointNode = callGraph.nodes.find((n) => n.type === "endpoint");
    if (endpointNode) {
      const controllerName = this.sanitizeParticipantId(endpointNode.name);

      messages.push({
        from: "Client",
        to: controllerName,
        message: `${endpoint.method} ${endpoint.path}`,
        type: "sync",
        order: order++,
        metadata: {
          httpMethod: endpoint.method,
          isDemo: false,
        },
      });

      activations.push({
        participant: controllerName,
        startOrder: order - 1,
        endOrder: 0, // Will be set later
      });
    }

    // Process call graph edges to create message flow
    const processedEdges = new Set<string>();

    for (const edge of callGraph.edges) {
      const edgeKey = `${edge.from}-${edge.to}`;
      if (processedEdges.has(edgeKey)) continue;
      processedEdges.add(edgeKey);

      const fromNode = callGraph.nodes.find((n) => n.id === edge.from);
      const toNode = callGraph.nodes.find((n) => n.id === edge.to);

      if (!fromNode || !toNode) continue;

      // Skip middleware if not included
      if (
        !config.includeMiddleware &&
        ["guard", "pipe", "interceptor"].includes(toNode.type)
      ) {
        continue;
      }

      const fromName = this.sanitizeParticipantId(fromNode.name);
      const toName = this.sanitizeParticipantId(toNode.name);

      let message = this.generateMessageText(edge, fromNode, toNode);

      messages.push({
        from: fromName,
        to: toName,
        message,
        type: "sync",
        order: order++,
        metadata: {
          isDemo: fromNode.metadata?.isDemoData || toNode.metadata?.isDemoData,
        },
      });

      // Add activation for service/repository calls
      if (["service", "repository"].includes(toNode.type)) {
        activations.push({
          participant: toName,
          startOrder: order - 1,
          endOrder: 0, // Will be set later
        });
      }

      // Add database call for repository
      if (toNode.type === "repository" && config.includeDatabase) {
        const dbMessage = this.generateDatabaseMessage(endpoint.method, toNode);
        messages.push({
          from: toName,
          to: "Database",
          message: dbMessage,
          type: "sync",
          order: order++,
          metadata: { isDemo: true },
        });

        activations.push({
          participant: "Database",
          startOrder: order - 1,
          endOrder: order,
        });
      }
    }

    // Add return messages if included
    if (config.includeReturnMessages) {
      const returnMessages = this.generateReturnMessages(messages, endpoint);
      messages.push(...returnMessages);
      order += returnMessages.length;
    }

    // Update activation end orders
    this.updateActivationEndOrders(activations, messages);

    return { messages, activations };
  }

  /**
   * Extract notes from endpoint decorators and metadata
   */
  private extractNotes(
    endpoint: EndpointInfo,
    config: SequenceConfig
  ): SequenceNote[] {
    const notes: SequenceNote[] = [];
    let order = 0.5; // Place notes between messages

    const controllerName = this.sanitizeParticipantId(
      `${endpoint.method} ${endpoint.path}`
    );

    // Add guard notes
    if (
      endpoint.guards &&
      endpoint.guards.length > 0 &&
      config.includeMiddleware
    ) {
      notes.push({
        participant: controllerName,
        content: `@UseGuards(${endpoint.guards.join(", ")})`,
        position: "right",
        order: order,
        type: "info",
      });
      order += 0.1;
    }

    // Add pipe notes
    if (
      endpoint.pipes &&
      endpoint.pipes.length > 0 &&
      config.includeMiddleware
    ) {
      notes.push({
        participant: controllerName,
        content: `@UsePipes(${endpoint.pipes.join(", ")})`,
        position: "right",
        order: order,
        type: "info",
      });
      order += 0.1;
    }

    // Add DTO notes
    if (endpoint.inputDto && config.showParameterTypes) {
      notes.push({
        participant: controllerName,
        content: `@Body() ${endpoint.inputDto}`,
        position: "right",
        order: order,
        type: "info",
      });
      order += 0.1;
    }

    return notes;
  }

  /**
   * Generate message text from edge information
   */
  private generateMessageText(
    edge: CallGraphEdge,
    fromNode: CallGraphNode,
    toNode: CallGraphNode
  ): string {
    if (edge.metadata?.method) {
      return `${edge.metadata.method}()`;
    }

    // Generate based on edge type and nodes
    switch (edge.type) {
      case "calls":
        return `${toNode.name.toLowerCase()}()`;
      case "injects":
        return `inject ${toNode.name}`;
      case "uses":
        return `use ${toNode.name}`;
      case "guards":
        return `canActivate()`;
      case "pipes":
        return `transform()`;
      default:
        return `${edge.type} ${toNode.name}`;
    }
  }

  /**
   * Generate database message based on HTTP method
   */
  private generateDatabaseMessage(
    httpMethod: string,
    repositoryNode: CallGraphNode
  ): string {
    const entityName = repositoryNode.name.replace("Repository", "");

    switch (httpMethod.toUpperCase()) {
      case "GET":
        return `SELECT * FROM ${entityName.toLowerCase()}s`;
      case "POST":
        return `INSERT INTO ${entityName.toLowerCase()}s`;
      case "PUT":
      case "PATCH":
        return `UPDATE ${entityName.toLowerCase()}s SET ...`;
      case "DELETE":
        return `DELETE FROM ${entityName.toLowerCase()}s`;
      default:
        return `QUERY ${entityName.toLowerCase()}s`;
    }
  }

  /**
   * Generate return messages for the sequence
   */
  private generateReturnMessages(
    forwardMessages: SequenceMessage[],
    endpoint: EndpointInfo
  ): SequenceMessage[] {
    const returnMessages: SequenceMessage[] = [];
    const stack: SequenceMessage[] = [];

    // Build return flow (reverse of forward flow)
    for (let i = forwardMessages.length - 1; i >= 0; i--) {
      const msg = forwardMessages[i];
      if (msg.from !== "Client") {
        returnMessages.push({
          from: msg.to,
          to: msg.from,
          message: this.generateReturnMessageText(msg, endpoint),
          type: "return",
          order: forwardMessages.length + returnMessages.length + 1,
          metadata: { isDemo: msg.metadata?.isDemo },
        });
      }
    }

    return returnMessages;
  }

  /**
   * Generate return message text
   */
  private generateReturnMessageText(
    originalMessage: SequenceMessage,
    endpoint: EndpointInfo
  ): string {
    if (originalMessage.to === "Database") {
      return "ResultSet";
    }

    if (originalMessage.message.includes("SELECT")) {
      return "Entity[]";
    }

    if (originalMessage.from === "Client") {
      return `HTTP ${this.getExpectedStatusCode(endpoint)}`;
    }

    return "result";
  }

  /**
   * Utility methods
   */
  private sanitizeParticipantId(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, "");
  }

  private removeDuplicateParticipants(
    participants: SequenceParticipant[]
  ): SequenceParticipant[] {
    const seen = new Set<string>();
    return participants.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }

  private sortParticipants(
    participants: SequenceParticipant[]
  ): SequenceParticipant[] {
    const order: SequenceParticipant["type"][] = [
      "client",
      "controller",
      "guard",
      "pipe",
      "interceptor",
      "service",
      "repository",
      "database",
      "external",
    ];

    return participants.sort((a, b) => {
      const aIndex = order.indexOf(a.type);
      const bIndex = order.indexOf(b.type);
      return aIndex - bIndex;
    });
  }

  private updateActivationEndOrders(
    activations: SequenceActivation[],
    messages: SequenceMessage[]
  ): void {
    for (const activation of activations) {
      // Find the last message involving this participant
      let lastOrder = activation.startOrder;
      for (const msg of messages) {
        if (
          msg.from === activation.participant ||
          msg.to === activation.participant
        ) {
          lastOrder = Math.max(lastOrder, msg.order);
        }
      }
      activation.endOrder = lastOrder;
    }
  }

  private estimateDuration(messages: SequenceMessage[]): number {
    // Simple estimation: 50ms per message
    return messages.length * 50;
  }

  private getExpectedStatusCode(endpoint: EndpointInfo): number {
    switch (endpoint.method.toUpperCase()) {
      case "POST":
        return 201;
      case "DELETE":
        return 204;
      default:
        return 200;
    }
  }
}
