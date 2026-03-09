-- Migration: Allow users to update their own messages (edit + soft-delete)
-- Needed for message edit/delete feature

-- Policy for UPDATE: users can only update their own messages in their conversations
DROP POLICY IF EXISTS "Users can update own messages" ON messages;
CREATE POLICY "Users can update own messages"
  ON messages FOR UPDATE
  USING (
    sender_profile_id = public.user_profile_id()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.owner_profile_id = public.user_profile_id() OR c.tenant_profile_id = public.user_profile_id())
    )
  )
  WITH CHECK (
    sender_profile_id = public.user_profile_id()
  );
