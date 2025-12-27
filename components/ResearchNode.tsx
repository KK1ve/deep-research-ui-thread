import React, { useMemo, useState } from 'react';
import { ResearchNode as NodeInterface, Role } from '../types';
import { 
  Bot, 
  Search, 
  FileText, 
  CheckCircle2, 
  Loader2, 
  ChevronDown, 
  ChevronRight, 
  Globe, 
  Cpu, 
  AlertCircle,
  ArrowRightLeft
} from 'lucide-react';

interface Props {
  nodeId: string;
  nodes: Map<string, NodeInterface>;
  depth?: number;
}

const ResearchNode: React.FC<Props> = ({ nodeId, nodes, depth = 0 }) => {
  const node = nodes.get(nodeId);
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!node) return null;

  const hasChildren = node.children.length > 0;
  const isAgent = node.role === Role.ASSISTANT;
  const isToolCall = node.role === Role.TOOL_CALL;
  const isError = node.role === Role.ERROR;

  // Visual styling based on role
  const borderColor = isAgent ? 'border-purple-500/30' : isToolCall ? 'border-orange-500/30' : 'border-slate-700';
  const bgColor = isAgent ? 'bg-purple-900/10' : isToolCall ? 'bg-orange-900/10' : 'bg-slate-800/30';

  const getIcon = () => {
    if (node.status === 'streaming') return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />;
    if (isError) return <AlertCircle className="w-4 h-4 text-red-500" />;
    
    switch (node.role) {
      case Role.ASSISTANT:
        return <Bot className="w-4 h-4 text-purple-400" />;
      case Role.TOOL_CALL:
        if (node.name?.includes('search')) return <Search className="w-4 h-4 text-orange-400" />;
        if (node.name?.includes('fetch')) return <Globe className="w-4 h-4 text-blue-400" />;
        if (node.name === 'complete_task') return <CheckCircle2 className="w-4 h-4 text-green-400" />;
        return <Cpu className="w-4 h-4 text-orange-400" />;
      case Role.TOOL:
        return <FileText className="w-4 h-4 text-green-400" />;
      case Role.SYSTEM:
        return <Cpu className="w-4 h-4 text-gray-400" />;
      default:
        return <Bot className="w-4 h-4 text-gray-400" />;
    }
  };

  // Safe JSON parse that handles streaming partial JSON
  const toolArgs = useMemo(() => {
    if (isToolCall && node.toolArgs) {
      try {
        return JSON.parse(node.toolArgs);
      } catch (e) {
        // Return null for invalid JSON so we can render raw string fallback
        return null;
      }
    }
    return null;
  }, [isToolCall, node.toolArgs]);

  const rawToolArgs = node.toolArgs || '';

  // If this is a "complete_task" tool call, it often contains the final answer/report.
  const isFinalReportTool = isToolCall && node.name === 'complete_task';
  const finalReportContent = isFinalReportTool && toolArgs?.report;

  return (
    <div className={`flex flex-col mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div 
        className={`
          relative flex flex-col rounded-lg border ${borderColor} ${bgColor} 
          transition-all duration-200 overflow-hidden
        `}
      >
        {/* Header - Click to collapse/expand */}
        <div 
          className="flex items-center p-3 gap-3 cursor-pointer select-none bg-slate-900/20 hover:bg-slate-900/40 transition-colors"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-slate-800 border border-slate-700">
            {getIcon()}
          </div>
          
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold truncate ${isAgent ? 'text-purple-300' : 'text-slate-300'}`}>
                {node.name || 'Unknown Agent'}
              </span>
              <span className="text-xs text-slate-500 uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-900">
                {node.role.replace('_', ' ')}
              </span>
              {node.status === 'completed' && !isError && (
                <CheckCircle2 className="w-3 h-3 text-green-500/50" />
              )}
            </div>
          </div>

          {hasChildren && (
             <div className="text-slate-500 hover:text-slate-300">
               {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
             </div>
          )}
        </div>

        {/* Content Body */}
        {!isCollapsed && (
          <div className="text-sm text-slate-400 flex flex-col">
            
            {/* Primary Content Container */}
            <div className="px-3 pb-3 pl-[3.25rem]">
                
                {/* 1. Tool Arguments (Input) */}
                {isToolCall && rawToolArgs && (
                <div className="flex flex-col gap-1 mb-2 mt-1">
                    <span className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">Input</span>
                    <div className="bg-slate-950/50 rounded p-2 font-mono text-xs text-orange-200/80 overflow-x-auto border border-orange-500/10">
                        {/* Prefer pretty printed JSON, fall back to raw string if parsing fails (streaming) */}
                        <pre>{toolArgs ? JSON.stringify(toolArgs, null, 2) : rawToolArgs}</pre>
                    </div>
                </div>
                )}

                {/* 2. Special Highlight for Final Report Tool Call */}
                {finalReportContent && (
                    <div className="mt-2 p-4 bg-green-900/20 border border-green-500/30 rounded text-green-100 prose prose-invert prose-sm max-w-none">
                        <div className="font-bold text-green-400 mb-1 flex items-center gap-2">
                            <FileText size={14}/> Report Generated
                        </div>
                        {finalReportContent}
                    </div>
                )}

                {/* 3. Tool Result (Output) */}
                {node.toolResult && (
                <div className="flex flex-col gap-1 mt-2 animate-in fade-in duration-500">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">Output</span>
                        <ArrowRightLeft size={10} className="text-slate-600"/>
                    </div>
                    <div className="bg-slate-900/50 rounded p-2 font-mono text-xs text-green-200/70 border border-green-500/10 whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar">
                        {node.toolResult}
                    </div>
                </div>
                )}

                {/* 4. Assistant Text Content (Thoughts/Message) */}
                {(!isToolCall) && node.content && (
                <div className="whitespace-pre-wrap leading-relaxed opacity-90 font-mono text-xs md:text-sm mt-1">
                    {node.content}
                </div>
                )}

                {/* 5. Thinking Indicator - Only show if incomplete and no result yet */}
                {node.status === 'streaming' && !node.toolResult && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                     <Loader2 className="w-3 h-3 animate-spin" />
                     <span className="italic">
                        {isToolCall ? 'Executing tool...' : 'Thinking...'}
                     </span>
                  </div>
                )}
            </div>

            {/* 6. Children (Nested Items) - Rendered INSIDE the card now */}
            {hasChildren && (
                <div className="mt-1 border-t border-slate-700/50 bg-slate-900/20 p-2 pl-4 md:pl-6 rounded-b-lg">
                    {node.children.map(childId => (
                        <ResearchNode 
                        key={childId} 
                        nodeId={childId} 
                        nodes={nodes} 
                        depth={depth + 1} 
                        />
                    ))}
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(ResearchNode);