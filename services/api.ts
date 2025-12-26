import { ChatDTO, ThreadingDTO, ChunkMessage } from '../types';

const BASE_URL = 'http://localhost:8000';

/**
 * Initiates the chat to get the message_uuid.
 */
export const fetchCompletion = async (prompt: string): Promise<string> => {
  const payload: ChatDTO = {
    prompt,
    user_id: 'admin',
    conversion_uuid: crypto.randomUUID(), // Generate a client-side UUID if needed or null
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
  // Assuming the structure based on DefaultResponseVo_MessageVO_
  // The API likely returns the message_uuid in data.data or similar. 
  // Based on standard patterns, let's assume data.data is the UUID string or an object containing it.
  // Adjusting based on typical FastApi implementations:
  return data.data; 
};

/**
 * Connects to the threading endpoint and yields chunks.
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

      // Logic to parse multiple JSON objects from the stream.
      // Often streams send concatenated JSONs like {}{}.
      // Or NDJSON (newlines). 
      // We'll try to split by some delimiter or parse aggressively.
      
      // Heuristic: Try to split by `}\n{` or `}{` if compact.
      // For safety, let's assume NDJSON or standard chunks.
      
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