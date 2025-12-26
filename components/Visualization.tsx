import React, { useState, useRef, useCallback, useEffect } from 'react';
import { fetchCompletion, streamThreading, fetchConversationDetail } from '../services/api';
import { ResearchNode as ResearchNodeType, Role, MessageType, ChunkMessage, MessageEntity, DisplayMessage } from '../types';
import ResearchNode from './ResearchNode';
import { FinalReport } from './FinalReport';
import { Search, Activity, Terminal, Loader2, Send } from 'lucide-react';

interface Props {
  conversionId: string | null;
  onConversionCreated: (uuid: string) => void;
}

const Visualization: React.FC<Props> = ({ conversionId, onConversionCreated }) => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for the visualization tree
  const [nodes, setNodes] = useState<Map<string, ResearchNodeType>>(new Map());
  const [rootIds, setRootIds] = useState<string[]>([]);
  const [finalReport, setFinalReport] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // --- Load Conversation History ---
  useEffect(() => {
    if (conversionId) {
      loadHistory(conversionId);
    } else {
      // Reset if new chat
      setNodes(new Map());
      setRootIds([]);
      setFinalReport(null);
      setQuery('');
    }
  }, [conversionId]);

  const loadHistory = async (uuid: string) => {
    setIsSearching(true);
    setNodes(new Map());
    setRootIds([]);
    setFinalReport(null);
    setError(null);

    try {
      const messages = await fetchConversationDetail(uuid);
      reconstructTreeFromHistory(messages);
    } catch (err: any) {
      setError('加载对话历史失败');
    } finally {
      setIsSearching(false);
    }
  };

  const reconstructTreeFromHistory = (entities: MessageEntity[]) => {
    const newNodes = new Map<string, ResearchNodeType>();
    const newRoots: string[] = [];
    let lastReport = null;

    // Flatten all display messages from all entities
    const allMessages: DisplayMessage[] = [];
    entities.forEach(entity => {
        if (entity.content && Array.isArray(entity.content)) {
            allMessages.push(...entity.content);
        }
    });

    allMessages.forEach(msg => {
      const nodeId = msg.id || 'unknown';
      let node = newNodes.get(nodeId);

      // Create node if not exists
      if (!node) {
        node = {
          id: nodeId,
          parentId: msg.parent_id || null,
          role: msg.role,
          name: msg.name || 'Unknown',
          content: '',
          children: [],
          status: 'completed', // History items are completed by default
          timestamp: Date.now() // We don't have exact timestamp per msg, use current
        };
        newNodes.set(nodeId, node);

        if (msg.parent_id) {
          const parent = newNodes.get(msg.parent_id);
          if (parent && !parent.children.includes(nodeId)) {
            parent.children.push(nodeId);
          }
        } else {
           // If no parent, it's a root
           if (!newRoots.includes(nodeId)) {
             newRoots.push(nodeId);
           }
        }
      }

      // Merge Logic for Tool Call (Args) vs Tool (Result)
      if (msg.role === Role.TOOL) {
        // In history, 'tool' role is the result. 'tool_call' was the args.
        node.toolResult = msg.message;
      } else {
        node.content = msg.message;
      }
      
      // Update completion status for parents
      if (msg.name === 'complete_task' && msg.parent_id) {
         const parent = newNodes.get(msg.parent_id);
         if (parent) parent.status = 'completed';
      }

      // Check for final report in Assistant nodes at root level
      if (msg.role === Role.ASSISTANT && !msg.parent_id) {
        lastReport = msg.message;
      }
    });

    setNodes(newNodes);
    setRootIds(newRoots);
    setFinalReport(lastReport);
  };

  // --- Helper to update nodes map immutably ---
  const updateNodes = useCallback((updater: (map: Map<string, ResearchNodeType>) => void) => {
    setNodes(prev => {
      const newMap = new Map(prev);
      updater(newMap);
      return newMap;
    });
  }, []);

  // --- Search Handler ---
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isSearching) return;

    let activeConversionId = conversionId;
    
    // If starting new chat
    if (!activeConversionId) {
      activeConversionId = crypto.randomUUID();
      // Notify parent to update URL/State
      onConversionCreated(activeConversionId);
      // Reset view
      setNodes(new Map());
      setRootIds([]);
      setFinalReport(null);
    }

    setIsSearching(true);
    setError(null);
    
    try {
      // 1. Start Chat
      const messageUuid = await fetchCompletion(query, activeConversionId);
      
      // 2. Start Streaming
      const stream = streamThreading(messageUuid);

      for await (const chunk of stream) {
        processChunk(chunk);
      }

    } catch (err: any) {
      setError(err.message || '发生未知错误');
    } finally {
      setIsSearching(false);
      setQuery(''); // Clear input after send
    }
  };

  const processChunk = (chunk: ChunkMessage) => {
    const { id, parent_id, role, name, message, type } = chunk;
    const nodeId = id || 'unknown';

    updateNodes((map) => {
      let node = map.get(nodeId);

      if (!node) {
        node = {
          id: nodeId,
          parentId: parent_id || null,
          role, 
          name: name || 'Unknown',
          content: '',
          children: [],
          status: 'streaming',
          timestamp: Date.now()
        };
        map.set(nodeId, node);

        if (parent_id) {
          const parent = map.get(parent_id);
          if (parent) {
            if (!parent.children.includes(nodeId)) {
              parent.children.push(nodeId);
            }
          }
        } else {
          setRootIds(prev => prev.includes(nodeId) ? prev : [...prev, nodeId]);
        }
      }

      // Check for completion signal
      if (name === 'complete_task' && parent_id) {
        const parent = map.get(parent_id);
        if (parent) parent.status = 'completed';
      }

      // Merge Tool Result
      if (role === Role.TOOL) {
        if (type === MessageType.NEW) {
            node.toolResult = message || '';
        } else {
            node.toolResult = (node.toolResult || '') + message;
        }
        node.status = 'completed';
      } else {
        // Append Content
        if (type === MessageType.NEW) {
            node.content = message || '';
        } else {
            node.content += message;
        }
      }

      // Handle Final Type
      if (type === MessageType.FINAL) {
        node.status = 'completed';
        if (role === Role.ASSISTANT && !node.parentId) {
            setFinalReport(node.content);
        }
      }
    });
  };

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [nodes, finalReport]);

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto gap-4 relative">
      
      {/* Header - Fixed Height */}
      <div className="flex-none p-4 md:p-6 pb-2">
        <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-500" />
            深度研究
            </h1>
            <p className="text-slate-400">
            基于智能体的分层研究可视化系统
            </p>
        </div>
      </div>

      {/* Main Visualization Area - Scrollable */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 md:px-6 pb-4 scroll-smooth custom-scrollbar"
      >
        {!isSearching && rootIds.length === 0 && !error && (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4 min-h-[300px]">
            <Terminal className="w-16 h-16 opacity-20" />
            <p className="text-sm uppercase tracking-widest opacity-50">系统就绪</p>
          </div>
        )}

        {/* Tree Render */}
        <div className="space-y-4">
            {rootIds.map(id => (
            <ResearchNode 
                key={id} 
                nodeId={id} 
                nodes={nodes} 
                depth={0} 
            />
            ))}
        </div>

        {finalReport && <FinalReport report={finalReport} />}

        {isSearching && !finalReport && (
           <div className="flex items-center gap-2 text-xs text-slate-500 animate-pulse pl-4 mt-4">
             <span className="w-2 h-2 rounded-full bg-blue-500"></span>
             正在处理数据流...
           </div>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-4 md:mx-6 p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-200 text-sm animate-in slide-in-from-bottom-2">
          {error}
        </div>
      )}

      {/* Input Area - Fixed Bottom */}
      <div className="flex-none p-4 md:p-6 pt-2 bg-gradient-to-t from-background via-background to-transparent z-20">
        <form onSubmit={handleSearch} className="relative">
            <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg blur opacity-30 group-hover:opacity-60 transition duration-200"></div>
            <div className="relative flex items-center bg-surface rounded-lg border border-slate-700 shadow-xl overflow-hidden">
                <Search className="ml-4 w-5 h-5 text-slate-500" />
                <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={conversionId ? "请输入后续问题..." : "您想研究什么？"}
                className="w-full bg-transparent p-4 text-slate-200 focus:outline-none placeholder:text-slate-600"
                disabled={isSearching}
                />
                <button
                type="submit"
                disabled={isSearching || !query.trim()}
                className="mr-2 p-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
            </div>
            </div>
        </form>
      </div>
    </div>
  );
};

export default Visualization;