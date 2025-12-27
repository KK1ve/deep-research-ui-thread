import { ChatDTO, ThreadingDTO, ChunkMessage } from '../types';

const BASE_URL = 'http://localhost:8000';

/**
 * Initiates the chat.
 * @param prompt The user message.
 * @param conversionUuid The conversation ID if continuing a chat, or null for a new one.
 * @returns Object containing messageUuid and the (potentially new) conversionUuid.
 */
export const fetchCompletion = async (prompt: string, conversionUuid: string | null): Promise<{ messageUuid: string; conversionUuid: string }> => {
  const payload: ChatDTO = {
    prompt,
    user_id: 'admin',
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
  // Assuming data contains message_uuid and conversion_uuid, 
  // or data.data contains them.
  const messageUuid = data.message_uuid || data.data?.message_uuid || (typeof data.data === 'string' ? data.data : null);
  const newConversionUuid = data.conversion_uuid || data.data?.conversion_uuid;

  if (!messageUuid) {
      throw new Error('API response missing message_uuid');
  }

  return { 
      messageUuid, 
      conversionUuid: newConversionUuid || conversionUuid || '' // Fallback to existing or empty if not returned (should ideally be returned)
  };
};

/**
 * Connects to the threading endpoint and yields chunks.
 * Explicitly does NOT send conversion_uuid.
 */
export async function* streamThreading(messageUuid: string): AsyncGenerator<ChunkMessage, void, unknown> {
  const payload: ThreadingDTO = {
    message_uuid: messageUuid,
  };

  const response = await fetch(`${BASE_URL}/chat/threading`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
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

      // Simple NDJSON parser
      const lines = buffer.split('\n');
      // Keep the last line in the buffer as it might be incomplete
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
            try {
                // Remove any "data: " prefix if using SSE format accidentally mixed in
                const cleanLine = line.replace(/^data: /, '');
                const json = JSON.parse(cleanLine);
                yield json;
            } catch (e) {
                console.warn('Failed to parse chunk JSON', line, e);
            }
        }
      }
    }
    
    // Process remaining buffer
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