import React, { useState, useRef, useCallback, useEffect } from 'react';
import { fetchCompletion, streamThreading } from '../services/api';
import { ResearchNode as ResearchNodeType, Role, MessageType, ChunkMessage } from '../types';
import ResearchNode from './ResearchNode';
import { FinalReport } from './FinalReport';
import { Search, Send, Activity, Loader2, MessageSquarePlus, Trash2 } from 'lucide-react';

const Visualization: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for the visualization tree
  const [nodes, setNodes] = useState<Map<string, ResearchNodeType>>(new Map());
  const [rootIds, setRootIds] = useState<string[]>([]);
  const [finalReport, setFinalReport] = useState<string | null>(null);
  
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isSearching) return;

    setIsSearching(true);
    setError(null);
    setFinalReport(null); 
    activeBlockingToolId.current = null; // Reset logic tracking

    try {
      // 1. Start Chat with current conversion UUID (or null)
      const { messageUuid, conversionUuid: newConversionUuid } = await fetchCompletion(query, conversionUuid);
      
      if (newConversionUuid) {
          setConversionUuid(newConversionUuid);
      }
      
      setQuery(''); // Clear input

      // 2. Start Streaming
      const stream = streamThreading(messageUuid);

      for await (const chunk of stream) {
        processChunk(chunk);
      }

    } catch (err: any) {
      setError(err.message || 'An unknown error occurred');
    } finally {
      setIsSearching(false);
    }
  };

  const handleNewChat = () => {
      setNodes(new Map());
      setRootIds([]);
      setFinalReport(null);
      setConversionUuid(null);
      activeBlockingToolId.current = null;
      setQuery('');
      setError(null);
  };

  const processChunk = (chunk: ChunkMessage) => {
    const { id, parent_id, role, name, message, type } = chunk;
    const nodeId = id || 'unknown';

    // 1. Logic to track blocking subagents to nest children inside them
    if (type === MessageType.NEW || type === MessageType.APPEND) {
        if (role === Role.TOOL_CALL && name === 'run_blocking_subagent') {
            activeBlockingToolId.current = nodeId;
        }
    }

    // 2. Determine Effective Parent ID (Reparenting Logic)
    let effectiveParentId = parent_id;
    
    // If we have an active blocking tool, and this new node is NOT the tool itself,
    // and this node's original parent matches the blocking tool's parent (meaning they are siblings),
    // then we reparent this node to be a child of the blocking tool.
    if (activeBlockingToolId.current && nodeId !== activeBlockingToolId.current && type === MessageType.NEW) {
        // We need to check if the declared parent is the same as the blocking tool's parent (sibling relationship)
        // Since we can't easily access the blocking tool's parent from state synchronously inside this loop without reading state,
        // we use a heuristic: if the provided parent_id is valid, we assume it's the "Lead Agent".
        // A safer check: if parent_id is NOT the activeBlockingToolId, we reparent.
        if (parent_id !== activeBlockingToolId.current) {
             effectiveParentId = activeBlockingToolId.current;
        }
    }

    // 3. Logic to detect when the blocking tool finishes (receives its result)
    // When the 'tool' result comes for the blocking tool ID, we stop nesting.
    if (role === Role.TOOL && activeBlockingToolId.current === nodeId) {
        activeBlockingToolId.current = null;
    }

    updateNodes((map) => {
      // Handle "New" Node
      if (type === MessageType.NEW) {
        if (!map.has(nodeId)) {
          const newNode: ResearchNodeType = {
            id: nodeId,
            parentId: effectiveParentId || null,
            role,
            name: name || 'Unknown',
            content: '',
            children: [],
            status: 'streaming',
            timestamp: Date.now()
          };
          
          // Initial content assignment
          if (role === Role.TOOL_CALL) {
              newNode.toolArgs = message || '';
          } else if (role === Role.TOOL) {
              newNode.toolResult = message || '';
              newNode.status = 'completed';
          } else {
              newNode.content = message || '';
          }

          map.set(nodeId, newNode);

          // Add to parent's children list
          if (effectiveParentId) {
            const parent = map.get(effectiveParentId);
            if (parent) {
              if (!parent.children.includes(nodeId)) {
                parent.children.push(nodeId);
              }
            }
          } else {
            // Is a root node
            setRootIds(prev => prev.includes(nodeId) ? prev : [...prev, nodeId]);
          }
        } else {
             // Node exists (e.g. created by tool_call, now receiving tool result)
             const node = map.get(nodeId)!;
             
             // Transition from Call to Result
             if (role === Role.TOOL && node.role === Role.TOOL_CALL) {
                 node.toolResult = message || '';
                 node.status = 'completed'; // Ensure status is updated
             } else {
                 // Fallback update
                 if (message) {
                    if (role === Role.TOOL_CALL) node.toolArgs = message;
                    else if (role === Role.TOOL) {
                        node.toolResult = message;
                        node.status = 'completed';
                    }
                    else node.content = message;
                 }
             }
        }
      } 
      
      // Handle "Append"
      else if (type === MessageType.APPEND) {
        const node = map.get(nodeId);
        if (node) {
          if (role === Role.TOOL_CALL) {
              node.toolArgs = (node.toolArgs || '') + message;
          } else if (role === Role.TOOL) {
              node.toolResult = (node.toolResult || '') + message;
          } else {
              node.content += message;
          }
        }
      }

      // Handle "Final"
      else if (type === MessageType.FINAL) {
        const node = map.get(nodeId);
        if (node) {
          node.status = 'completed';
          // Append trailing content
          if (message) {
              if (role === Role.TOOL_CALL) node.toolArgs = (node.toolArgs || '') + message;
              else if (role === Role.TOOL) node.toolResult = (node.toolResult || '') + message;
              else node.content += message;
          }
          
          // Check for Final Report
          if (!node.parentId && node.role === Role.ASSISTANT && node.content) {
              setFinalReport(node.content);
          }
          if (node.role === Role.TOOL_CALL && node.name === 'complete_task') {
             try {
                 const args = JSON.parse(node.toolArgs || '{}');
                 if (args.report) setFinalReport(args.report);
             } catch (e) { /* ignore */ }
          }
        }
      }
    });
  };

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
        // Allow a small delay for DOM to paint new heights
        setTimeout(() => {
            if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
        }, 50);
    }
  }, [nodes, finalReport]);

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto md:px-6 relative">
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 md:pt-6 z-20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <Activity className="text-blue-400 w-5 h-5" />
            </div>
            <div>
                <h1 className="text-xl font-bold text-slate-100 tracking-tight">
                Deep Research Agent
                </h1>
                {conversionUuid && (
                    <span className="text-xs text-slate-500 font-mono">
                        ID: {conversionUuid.slice(0, 8)}
                    </span>
                )}
            </div>
          </div>
          
          <button 
            onClick={handleNewChat}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            title="New Chat"
          >
              <MessageSquarePlus size={20} />
          </button>
      </div>

      {/* Main Content Area - Flexible height with scroll */}
      <div 
        className="flex-1 overflow-y-auto px-4 pb-32 scroll-smooth" 
        ref={scrollRef}
      >
          {rootIds.length === 0 && !isSearching && !finalReport && (
             <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4 opacity-50 min-h-[40vh]">
                <Search size={48} strokeWidth={1.5} />
                <p>Ready to research</p>
             </div>
          )}

          <div className="space-y-4 pt-2">
            {rootIds.map(rootId => (
                <ResearchNode key={rootId} nodeId={rootId} nodes={nodes} />
            ))}
          </div>

          {isSearching && (activeBlockingToolId.current === null) && (
             <div className="flex justify-center pt-8 pb-4">
                 <Loader2 className="w-6 h-6 animate-spin text-blue-500/50" />
             </div>
          )}

          {finalReport && (
             <FinalReport report={finalReport} />
          )}
      </div>

      {/* Input Area */}
      <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-background via-background to-transparent z-30">
        <div className="max-w-3xl mx-auto">
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
  );
};

export default Visualization;