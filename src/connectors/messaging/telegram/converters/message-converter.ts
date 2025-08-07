/**
 * Converter between Telegram messages and UnifiedMessage format
 */

import type {
  Chat,
  Message,
  MessageEntity as TelegramMessageEntity,
  Update,
  User
} from 'grammy/types'

import type {
  Attachment,
  MessageContent,
  MessageEntity,
  Chat as UnifiedChat,
  UnifiedMessage,
  User as UnifiedUser
} from '../../../../core/interfaces/messaging.js'
import {
  AttachmentType,
  ChatType,
  EntityType,
  MessageType,
  Platform
} from '../../../../core/interfaces/messaging.js'

/**
 * Convert Telegram Update to UnifiedMessage
 */
export function telegramUpdateToUnifiedMessage(update: Update): UnifiedMessage | null {
  if ('message' in update && update.message) {
    return telegramMessageToUnified(update.message)
  }

  if ('edited_message' in update && update.edited_message) {
    return telegramMessageToUnified(update.edited_message, true)
  }

  if ('channel_post' in update && update.channel_post) {
    return telegramMessageToUnified(update.channel_post)
  }

  if ('edited_channel_post' in update && update.edited_channel_post) {
    return telegramMessageToUnified(update.edited_channel_post, true)
  }

  // Callback queries, inline queries etc. are not messages
  return null
}

/**
 * Convert Telegram Message to UnifiedMessage
 */
export function telegramMessageToUnified(message: Message, isEdited = false): UnifiedMessage {
  const unifiedMessage: UnifiedMessage = {
    id: message.message_id.toString(),
    platform: Platform.TELEGRAM,
    sender: telegramUserToUnified(message.from),
    chat: telegramChatToUnified(message.chat),
    content: extractMessageContent(message),
    timestamp: message.date * 1000,
    metadata: {
      isEdited,
      telegramMessageId: message.message_id
    }
  }

  // Add reply info if present
  if (message.reply_to_message) {
    unifiedMessage.replyTo = message.reply_to_message.message_id.toString()
  }

  // Add attachments
  const attachments = extractAttachments(message)
  if (attachments.length > 0) {
    unifiedMessage.attachments = attachments
  }

  return unifiedMessage
}

/**
 * Convert Telegram User to UnifiedUser
 */
export function telegramUserToUnified(user?: User): UnifiedUser | undefined {
  if (!user) return undefined

  return {
    id: user.id.toString(),
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    is_bot: user.is_bot,
    metadata: {
      language_code: user.language_code,
      is_premium: user.is_premium
    }
  }
}

/**
 * Convert Telegram Chat to UnifiedChat
 */
export function telegramChatToUnified(chat: Chat): UnifiedChat {
  let type: ChatType

  switch (chat.type) {
    case 'private':
      type = ChatType.PRIVATE
      break
    case 'group':
      type = ChatType.GROUP
      break
    case 'supergroup':
      type = ChatType.SUPERGROUP
      break
    case 'channel':
      type = ChatType.CHANNEL
      break
    default:
      type = ChatType.PRIVATE
  }

  return {
    id: chat.id.toString(),
    type,
    title: 'title' in chat ? chat.title : undefined,
    username: 'username' in chat ? chat.username : undefined,
    description: 'description' in chat ? (chat.description as string) : undefined,
    metadata: {
      telegramChatId: chat.id
    }
  }
}

/**
 * Extract message content from Telegram message
 */
function extractMessageContent(message: Message): MessageContent {
  const content: MessageContent = {
    type: getMessageType(message)
  }

  // Extract text
  if (message.text) {
    content.text = message.text
  } else if (message.caption) {
    content.text = message.caption
  }

  // Extract entities
  const entities = message.entities || message.caption_entities
  if (entities && entities.length > 0) {
    content.entities = entities.map(telegramEntityToUnified)
  }

  return content
}

/**
 * Get message type from Telegram message
 */
function getMessageType(message: Message): MessageType {
  if (message.photo) return MessageType.IMAGE
  if (message.video) return MessageType.VIDEO
  if (message.audio || message.voice) return MessageType.AUDIO
  if (message.document) return MessageType.DOCUMENT
  if (message.sticker) return MessageType.STICKER
  if (message.location) return MessageType.LOCATION
  if (message.contact) return MessageType.CONTACT
  if (message.poll) return MessageType.POLL
  return MessageType.TEXT
}

/**
 * Extract attachments from Telegram message
 */
function extractAttachments(message: Message): Attachment[] {
  const attachments: Attachment[] = []

  if (message.photo && message.photo.length > 0) {
    // Get the largest photo
    const photo = message.photo[message.photo.length - 1]
    if (photo) {
      attachments.push({
        type: AttachmentType.PHOTO,
        file_id: photo.file_id,
        file_size: photo.file_size,
        width: photo.width,
        height: photo.height
      })
    }
  }

  if (message.video) {
    attachments.push({
      type: AttachmentType.VIDEO,
      file_id: message.video.file_id,
      file_size: message.video.file_size,
      width: message.video.width,
      height: message.video.height,
      duration: message.video.duration,
      mime_type: message.video.mime_type,
      thumbnail: message.video.thumbnail
        ? {
            type: AttachmentType.PHOTO,
            file_id: message.video.thumbnail.file_id,
            file_size: message.video.thumbnail.file_size,
            width: message.video.thumbnail.width,
            height: message.video.thumbnail.height
          }
        : undefined
    })
  }

  if (message.audio) {
    attachments.push({
      type: AttachmentType.AUDIO,
      file_id: message.audio.file_id,
      file_size: message.audio.file_size,
      duration: message.audio.duration,
      mime_type: message.audio.mime_type,
      file_name: message.audio.file_name
    })
  }

  if (message.voice) {
    attachments.push({
      type: AttachmentType.VOICE,
      file_id: message.voice.file_id,
      file_size: message.voice.file_size,
      duration: message.voice.duration,
      mime_type: message.voice.mime_type
    })
  }

  if (message.document) {
    attachments.push({
      type: AttachmentType.DOCUMENT,
      file_id: message.document.file_id,
      file_size: message.document.file_size,
      mime_type: message.document.mime_type,
      file_name: message.document.file_name,
      thumbnail: message.document.thumbnail
        ? {
            type: AttachmentType.PHOTO,
            file_id: message.document.thumbnail.file_id,
            file_size: message.document.thumbnail.file_size,
            width: message.document.thumbnail.width,
            height: message.document.thumbnail.height
          }
        : undefined
    })
  }

  if (message.sticker) {
    attachments.push({
      type: AttachmentType.STICKER,
      file_id: message.sticker.file_id,
      file_size: message.sticker.file_size,
      width: message.sticker.width,
      height: message.sticker.height
    })
  }

  if (message.animation) {
    attachments.push({
      type: AttachmentType.ANIMATION,
      file_id: message.animation.file_id,
      file_size: message.animation.file_size,
      width: message.animation.width,
      height: message.animation.height,
      duration: message.animation.duration,
      mime_type: message.animation.mime_type
    })
  }

  if (message.video_note) {
    attachments.push({
      type: AttachmentType.VIDEO_NOTE,
      file_id: message.video_note.file_id,
      file_size: message.video_note.file_size,
      duration: message.video_note.duration
    })
  }

  return attachments
}

/**
 * Convert Telegram entity to unified entity
 */
function telegramEntityToUnified(entity: TelegramMessageEntity): MessageEntity {
  let type: EntityType

  switch (entity.type) {
    case 'mention':
      type = EntityType.MENTION
      break
    case 'hashtag':
      type = EntityType.HASHTAG
      break
    case 'url':
      type = EntityType.URL
      break
    case 'email':
      type = EntityType.EMAIL
      break
    case 'phone_number':
      type = EntityType.PHONE
      break
    case 'bold':
      type = EntityType.BOLD
      break
    case 'italic':
      type = EntityType.ITALIC
      break
    case 'code':
      type = EntityType.CODE
      break
    case 'pre':
      type = EntityType.PRE
      break
    case 'text_link':
      type = EntityType.LINK
      break
    default:
      type = EntityType.MENTION // fallback
  }

  const unifiedEntity: MessageEntity = {
    type,
    offset: entity.offset,
    length: entity.length
  }

  if ('url' in entity && entity.url) {
    unifiedEntity.url = entity.url
  }

  if ('language' in entity && entity.language) {
    unifiedEntity.language = entity.language
  }

  return unifiedEntity
}
