export interface SequenceParticipant {
  id: string;
  name: string;
  type:
    | "client"
    | "controller"
    | "service"
    | "repository"
    | "database"
    | "external"
    | "guard"
    | "pipe"
    | "interceptor";
  stereotype?: string;
  filePath?: string;
  lineNumber?: number;
}

export interface SequenceMessage {
  from: string;
  to: string;
  message: string;
  type: "sync" | "async" | "return";
  order: number;
  metadata?: {
    httpMethod?: string;
    statusCode?: number;
    parameters?: string[];
    returnType?: string;
    duration?: number;
    isDemo?: boolean;
  };
}

export interface SequenceNote {
  participant: string;
  content: string;
  position: "left" | "right" | "over";
  order: number;
  type?: "info" | "warning" | "error";
}

export interface SequenceActivation {
  participant: string;
  startOrder: number;
  endOrder: number;
}

export interface SequenceDiagram {
  title: string;
  participants: SequenceParticipant[];
  messages: SequenceMessage[];
  notes: SequenceNote[];
  activations: SequenceActivation[];
  metadata?: {
    endpoint?: string;
    method?: string;
    controller?: string;
    estimatedDuration?: number;
  };
}

export interface SequenceConfig {
  type: "mermaid" | "plantuml";
  includeReturnMessages: boolean;
  includeDatabase: boolean;
  includeMiddleware: boolean;
  showParameterTypes: boolean;
  showTimings: boolean;
  maxDepth: number;
}
