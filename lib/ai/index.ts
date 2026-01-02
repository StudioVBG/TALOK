/**
 * Module AI - Index Principal
 * SOTA 2026 - Architecture AI-First
 * 
 * Ce module regroupe tous les services et utilitaires IA :
 * - Configuration des modèles LLM
 * - RAG (Retrieval Augmented Generation)
 * - Voice (Whisper transcription)
 * - Monitoring (Langfuse)
 */

// Configuration
export * from "./config";
export * from "./tools-schema";

// RAG
export * from "./rag";

// Voice
export * from "./voice";

// Monitoring
export * from "./monitoring";

