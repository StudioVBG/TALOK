-- Migration: Add ticket_id to conversations table for ticket-chat integration

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_ticket_id ON conversations(ticket_id);
