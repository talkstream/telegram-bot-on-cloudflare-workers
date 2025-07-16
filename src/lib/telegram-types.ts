import { z } from 'zod';

// Basic Telegram types (simplified for demonstration)
export const UserSchema = z.object({
  id: z.number(),
  is_bot: z.boolean(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
});

export const ChatSchema = z.object({
  id: z.number(),
  type: z.enum(['private', 'group', 'supergroup', 'channel']),
  title: z.string().optional(),
  username: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});

export const MessageSchema = z.object({
  message_id: z.number(),
  from: UserSchema.optional(),
  sender_chat: ChatSchema.optional(),
  date: z.number(),
  chat: ChatSchema,
  text: z.string().optional(),
  // Add other message types as needed (photo, document, etc.)
});

export const UpdateSchema = z.object({
  update_id: z.number(),
  message: MessageSchema.optional(),
  edited_message: MessageSchema.optional(),
  channel_post: MessageSchema.optional(),
  edited_channel_post: MessageSchema.optional(),
  // Add other update types as needed (callback_query, inline_query, etc.)
});

export type TelegramUpdate = z.infer<typeof UpdateSchema>;
export type TelegramMessage = z.infer<typeof MessageSchema>;
export type TelegramUser = z.infer<typeof UserSchema>;
export type TelegramChat = z.infer<typeof ChatSchema>;
