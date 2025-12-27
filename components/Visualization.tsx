import React, { useState, useRef, useCallback, useEffect } from 'react';
import { fetchCompletion, streamThreading } from '../services/api';
import { ResearchNode as ResearchNodeType, Role, MessageType, ChunkMessage } from '../types';
import ResearchNode from './ResearchNode';
import { FinalReport } from './FinalReport';
import { Search, Send, Activity, Terminal, Loader2, MessageSquarePlus } from 'lucide-react';

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
    setFinalReport(null); // Clear previous final report only, keep history nodes?
    // If it's a new conversation (conversionUuid is null), we might want to clear nodes?
    // The requirement says "One conversion has multiple messages".
    // If user manually refreshes or hits a "New Chat" button, we clear. 
    // Here we assume sequential chat.

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
      setQuery('');
      setError(null);
  };

  const processChunk = (chunk: ChunkMessage) => {
    const { id, parent_id, role, name, message, type } = chunk;

    // We assume 'id' is always present for valid nodes.
    const nodeId = id || 'unknown';

    updateNodes((map) => {
      // Handle "New" Node
      if (type === MessageType.NEW) {
        if (!map.has(nodeId)) {
          const newNode: ResearchNodeType = {
            id: nodeId,
            parentId: parent_id || null,
            role,
            name: name || 'Unknown',
            content: '',
            children: [],
            status: 'streaming',
            timestamp: Date.now()
          };
          
          // Initial content assignment based on role
          if (role === Role.TOOL_CALL) {
              newNode.toolArgs = message || '';
          } else if (role === Role.TOOL) {
              newNode.toolResult = message || '';
          } else {
              newNode.content = message || '';
          }

          map.set(nodeId, newNode);

          if (parent_id) {
            const parent = map.get(parent_id);
            if (parent) {
              // Avoid duplicates
              if (!parent.children.includes(nodeId)) {
                parent.children.push(nodeId);
              }
            }
          } else {
            // Is a root node
            setRootIds(prev => prev.includes(nodeId) ? prev : [...prev, nodeId]);
          }
        } else {
             // Node exists (e.g. created by tool_call, now receiving tool result, OR duplicated 'new')
             // However, usually tool results come with role='tool' but same ID as tool_call
             const node = map.get(nodeId)!;
             
             // If we receive a "New" message for an existing node, it might be the transition from Call to Result
             if (role === Role.TOOL && node.role === Role.TOOL_CALL) {
                 // Do not change the main role, just add result
                 node.toolResult = message || '';
             } else {
                 // Fallback update
                 if (message) {
                    if (role === Role.TOOL_CALL) node.toolArgs = message;
                    else if (role === Role.TOOL) node.toolResult = message;
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
              // For assistant text
              node.content += message;
          }
        }
      }

      // Handle "Final"
      else if (type === MessageType.FINAL) {
        const node = map.get(nodeId);
        if (node) {
          node.status = 'completed';
          // Append trailing content if any
          if (message) {
              if (role === Role.TOOL_CALL) node.toolArgs = (node.toolArgs || '') + message;
              else if (role === Role.TOOL) node.toolResult = (node.toolResult || '') + message;
              else node.content += message;
          }
          
          // Check for Final Report in Assistant content
          // If the lead agent finishes, it might return the final report in content.
          if (!node.parentId && node.role === Role.ASSISTANT && node.content) {
              setFinalReport(node.content);
          }
          // Or if it's the complete_task tool
          if (node.role === Role.TOOL_CALL && node.name === 'complete_task') {
             try {
                 const args = JSON.parse(node.toolArgs || '{}');
                 if (args.report) setFinalReport(args.report);
             } catch (e) {
                 // ignore parse error
             }
          }
        }
      }
    });
  };

  // Auto-scroll to bottom of tree
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [nodes, finalReport]);

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto p-4 md:p-6 gap-6">
      
      {/* Header Area */}
      <div className="flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 flex items-center gap-3">
              <Activity className="text-blue-400" />
              Deep Research Agent
            </h1>
            <p className="text-slate-400 text-sm md:text-base hidden md:block">
              Collaborative multi-agent research visualization
            </p>
          </div>
          
          <button 
            onClick={handleNewChat}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors"
          >
              <MessageSquarePlus size={16} />
              New Chat
          </button>
      </div>

      {/* Main Visualization Area */}
      <div className="flex-1 overflow-hidden relative rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm flex flex-col shadow-2xl">
        <div className="bg-slate-950/80 p-3 border-b border-slate-800 flex items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <Terminal size={14} />
                <span>LIVE EXECUTION LOG {conversionUuid ? `[ID: ${conversionUuid.slice(0,8)}...]` : ''}</span>
            </div>
            {isSearching && (
                 <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
            )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 scroll-smooth" ref={scrollRef}>
          {rootIds.length === 0 && !isSearching && !finalReport && (
             <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4 opacity-50">
                <Search size={64} strokeWidth={1} />
                <p>Ready to research</p>
             </div>
          )}

          <div className="space-y-4">
            {rootIds.map(rootId => (
                <ResearchNode key={rootId} nodeId={rootId} nodes={nodes} />
            ))}
          </div>

          {finalReport && (
             <FinalReport report={finalReport} />
          )}

          {/* Padding at bottom */}
          <div className="h-12"></div>
        </div>
      </div>

      {/* Input Area */}
      <div className="relative z-10 w-full max-w-4xl mx-auto">
        <form onSubmit={handleSearch} className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
          <div className="relative flex items-center bg-surface border border-slate-700 rounded-xl shadow-xl overflow-hidden">
             <div className="pl-4 text-slate-500">
               {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
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
               className="p-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border-l border-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
             >
               <Send size={20} />
             </button>
          </div>
        </form>
      </div>

      {/* Error Display */}
      {error && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 p-4 bg-red-900/90 border border-red-500/50 rounded-lg text-red-200 flex items-center gap-3 shadow-xl backdrop-blur-md z-50">
            <Activity className="text-red-500" />
            {error}
        </div>
      )}
    </div>
  );
};

export default Visualization;