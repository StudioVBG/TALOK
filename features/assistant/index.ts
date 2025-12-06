/**
 * Assistant IA - Module Export
 * SOTA Décembre 2025 - GPT-5.1 + LangGraph
 */

// Graph principal
export { 
  propertyAssistantGraph, 
  invokeAssistant, 
  streamAssistant,
  type AssistantInvokeParams,
  type AssistantInvokeResult,
} from "./ai/property-assistant.graph";

// Types
export * from "./ai/types";

// Tools
export * from "./ai/tools";

// Service
export { 
  assistantService, 
  AssistantService,
  type ConversationThread,
  type ThreadMessage,
} from "./services/assistant.service";

