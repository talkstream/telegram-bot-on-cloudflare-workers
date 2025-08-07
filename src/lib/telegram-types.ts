import { z } from 'zod'

// Basic Telegram types (simplified for demonstration)
export const UserSchema = z.object({
  id: z.number(),
  is_bot: z.boolean(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional()
})

export const ChatSchema = z.object({
  id: z.number(),
  type: z.enum(['private', 'group', 'supergroup', 'channel']),
  title: z.string().optional(),
  username: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional()
})

// Bot API 9.1 - Checklist types
export const ChecklistTaskSchema = z.object({
  text: z.string(),
  is_done: z.boolean()
})

export const ChecklistSchema = z.object({
  title: z.string().optional(),
  tasks: z.array(ChecklistTaskSchema),
  task_count: z.number(),
  done_task_count: z.number()
})

export const InputChecklistTaskSchema = z.object({
  text: z.string(),
  is_done: z.boolean().optional()
})

export const InputChecklistSchema = z.object({
  title: z.string().optional(),
  tasks: z.array(InputChecklistTaskSchema)
})

// Bot API 9.1 - Gift and Stars types
export const StarAmountSchema = z.object({
  amount: z.number()
})

export const GiftSchema = z.object({
  id: z.string(),
  sticker: z.object({
    file_id: z.string(),
    file_unique_id: z.string(),
    type: z.enum(['regular', 'mask', 'custom_emoji']),
    width: z.number(),
    height: z.number(),
    is_animated: z.boolean(),
    is_video: z.boolean(),
    thumbnail: z.any().optional(),
    emoji: z.string().optional(),
    set_name: z.string().optional()
  }),
  star_count: z.number(),
  total_count: z.number().optional(),
  remaining_count: z.number().optional()
})

export const MessageSchema = z.object({
  message_id: z.number(),
  from: UserSchema.optional(),
  sender_chat: ChatSchema.optional(),
  date: z.number(),
  chat: ChatSchema,
  text: z.string().optional(),
  checklist: ChecklistSchema.optional() // Bot API 9.1
  // Add other message types as needed (photo, document, etc.)
})

// Bot API 9.1 - Service messages for checklists
export const ChecklistTasksAddedSchema = z.object({
  tasks: z.array(ChecklistTaskSchema)
})

export const ChecklistTasksDoneSchema = z.object({
  tasks: z.array(
    z.object({
      task_index: z.number(),
      is_done: z.boolean()
    })
  )
})

export const UpdateSchema = z.object({
  update_id: z.number(),
  message: MessageSchema.optional(),
  edited_message: MessageSchema.optional(),
  channel_post: MessageSchema.optional(),
  edited_channel_post: MessageSchema.optional()
  // Add other update types as needed (callback_query, inline_query, etc.)
})

// Export types
export type TelegramUpdate = z.infer<typeof UpdateSchema>
export type TelegramMessage = z.infer<typeof MessageSchema>
export type TelegramUser = z.infer<typeof UserSchema>
export type TelegramChat = z.infer<typeof ChatSchema>

// Bot API 9.1 types
export type ChecklistTask = z.infer<typeof ChecklistTaskSchema>
export type Checklist = z.infer<typeof ChecklistSchema>
export type InputChecklistTask = z.infer<typeof InputChecklistTaskSchema>
export type InputChecklist = z.infer<typeof InputChecklistSchema>
export type StarAmount = z.infer<typeof StarAmountSchema>
export type Gift = z.infer<typeof GiftSchema>
export type ChecklistTasksAdded = z.infer<typeof ChecklistTasksAddedSchema>
export type ChecklistTasksDone = z.infer<typeof ChecklistTasksDoneSchema>

// Extended Gift type for service usage
export interface ServiceGift {
  id: string
  name: string
  price: number
  currency: string
  description?: string
}
