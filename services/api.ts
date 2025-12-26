import { ChatDTO, ThreadingDTO, ChunkMessage, ApiResponse, PaginationResponse, ConversionVO, MessageEntity } from '../types';

const BASE_URL = 'http://localhost:8000';

/**
 * Initiates the chat to get the message_uuid.
 */
export const fetchCompletion = async (prompt: string, conversionId?: string): Promise<string> => {
  const payload: ChatDTO = {
    prompt,
    user_id: 'admin',
    conversion_uuid: conversionId || crypto.randomUUID(), 
  };

  const response = await fetch(`${BASE_URL}/chat/completion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to start chat: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  // Extract message_uuid safely handling both string and object wrappers
  if (data.data && typeof data.data === 'string') {
    return data.data;
  }
  
  // If data.data is an object containing message_uuid (common in some controller setups)
  if (data.data && typeof data.data === 'object' && data.data.message_uuid) {
    return data.data.message_uuid;
  }
  
  console.error("Unexpected response structure:", data);
  throw new Error("Could not extract message_uuid from completion response");
};

/**
 * Connects to the threading endpoint and yields chunks.
 */
export async function* streamThreading(messageUuid: string): AsyncGenerator<ChunkMessage, void, unknown> {
  // Guard clause to ensure we are sending a string
  if (typeof messageUuid !== 'string') {
    throw new Error(`Invalid message_uuid: expected string, got ${typeof messageUuid}`);
  }

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
    const errorText = await response.text();
    throw new Error(`Failed to stream threading: ${response.status} ${errorText}`);
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
                // Support SSE format just in case, though usually raw JSON stream
                const cleanLine = line.replace(/^data: /, '');
                const json = JSON.parse(cleanLine);
                yield json;
            } catch (e) {
                console.warn('Failed to parse chunk JSON', line);
            }
        }
      }
    }
    
    if (buffer.trim()) {
        try {
            const cleanLine = buffer.replace(/^data: /, '');
            const json = JSON.parse(cleanLine);
            yield json;
        } catch (e) {
            console.warn('Failed to parse final chunk', buffer);
        }
    }

  } finally {
    reader.releaseLock();
  }
}

// --- Conversation API ---

export const fetchConversations = async (userId: string = 'admin', page: number = 1, pageSize: number = 20): Promise<PaginationResponse<ConversionVO>> => {
  const params = new URLSearchParams({
    user_id: userId,
    page_num: page.toString(),
    page_size: pageSize.toString()
  });

  const response = await fetch(`${BASE_URL}/conversion/list?${params}`);
  if (!response.ok) throw new Error('Failed to fetch conversations');
  
  const json: ApiResponse<PaginationResponse<ConversionVO>> = await response.json();
  if (json.code !== 200 || !json.data) throw new Error(json.message || 'Error fetching list');
  
  return json.data;
};

export const fetchConversationDetail = async (uuid: string): Promise<MessageEntity[]> => {
  const response = await fetch(`${BASE_URL}/conversion/get/${uuid}`);
  if (!response.ok) throw new Error('Failed to fetch conversation details');
  
  const json: ApiResponse<MessageEntity[]> = await response.json();
  if (json.code !== 200 || !json.data) throw new Error(json.message || 'Error fetching details');
  
  return json.data;
};

export const deleteConversation = async (uuid: string): Promise<void> => {
  const response = await fetch(`${BASE_URL}/conversion/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid })
  });
  
  if (!response.ok) throw new Error('Failed to delete conversation');
  const json = await response.json();
  if (json.code !== 200) throw new Error(json.message);
};

export const updateConversation = async (uuid: string, title: string): Promise<void> => {
  const response = await fetch(`${BASE_URL}/conversion/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uuid, title })
  });
  
  if (!response.ok) throw new Error('Failed to update conversation');
  const json = await response.json();
  if (json.code !== 200) throw new Error(json.message);
};
