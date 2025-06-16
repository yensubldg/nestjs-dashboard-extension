import {
  SequenceDiagram,
  SequenceMessage,
  SequenceNote,
  SequenceParticipant,
} from "../models/SequenceModels";

export class SequenceHelpers {
  /**
   * Sort messages and notes by order for proper sequence flow
   */
  public static sortMessagesAndNotes(
    messages: SequenceMessage[],
    notes: SequenceNote[]
  ): Array<
    | (SequenceMessage & { itemType: "message" })
    | (SequenceNote & { itemType: "note" })
  > {
    const combined: Array<
      | (SequenceMessage & { itemType: "message" })
      | (SequenceNote & { itemType: "note" })
    > = [
      ...messages.map((m) => ({ ...m, itemType: "message" as const })),
      ...notes.map((n) => ({ ...n, itemType: "note" as const })),
    ];

    return combined.sort((a, b) => a.order - b.order);
  }

  /**
   * Validate sequence diagram for correctness
   */
  public static validateSequenceDiagram(sequence: SequenceDiagram): string[] {
    const errors: string[] = [];

    // Check if all message participants exist
    const participantIds = new Set(sequence.participants.map((p) => p.id));

    for (const message of sequence.messages) {
      if (!participantIds.has(message.from)) {
        errors.push(`Message references unknown participant: ${message.from}`);
      }
      if (!participantIds.has(message.to)) {
        errors.push(`Message references unknown participant: ${message.to}`);
      }
    }

    // Check if notes reference valid participants
    for (const note of sequence.notes) {
      if (!participantIds.has(note.participant)) {
        errors.push(`Note references unknown participant: ${note.participant}`);
      }
    }

    // Check for duplicate participants
    const participantNames = sequence.participants.map((p) => p.id);
    const uniqueNames = new Set(participantNames);
    if (participantNames.length !== uniqueNames.size) {
      errors.push("Duplicate participants detected");
    }

    return errors;
  }

  /**
   * Get statistics for sequence diagram
   */
  public static getSequenceStatistics(sequence: SequenceDiagram) {
    const stats = {
      totalParticipants: sequence.participants.length,
      totalMessages: sequence.messages.length,
      totalNotes: sequence.notes.length,
      totalActivations: sequence.activations.length,
      estimatedDuration: sequence.metadata?.estimatedDuration || 0,
      messageTypes: this.getMessageTypeStats(sequence.messages),
      participantTypes: this.getParticipantTypeStats(sequence.participants),
      complexity: this.calculateComplexity(sequence),
    };

    return stats;
  }

  /**
   * Calculate complexity score for sequence diagram
   */
  public static calculateComplexity(sequence: SequenceDiagram): {
    score: number;
    level: "Low" | "Medium" | "High";
    factors: string[];
  } {
    let score = 0;
    const factors: string[] = [];

    // Base score from participants
    score += sequence.participants.length * 2;
    if (sequence.participants.length > 5) {
      factors.push("Many participants");
    }

    // Score from messages
    score += sequence.messages.length;
    if (sequence.messages.length > 10) {
      factors.push("Many messages");
    }

    // Score from activations (nested calls)
    score += sequence.activations.length * 1.5;
    if (sequence.activations.length > 3) {
      factors.push("Deep call stack");
    }

    // Score from return messages
    const returnMessages = sequence.messages.filter((m) => m.type === "return");
    if (returnMessages.length > 5) {
      score += 5;
      factors.push("Many return paths");
    }

    // Score from middleware
    const middlewareParticipants = sequence.participants.filter((p) =>
      ["guard", "pipe", "interceptor"].includes(p.type)
    );
    if (middlewareParticipants.length > 2) {
      score += 3;
      factors.push("Complex middleware");
    }

    // Determine level
    let level: "Low" | "Medium" | "High";
    if (score <= 10) {
      level = "Low";
    } else if (score <= 25) {
      level = "Medium";
    } else {
      level = "High";
    }

    return { score, level, factors };
  }

  /**
   * Get message type statistics
   */
  private static getMessageTypeStats(
    messages: SequenceMessage[]
  ): Record<string, number> {
    const stats: Record<string, number> = {
      sync: 0,
      async: 0,
      return: 0,
    };

    for (const message of messages) {
      stats[message.type]++;
    }

    return stats;
  }

  /**
   * Get participant type statistics
   */
  private static getParticipantTypeStats(
    participants: SequenceParticipant[]
  ): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const participant of participants) {
      stats[participant.type] = (stats[participant.type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Filter sequence diagram by configuration
   */
  public static filterSequence(
    sequence: SequenceDiagram,
    filters: {
      includeMiddleware?: boolean;
      includeReturnMessages?: boolean;
      includeDatabase?: boolean;
      maxDepth?: number;
    }
  ): SequenceDiagram {
    let filteredParticipants = [...sequence.participants];
    let filteredMessages = [...sequence.messages];
    let filteredNotes = [...sequence.notes];
    let filteredActivations = [...sequence.activations];

    // Filter middleware
    if (!filters.includeMiddleware) {
      const middlewareTypes = ["guard", "pipe", "interceptor"];
      const middlewareIds = filteredParticipants
        .filter((p) => middlewareTypes.includes(p.type))
        .map((p) => p.id);

      filteredParticipants = filteredParticipants.filter(
        (p) => !middlewareTypes.includes(p.type)
      );
      filteredMessages = filteredMessages.filter(
        (m) => !middlewareIds.includes(m.from) && !middlewareIds.includes(m.to)
      );
      filteredNotes = filteredNotes.filter(
        (n) => !middlewareIds.includes(n.participant)
      );
      filteredActivations = filteredActivations.filter(
        (a) => !middlewareIds.includes(a.participant)
      );
    }

    // Filter return messages
    if (!filters.includeReturnMessages) {
      filteredMessages = filteredMessages.filter((m) => m.type !== "return");
    }

    // Filter database
    if (!filters.includeDatabase) {
      filteredParticipants = filteredParticipants.filter(
        (p) => p.type !== "database"
      );
      filteredMessages = filteredMessages.filter(
        (m) => m.from !== "Database" && m.to !== "Database"
      );
      filteredNotes = filteredNotes.filter((n) => n.participant !== "Database");
      filteredActivations = filteredActivations.filter(
        (a) => a.participant !== "Database"
      );
    }

    return {
      ...sequence,
      participants: filteredParticipants,
      messages: filteredMessages,
      notes: filteredNotes,
      activations: filteredActivations,
    };
  }

  /**
   * Sanitize text for diagram generation
   */
  public static sanitizeText(text: string): string {
    return text
      .replace(/[<>]/g, "") // Remove angle brackets
      .replace(/["|'`]/g, "") // Remove quotes and backticks
      .replace(/\n/g, " ") // Replace newlines with spaces
      .replace(/:/g, " -") // Replace colons which conflict with Mermaid syntax
      .replace(/;/g, ",") // Replace semicolons
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();
  }

  /**
   * Generate unique ID for participant
   */
  public static generateParticipantId(name: string, type: string): string {
    const sanitized = name.replace(/[^a-zA-Z0-9]/g, "");
    return `${type}_${sanitized}`;
  }

  /**
   * Estimate timing information for messages
   */
  public static estimateMessageTiming(message: SequenceMessage): number {
    const baseTiming = 50; // 50ms base

    if (message.to === "Database") {
      return baseTiming + 100; // Database calls are slower
    }

    if (message.type === "return") {
      return baseTiming * 0.3; // Return messages are faster
    }

    if (
      message.message.includes("validate") ||
      message.message.includes("guard")
    ) {
      return baseTiming + 20; // Validation takes extra time
    }

    return baseTiming;
  }
}
