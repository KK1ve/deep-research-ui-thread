export enum Role {
  HUMAN = 'human',
  ASSISTANT = 'assistant',
  TOOL_CALL = 'tool_call',
  TOOL = 'tool',
  SYSTEM = 'system',
  ERROR = 'error'
}

export enum MessageType {
  NEW = 'new',
  APPEND = 'append',
  FINAL = 'final'
}

export interface ChunkMessage {
  role: Role;
  name?: string | null;
  parent_id?: string | null;
  id?: string | null;
  message: string;
  type: MessageType;
}

export interface ChatDTO {
  conversion_uuid?: string | null;
  prompt: string;
  user_id?: string;
}

export interface ThreadingDTO {
  message_uuid: string;
}

// Internal State Types for the Tree
export interface ResearchNode {
  id: string;
  parentId: string | null;
  role: Role;
  name: string;
  content: string; // Accumulated content (Assistant text or Tool Args fallback)
  toolArgs?: string; // Specific for Tool Call arguments
  toolResult?: string; // Specific for Tool Output
  children: string[]; // IDs of children
  status: 'streaming' | 'completed' | 'error';
  timestamp: number;
  isFinal?: boolean; // Indicates if the message type was 'final'
}

// --- History / Conversion Types ---

export interface ConversionVO {
  conversion_uuid: string;
  title: string;
  create_time: string;
  update_time: string;
  user_id: string;
}

export interface PaginationResponse<T> {
  items: T[];
  total: number;
  page_num: number;
  page_size: number;
  total_pages: number;
  has_previous: boolean;
  has_next: boolean;
}

export interface DisplayMessage {
  role: Role;
  name?: string | null;
  parent_id?: string | null;
  id?: string | null;
  message: string;
  type?: MessageType; // Optional type from history if available
}

export interface MessageEntity {
  message_uuid: string;
  conversion_uuid: string;
  content: DisplayMessage[]; 
  role: string;
  thread_status?: boolean | null;
}