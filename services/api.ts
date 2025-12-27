import { ChatDTO, ThreadingDTO, ChunkMessage, PaginationResponse, ConversionVO, MessageEntity } from '../types';

// Use environment variable for API URL with a fallback to localhost
// Remove trailing slash if present to prevent double slashes in requests
const BASE_URL = ((import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const DEFAULT_USER_ID = 'admin';

/**
 * Initiates the chat.
 * @param prompt The user message.
 * @param conversionUuid The conversation ID if continuing a chat, or null for a new one.
 * @returns Object containing messageUuid and the (potentially new) conversionUuid.
 */
export const fetchCompletion = async (prompt: string, conversionUuid: string | null): Promise<{ messageUuid: string; conversionUuid: string }> => {
  const payload: ChatDTO = {
    prompt,
    user_id: DEFAULT_USER_ID,
    conversion_uuid: conversionUuid,
  };

  const response = await fetch(`${BASE_URL}/chat/completion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to start chat: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Adapt to potential API response structures. 
  const messageUuid = data.message_uuid || data.data?.message_uuid || (typeof data.data === 'string' ? data.data : null);
  const newConversionUuid = data.conversion_uuid || data.data?.conversion_uuid;

  if (!messageUuid) {
      throw new Error('API response missing message_uuid');
  }

  return { 
      messageUuid, 
      conversionUuid: newConversionUuid || conversionUuid || '' 
  };
};

/**
 * Connects to the threading endpoint and yields chunks.
 * Explicitly does NOT send conversion_uuid.
 * Accepts an optional AbortSignal to cancel the stream.
 */
export async function* streamThreading(messageUuid: string, signal?: AbortSignal): AsyncGenerator<ChunkMessage, void, unknown> {
  const payload: ThreadingDTO = {
    message_uuid: messageUuid,
  };

  const response = await fetch(`${BASE_URL}/chat/threading`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to stream threading: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      buffer += chunk;

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
            try {
                const cleanLine = line.replace(/^data: /, '');
                const json = JSON.parse(cleanLine);
                yield json;
            } catch (e) {
                console.warn('Failed to parse chunk JSON', line, e);
            }
        }
      }
    }
    
    if (buffer.trim()) {
        try {
            const json = JSON.parse(buffer);
            yield json;
        } catch (e) {
            console.warn('Failed to parse final chunk', buffer);
        }
    }

  } finally {
    reader.releaseLock();
  }
}

/**
 * Fetches the list of conversations.
 */
export const fetchHistory = async (page: number = 1, pageSize: number = 20): Promise<PaginationResponse<ConversionVO>> => {
  const params = new URLSearchParams({
    user_id: DEFAULT_USER_ID,
    page_num: page.toString(),
    page_size: pageSize.toString()
  });

  const response = await fetch(`${BASE_URL}/conversion/list?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch history: ${response.statusText}`);
  }
  
  const result = await response.json();
  return result.data;
};

/**
 * Fetches details (messages) for a specific conversation.
 */
export const fetchConversationDetail = async (uuid: string): Promise<MessageEntity[]> => {
  const response = await fetch(`${BASE_URL}/conversion/get/${uuid}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch conversation details: ${response.statusText}`);
  }
  
  const result = await response.json();
  return result.data; // Returns List[MessageEntity]
};

/**
 * Deletes a conversation.
 */
export const deleteConversation = async (uuid: string): Promise<void> => {
  const response = await fetch(`${BASE_URL}/conversion/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to delete conversation: ${response.statusText}`);
  }
};

/**
 * Updates a conversation (e.g. rename).
 */
export const updateConversation = async (uuid: string, title: string): Promise<void> => {
  const response = await fetch(`${BASE_URL}/conversion/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid, title })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to update conversation: ${response.statusText}`);
  }
};