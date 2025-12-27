import React, { useState, useRef, useCallback, useEffect } from 'react';
import { fetchCompletion, streamThreading, fetchConversationDetail } from '../services/api';
import { ResearchNode as ResearchNodeType, Role, MessageType, ChunkMessage } from '../types';
import ResearchNode from './ResearchNode';
import Sidebar from './Sidebar';
import { Search, Send, Activity, Loader2, MessageSquarePlus, Trash2, Menu, X } from 'lucide-react';

const Visualization: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // State for the visualization tree
  const [nodes, setNodes] = useState<Map<string, ResearchNodeType>>(new Map());
  const [rootIds, setRootIds] = useState<string[]>([]);
  // Global finalReport state removed to prevent positioning issues
  
  // Conversation state
  const [conversionUuid, setConversionUuid] = useState<string | null>(null);
  
  // Track logic for nesting sub-agents under run_blocking_subagent
  const activeBlockingToolId = useRef<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Helper to update nodes map immutably
  const updateNodes = useCallback((updater: (map: Map<string, ResearchNodeType>) => void) => {
    setNodes(prev => {
      const newMap = new Map<string, ResearchNodeType>(prev);
      updater(newMap);
      return newMap;
    });
  }, []);

  // --- Handlers ---

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isSearching) return;

    setIsSearching(true);
    setError(null);
    
    // If starting fresh (no conversion ID), clear everything
    if (!conversionUuid) {
        setRootIds([]);
        setNodes(new Map());
    }
    activeBlockingToolId.current = null;

    // Inject User Node for the current query immediately
    // Use a temporary ID that won't conflict with backend UUIDs
    const userMsgId = `human-${Date.now()}`;
    const userNode: ResearchNodeType = {
        id: userMsgId,
        parentId: null,
        role: Role.HUMAN,
        name: 'User',
        content: query,
        children: [],
        status: 'completed',
        timestamp: Date.now()
    };

    updateNodes((map) => {
        map.set(userMsgId, userNode);
    });
    setRootIds(prev => [...prev, userMsgId]);

    try {
      const { messageUuid, conversionUuid: newConversionUuid } = await fetchCompletion(query, conversionUuid);
      
      if (newConversionUuid) {
          setConversionUuid(newConversionUuid);
      }
      
      setQuery(''); 

      const stream = streamThreading(messageUuid);

      for await (const chunk of stream) {
        processChunk(chunk);
      }

    } catch (err: any) {
      setError(err.message || 'An unknown error occurred');
    } finally {
      setIsSearching(false);
      updateNodes((map) => {
        for (const [key, node] of map.entries()) {
            if (node.status === 'streaming') {
                map.set(key, { ...node, status: 'completed' });
            }
        }
      });
    }
  };

  const handleNewChat = () => {
      setNodes(new Map());
      setRootIds([]);
      setConversionUuid(null);
      activeBlockingToolId.current = null;
      setQuery('');
      setError(null);
      setIsSearching(false);
  };

  const handleSelectHistory = async (uuid: string) => {
      if (isSearching) return; // Prevent switching while generating
      
      try {
          setIsSearching(true);
          setConversionUuid(uuid);
          setNodes(new Map());
          setRootIds([]);
          setError(null);
          activeBlockingToolId.current = null;

          const entities = await fetchConversationDetail(uuid);
          
          // Reconstruct Tree from History
          const tempNodes = new Map<string, ResearchNodeType>();
          const tempRoots: string[] = [];

          // Helper to process a completed node from history
          const processHistoryNode = (displayMsg: any, parentId: string | null, fallbackId: string) => {
              // Fix: If id is null (common for Human messages), use fallback
              const nodeId = displayMsg.id || fallbackId;
              
              // In history, parent_id comes from DB. 
              const effectiveParentId = displayMsg.parent_id || parentId;

              // Create Node
              if (!tempNodes.has(nodeId)) {
                  tempNodes.set(nodeId, {
                      id: nodeId,
                      parentId: effectiveParentId,
                      role: displayMsg.role,
                      name: displayMsg.name || (displayMsg.role === Role.HUMAN ? 'User' : 'Unknown'),
                      content: displayMsg.role !== Role.TOOL_CALL && displayMsg.role !== Role.TOOL ? displayMsg.message : '',
                      toolArgs: displayMsg.role === Role.TOOL_CALL ? displayMsg.message : undefined,
                      toolResult: displayMsg.role === Role.TOOL ? displayMsg.message : undefined,
                      children: [],
                      status: 'completed', // History is always completed
                      timestamp: Date.now()
                  });

                  if (effectiveParentId) {
                      const p = tempNodes.get(effectiveParentId);
                      if (p && !p.children.includes(nodeId)) {
                          p.children.push(nodeId);
                      }
                  } else {
                      // It's a root
                      if (!tempRoots.includes(nodeId)) tempRoots.push(nodeId);
                  }
              } else {
                  // Merge content if node exists (e.g. tool output comes later)
                  const node = tempNodes.get(nodeId)!;
                  if (displayMsg.role === Role.TOOL) {
                      node.toolResult = displayMsg.message;
                  } else if (displayMsg.role === Role.TOOL_CALL) {
                      node.toolArgs = displayMsg.message;
                  } else {
                      node.content = displayMsg.message;
                  }
              }
          };

          // Iterate all entities and their content
          for (const entity of entities) {
              entity.content.forEach((msg, index) => {
                   // Generate a fallback ID using message_uuid and index
                   // This ensures missing IDs (like in Human messages) don't break rendering
                   const fallbackId = `${entity.message_uuid}_${index}`;
                   processHistoryNode(msg, null, fallbackId);
              });
          }

          setNodes(tempNodes);
          setRootIds(tempRoots);

      } catch (err: any) {
          setError('Failed to load conversation: ' + err.message);
      } finally {
          setIsSearching(false);
      }
  };

  const processChunk = (chunk: ChunkMessage) => {
    const { id, parent_id, role, name, message, type } = chunk;
    const nodeId = id || 'unknown';

    if (role === Role.TOOL_CALL && name === 'run_blocking_subagent') {
        activeBlockingToolId.current = nodeId;
    }

    let effectiveParentId = parent_id;
    
    if (activeBlockingToolId.current && nodeId !== activeBlockingToolId.current) {
        if (parent_id !== activeBlockingToolId.current) {
             effectiveParentId = activeBlockingToolId.current;
        }
    }

    if (role === Role.TOOL && activeBlockingToolId.current === nodeId) {
        activeBlockingToolId.current = null;
    }

    updateNodes((map) => {
      const existingNode = map.get(nodeId);
      let newNode: ResearchNodeType;

      if (!existingNode) {
        newNode = {
          id: nodeId,
          parentId: effectiveParentId || null,
          role, 
          name: name || 'Unknown',
          content: '',
          children: [],
          status: 'streaming',
          timestamp: Date.now(),
          toolArgs: '',
          toolResult: ''
        };
        
        map.set(nodeId, newNode);

        if (effectiveParentId) {
          const parent = map.get(effectiveParentId);
          if (parent) {
             const newParent = { ...parent, children: [...parent.children] };
             if (!newParent.children.includes(nodeId)) {
                newParent.children.push(nodeId);
             }
             map.set(effectiveParentId, newParent);
          }
        } else {
          setRootIds(prev => prev.includes(nodeId) ? prev : [...prev, nodeId]);
        }
      } else {
          newNode = { ...existingNode };
          map.set(nodeId, newNode);
      }

      if (role === Role.TOOL) {
          newNode.toolResult = (newNode.toolResult || '') + message;
          newNode.status = 'completed'; 
      } 
      else if (role === Role.TOOL_CALL) {
          newNode.toolArgs = (newNode.toolArgs || '') + message;
      } 
      else {
          newNode.content = (newNode.content || '') + message;
      }

      if (type === MessageType.FINAL) {
        newNode.status = 'completed';
      }
    });
  };

  useEffect(() => {
    if (scrollRef.current) {
        const timeoutId = setTimeout(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
        }, 100);
        return () => clearTimeout(timeoutId);
    }
  }, [nodes]);

  return (
    <div className="flex h-screen w-full bg-background text-slate-200 overflow-hidden relative">
      
      {/* Sidebar */}
      <Sidebar 
          isOpen={isSidebarOpen} 
          onClose={() => setIsSidebarOpen(false)}
          activeId={conversionUuid}
          onSelect={handleSelectHistory}
          onNewChat={handleNewChat}
      />

      {/* Main Content */}
      <div className={`
          flex-1 flex flex-col h-full transition-all duration-300 relative
          ${isSidebarOpen ? 'md:ml-72' : 'ml-0'}
      `}>
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:px-6 z-20 shrink-0 border-b border-white/5 bg-background/50 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <button 
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="p-2 -ml-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                    {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
                <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <Activity className="text-blue-400 w-5 h-5" />
                </div>
                <div>
                    <h1 className="text-lg md:text-xl font-bold text-slate-100 tracking-tight hidden md:block">
                    Deep Research Agent
                    </h1>
                    <h1 className="text-lg font-bold text-slate-100 tracking-tight md:hidden">
                    Agent
                    </h1>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                  <button 
                    onClick={handleNewChat}
                    className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                    title="New Chat"
                  >
                      <MessageSquarePlus size={20} />
                  </button>
              </div>
          </div>

          {/* Scroll Area */}
          <div 
            className="flex-1 min-h-0 overflow-y-auto px-4 scroll-smooth pb-40" 
            ref={scrollRef}
          >
              {rootIds.length === 0 && !isSearching && (
                 <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4 opacity-50 min-h-[40vh]">
                    <Search size={48} strokeWidth={1.5} />
                    <p>Ready to research</p>
                 </div>
              )}

              <div className="space-y-4 pt-4 max-w-5xl mx-auto">
                {rootIds.map(rootId => (
                    <ResearchNode key={rootId} nodeId={rootId} nodes={nodes} />
                ))}
              </div>

              {isSearching && (activeBlockingToolId.current === null) && (
                 <div className="flex justify-center pt-8 pb-4">
                     <Loader2 className="w-6 h-6 animate-spin text-blue-500/50" />
                 </div>
              )}
          </div>

          {/* Input Area */}
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-background via-background/95 to-transparent z-30 pointer-events-none">
            <div className="max-w-3xl mx-auto pointer-events-auto">
                <form onSubmit={handleSearch} className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition duration-500"></div>
                <div className="relative flex items-center bg-slate-900/90 border border-slate-700/50 rounded-xl shadow-2xl backdrop-blur-xl overflow-hidden ring-1 ring-white/5 focus-within:ring-blue-500/50 transition-all">
                    <div className="pl-4 text-slate-500">
                    {isSearching ? <Loader2 className="animate-spin w-5 h-5" /> : <Search className="w-5 h-5" />}
                    </div>
                    <input 
                        type="text" 
                        className="w-full bg-transparent p-4 text-slate-100 placeholder-slate-500 focus:outline-none"
                        placeholder={conversionUuid ? "Ask a follow-up question..." : "What do you want to research today?"}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        disabled={isSearching}
                    />
                    <button 
                    type="submit"
                    disabled={!query.trim() || isSearching}
                    className="p-4 hover:bg-slate-800 text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-l border-slate-800"
                    >
                    <Send size={18} />
                    </button>
                </div>
                </form>
                
                <div className="text-center mt-3 text-[10px] text-slate-600 font-mono">
                    AI Agent Research • {isSearching ? 'Processing...' : 'Ready'}
                </div>
            </div>
          </div>

          {/* Error Toast */}
          {error && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 p-4 bg-red-950/90 border border-red-500/30 rounded-xl text-red-200 flex items-center gap-3 shadow-2xl backdrop-blur-md z-50 animate-in slide-in-from-top-4">
                <Activity className="text-red-500" size={18} />
                <span className="text-sm font-medium">{error}</span>
                <button onClick={() => setError(null)} className="ml-2 hover:text-white"><Trash2 size={14}/></button>
            </div>
          )}
      </div>
    </div>
  );
};

export default Visualization;