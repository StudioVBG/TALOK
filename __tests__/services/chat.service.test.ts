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
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({ data: mockConversations, count: 1 }),
          };
        }
        return (mockSupabase.from as any)(table);
      }) as any);

      const { chatService } = await import("@/lib/services/chat.service");
      const result = await chatService.getConversations();

      expect(result.data).toHaveLength(1);
      expect(result.data[0].owner_name).toBe("John Doe");
      expect(result.data[0].tenant_name).toBe("Jane Smith");
      expect(result.count).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it("should respect limit and offset parameters via .range()", async () => {
      const mockUser = { id: "user-123" };
      const mockProfile = { id: "profile-123" };
      const rangeMock = vi.fn().mockResolvedValue({ data: [], count: 0 });

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
            order: vi.fn().mockReturnThis(),
            range: rangeMock,
          };
        }
        return (mockSupabase.from as any)(table);
      }) as any);

      const { chatService } = await import("@/lib/services/chat.service");
      await chatService.getConversations({ limit: 10, offset: 20 });

      expect(rangeMock).toHaveBeenCalledWith(20, 29);
    });

    it("should default to limit=25 offset=0 when no params", async () => {
      const mockUser = { id: "user-123" };
      const mockProfile = { id: "profile-123" };
      const rangeMock = vi.fn().mockResolvedValue({ data: [], count: 0 });

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
            order: vi.fn().mockReturnThis(),
            range: rangeMock,
          };
        }
        return (mockSupabase.from as any)(table);
      }) as any);

      const { chatService } = await import("@/lib/services/chat.service");
      await chatService.getConversations();

      expect(rangeMock).toHaveBeenCalledWith(0, 24);
    });

    it("should return hasMore=true when more results exist", async () => {
      const mockUser = { id: "user-123" };
      const mockProfile = { id: "profile-123" };
      const mockConversations = Array.from({ length: 25 }, (_, i) => ({
        id: `conv-${i}`,
        owner_profile_id: "profile-123",
        tenant_profile_id: "profile-456",
        owner: { prenom: "O", nom: "" },
        tenant: { prenom: "T", nom: "" },
        property: { adresse_complete: "" },
      }));

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
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({ data: mockConversations, count: 100 }),
          };
        }
        return (mockSupabase.from as any)(table);
      }) as any);

      const { chatService } = await import("@/lib/services/chat.service");
      const result = await chatService.getConversations({ limit: 25, offset: 0 });

      expect(result.data).toHaveLength(25);
      expect(result.count).toBe(100);
      expect(result.hasMore).toBe(true);
    });

    it("should return hasMore=false on last page", async () => {
      const mockUser = { id: "user-123" };
      const mockProfile = { id: "profile-123" };
      const mockConversations = Array.from({ length: 5 }, (_, i) => ({
        id: `conv-${i}`,
        owner_profile_id: "profile-123",
        tenant_profile_id: "profile-456",
        owner: { prenom: "O", nom: "" },
        tenant: { prenom: "T", nom: "" },
        property: { adresse_complete: "" },
      }));

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
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({ data: mockConversations, count: 30 }),
          };
        }
        return (mockSupabase.from as any)(table);
      }) as any);

      const { chatService } = await import("@/lib/services/chat.service");
      const result = await chatService.getConversations({ limit: 25, offset: 25 });

      expect(result.data).toHaveLength(5);
      expect(result.count).toBe(30);
      expect(result.hasMore).toBe(false);
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

