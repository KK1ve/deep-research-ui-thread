import React, { useState, useRef, useCallback, useEffect } from 'react';
import { fetchCompletion, streamThreading } from '../services/api';
import { ResearchNode as ResearchNodeType, Role, MessageType, ChunkMessage } from '../types';
import ResearchNode from './ResearchNode';
import { FinalReport } from './FinalReport';
import { Search, Send, Activity, Terminal, Loader2 } from 'lucide-react';

const Visualization: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for the visualization tree
  const [nodes, setNodes] = useState<Map<string, ResearchNodeType>>(new Map());
  const [rootIds, setRootIds] = useState<string[]>([]);
  const [finalReport, setFinalReport] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Helper to update nodes map immutably
  const updateNodes = useCallback((updater: (map: Map<string, ResearchNodeType>) => void) => {
    setNodes(prev => {
      const newMap = new Map(prev);
      updater(newMap);
      return newMap;
    });
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isSearching) return;

    // Reset state
    setIsSearching(true);
    setError(null);
    setNodes(new Map());
    setRootIds([]);
    setFinalReport(null);

    try {
      // 1. Start Chat
      const messageUuid = await fetchCompletion(query);
      
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

  const processChunk = (chunk: ChunkMessage) => {
    const { id, parent_id, role, name, message, type } = chunk;

    // We assume 'id' is always present for valid nodes, except maybe very root
    // If id is missing but it's a message update, we might need a fallback, 
    // but based on spec, id should be there.
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
            content: message || '',
            children: [],
            status: 'streaming',
            timestamp: Date.now()
          };
          map.set(nodeId, newNode);

          if (parent_id) {
            const parent = map.get(parent_id);
            if (parent) {
              // Avoid duplicates
              if (!parent.children.includes(nodeId)) {
                parent.children.push(nodeId);
              }
            } else {
              // If parent doesn't exist yet (out of order), we might need to queue or handle it.
              // For simplicity, treat as root or orphan.
              // In this specific flow, usually parent exists.
              // Let's add to root if parent not found, or handle gracefully.
              // Logic check: The prompt example shows strict hierarchy.
            }
          } else {
            // Is a root node
            setRootIds(prev => prev.includes(nodeId) ? prev : [...prev, nodeId]);
          }
        } else {
             // Edge case: "new" type received for existing ID. Reset?
             // Just update content
             const node = map.get(nodeId)!;
             node.content = message || '';
        }
      } 
      
      // Handle "Append"
      else if (type === MessageType.APPEND) {
        const node = map.get(nodeId);
        if (node) {
          node.content += message;
        } else {
           // Received append before new? Create placeholder.
           // This shouldn't happen in a good stream, but robust code helps.
        }
      }

      // Handle "Final"
      else if (type === MessageType.FINAL) {
        const node = map.get(nodeId);
        if (node) {
          node.status = 'completed';
          node.content += message; // Sometimes final has trailing content
          
          // Special Check: Is this the Lead Agent saying "final"? 
          // If so, this is the final report for the UI.
          if (!node.parentId && node.role === Role.ASSISTANT) {
              setFinalReport(node.content);
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
  }, [nodes]);

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto p-4 md:p-6 gap-6">
      
      {/* Header Area */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 flex items-center gap-3">
          <Activity className="text-blue-400" />
          Deep Research Agent
        </h1>
        <p className="text-slate-400 text-sm md:text-base">
          Enter a topic and watch the swarm of agents collaborate, search, and synthesize information in real-time.
        </p>
      </div>

      {/* Input Area */}
      <div className="relative z-10">
        <form onSubmit={handleSearch} className="relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
          <div className="relative flex items-center bg-surface border border-slate-700 rounded-xl shadow-xl overflow-hidden">
             <div className="pl-4 text-slate-500">
               {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
             </div>
             <input 
                type="text" 
                className="w-full bg-transparent p-4 text-slate-100 placeholder-slate-500 focus:outline-none"
                placeholder="What do you want to research today?"
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
        <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-200 flex items-center gap-3">
            <Activity className="text-red-500" />
            {error}
        </div>
      )}

      {/* Main Visualization Area */}
      <div className="flex-1 overflow-hidden relative rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm flex flex-col">
        <div className="bg-slate-950/80 p-3 border-b border-slate-800 flex items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <Terminal size={14} />
                <span>LIVE EXECUTION LOG</span>
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
             <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4">
                <Search size={48} className="opacity-20" />
                <p>Waiting for mission...</p>
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
    </div>
  );
};

export default Visualization;