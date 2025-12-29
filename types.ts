/**
 * Defines the roles an entity can take in the research chat.
 */
export enum Role {
  HUMAN = 'human',
  ASSISTANT = 'assistant',
  TOOL_CALL = 'tool_call', // Request to use a tool
  TOOL = 'tool',           // Result of a tool usage
  SYSTEM = 'system',
  ERROR = 'error'
}

/**
 * Message types define how the UI should interpret the incoming chunk.
 */
export enum MessageType {
  NEW = 'new',       // Start of a new message/node
  APPEND = 'append', // Streaming content to append to the last node
  FINAL = 'final'    // Marks the node as complete/final (triggers Final Report view)
}

/**
 * Represents a single chunk of data streamed from the /chat/threading endpoint.
 */
export interface ChunkMessage {
  role: Role;
  name?: string | null;
  parent_id?: string | null; // ID of the parent node (for tree structure)
  id?: string | null;        // ID of the current node
  message: string;           // Content chunk or complete content
  type: MessageType;         // Action type (new, append, final)
}

/**
 * DTO for starting a new chat completion.
 */
export interface ChatDTO {
  conversion_uuid?: string | null; // UUID for the conversation history context
  prompt: string;
  user_id?: string;
}

/**
 * DTO for the threading stream request.
 */
export interface ThreadingDTO {
  message_uuid: string; // The root message ID returned by the completion endpoint
}

/**
 * Internal State Model for the Visualization Tree.
 * This represents a single bubble/card in the UI.
 */
export interface ResearchNode {
  id: string;
  parentId: string | null;
  role: Role;
  name: string;
  content: string; // Accumulated text content
  
  // Tool Specific Properties
  toolArgs?: string;  // JSON arguments for a tool call (Role.TOOL_CALL)
  toolResult?: string; // Output/Result of a tool (Role.TOOL)
  
  children: string[]; // List of child Node IDs (Adjacency list for the tree)
  status: 'streaming' | 'completed' | 'error';
  timestamp: number;
  
  // Special Flag
  isFinal?: boolean; // If true, renders the "Final Research Report" card
}

// --- History / Conversation API Types ---

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

/**
 * Represents a message as stored in the backend history.
 */
export interface DisplayMessage {
  role: Role;
  name?: string | null;
  parent_id?: string | null;
  id?: string | null;
  message: string;
  type?: MessageType; // 'final' type determines if report is shown in history view
}

export interface MessageEntity {
  message_uuid: string;
  conversion_uuid: string;
  content: DisplayMessage[]; 
  role: string;
  thread_status?: boolean | null; // false indicates an incomplete/interrupted stream
}