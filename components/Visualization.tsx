import React, { useState, useRef, useCallback, useEffect } from 'react';
import { fetchCompletion, streamThreading } from '../services/api';
import { ResearchNode as ResearchNodeType, Role, MessageType, ChunkMessage } from '../types';
import ResearchNode from './ResearchNode';
import { FinalReport } from './FinalReport';
import { Search, Activity, Terminal, Loader2, Send } from 'lucide-react';

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
    const nodeId = id || 'unknown';

    updateNodes((map) => {
      let node = map.get(nodeId);

      // Create node if it doesn't exist
      // We do this regardless of 'type' because streams might be out of order or start with 'append'
      if (!node) {
        node = {
          id: nodeId,
          parentId: parent_id || null,
          role, // Initial role (likely tool_call or assistant)
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
            // Avoid duplicates
            if (!parent.children.includes(nodeId)) {
              parent.children.push(nodeId);
            }
          }
        } else {
          setRootIds(prev => prev.includes(nodeId) ? prev : [...prev, nodeId]);
        }
      }

      // Logic: Agent Completion
      // If an agent calls 'complete_task', it means they are done thinking.
      // We look at the parent_id of the tool call to find the Agent.
      if (name === 'complete_task' && parent_id) {
        const parent = map.get(parent_id);
        if (parent) {
          parent.status = 'completed';
        }
      }

      // Logic: Merging Tool Call (Args) and Tool (Result)
      if (role === Role.TOOL) {
        // This is the result part of a tool interaction
        // It shares the same ID as the tool_call, so we are updating the existing node
        if (type === MessageType.NEW) {
            node.toolResult = message || '';
        } else {
            node.toolResult = (node.toolResult || '') + message;
        }
        // If we have a result, the tool execution is effectively done
        node.status = 'completed';
      } else {
        // This is Assistant text OR Tool Call arguments
        if (type === MessageType.NEW) {
            // Only overwrite content if it's explicitly a NEW message for the main content
            node.content = message || '';
        } else {
            node.content += message;
        }
      }

      // Handle Final Type
      if (type === MessageType.FINAL) {
        node.status = 'completed';
        
        // Check for Lead Agent Final Report
        // Usually lead agent has no parent_id and role is assistant
        if (role === Role.ASSISTANT && !node.parentId) {
            setFinalReport(node.content);
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
      
      {/* Header */}
      <div className="flex flex-col gap-2 animate-in slide-in-from-top-4 duration-500">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 flex items-center gap-3">
          <Activity className="w-8 h-8 text-blue-500" />
          Deep Research
        </h1>
        <p className="text-slate-400">
          Agent-based hierarchical research visualization
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative z-20">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg blur opacity-30 group-hover:opacity-60 transition duration-200"></div>
          <div className="relative flex items-center bg-surface rounded-lg border border-slate-700 shadow-xl overflow-hidden">
            <Search className="ml-4 w-5 h-5 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What would you like to research?"
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

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-500/50 rounded-lg text-red-200 text-sm animate-in slide-in-from-top-2">
          {error}
        </div>
      )}

      {/* Main Visualization Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto pr-2 relative z-10 space-y-4 pb-20 scroll-smooth"
      >
        {/* Placeholder if empty */}
        {!isSearching && rootIds.length === 0 && !error && (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4 mt-20">
            <Terminal className="w-16 h-16 opacity-20" />
            <p className="text-sm uppercase tracking-widest opacity-50">System Ready</p>
          </div>
        )}

        {/* Tree Render */}
        {rootIds.map(id => (
          <ResearchNode 
            key={id} 
            nodeId={id} 
            nodes={nodes} 
            depth={0} 
          />
        ))}

        {/* Final Report */}
        {finalReport && <FinalReport report={finalReport} />}

        {/* Loading Indicator at bottom if active */}
        {isSearching && !finalReport && (
           <div className="flex items-center gap-2 text-xs text-slate-500 animate-pulse pl-4">
             <span className="w-2 h-2 rounded-full bg-blue-500"></span>
             Processing data stream...
           </div>
        )}
      </div>
    </div>
  );
};

export default Visualization;