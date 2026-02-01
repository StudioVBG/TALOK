/**
 * Tests du service de Chat
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn(),
  })),
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    unsubscribe: vi.fn(),
  })),
  rpc: vi.fn(),
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

describe("ChatService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getConversations", () => {
    it("should return empty array when user is not authenticated", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      
      const { chatService } = await import("@/lib/services/chat.service");
      
      await expect(chatService.getConversations()).rejects.toThrow("Non authentifié");
    });

    it("should fetch conversations for authenticated user", async () => {
      const mockUser = { id: "user-123" };
      const mockProfile = { id: "profile-123" };
      const mockConversations = [
        {
          id: "conv-1",
          owner_profile_id: "profile-123",
          tenant_profile_id: "profile-456",
          last_message_at: "2025-01-01T10:00:00Z",
          owner: { prenom: "John", nom: "Doe" },
          tenant: { prenom: "Jane", nom: "Smith" },
          property: { adresse_complete: "123 Rue Test", ville: "Paris" },
        },
      ];

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
      mockSupabase.from.mockImplementation(((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockProfile }),
          };
        }
        if (table === "conversations") {
          return {
            select: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockConversations }),
          };
        }
        return (mockSupabase.from as any)(table);
      }) as any);

      const { chatService } = await import("@/lib/services/chat.service");
      const conversations = await chatService.getConversations();

      expect(conversations).toHaveLength(1);
      expect(conversations[0].owner_name).toBe("John Doe");
      expect(conversations[0].tenant_name).toBe("Jane Smith");
    });
  });

  describe("sendMessage", () => {
    it("should throw error when user is not authenticated", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
      
      const { chatService } = await import("@/lib/services/chat.service");
      
      await expect(
        chatService.sendMessage({
          conversation_id: "conv-1",
          content: "Hello",
        })
      ).rejects.toThrow("Non authentifié");
    });

    it("should send message with correct sender role", async () => {
      const mockUser = { id: "user-123" };
      const mockProfile = { id: "profile-123" };
      const mockConversation = {
        owner_profile_id: "profile-123",
        tenant_profile_id: "profile-456",
      };
      const mockMessage = {
        id: "msg-1",
        conversation_id: "conv-1",
        content: "Hello",
        sender_profile_id: "profile-123",
        sender_role: "owner",
        sender: { prenom: "John", nom: "Doe" },
      };

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
      
      let insertedData: any = null;
      mockSupabase.from.mockImplementation(((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockProfile }),
          };
        }
        if (table === "conversations") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockConversation }),
          };
        }
        if (table === "messages") {
          return {
            insert: vi.fn((data: any) => {
              insertedData = data;
              return {
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: mockMessage }),
              };
            }),
          };
        }
        return (mockSupabase.from as any)(table);
      }) as any);

      const { chatService } = await import("@/lib/services/chat.service");
      const message = await chatService.sendMessage({
        conversation_id: "conv-1",
        content: "Hello",
      });

      expect(message.content).toBe("Hello");
      expect(message.sender_role).toBe("owner");
    });
  });

  describe("markAsRead", () => {
    it("should call RPC to mark messages as read", async () => {
      const mockUser = { id: "user-123" };
      const mockProfile = { id: "profile-123" };

      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });
      mockSupabase.from.mockImplementation(((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockProfile }),
          };
        }
        return (mockSupabase.from as any)(table);
      }) as any);
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

      const { chatService } = await import("@/lib/services/chat.service");
      await chatService.markAsRead("conv-1");

      expect(mockSupabase.rpc).toHaveBeenCalledWith("mark_messages_as_read", {
        p_conversation_id: "conv-1",
        p_reader_profile_id: "profile-123",
      });
    });
  });
});

