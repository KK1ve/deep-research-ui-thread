import React, { useMemo, useState } from 'react';
import { ResearchNode as NodeInterface, Role } from '../types';
import { FinalReport } from './FinalReport';
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
  ArrowRightLeft,
  User
} from 'lucide-react';

interface Props {
  nodeId: string;
  nodes: Map<string, NodeInterface>;
  depth?: number;
  ancestorFinished?: boolean;
}

const ResearchNode: React.FC<Props> = ({ nodeId, nodes, depth = 0, ancestorFinished = false }) => {
  const node = nodes.get(nodeId);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Parse tool arguments safely
  const toolArgs = useMemo(() => {
    if (node?.role === Role.TOOL_CALL && node.toolArgs) {
      try {
        return JSON.parse(node.toolArgs);
      } catch (e) {
        return null;
      }
    }
    return null;
  }, [node?.role, node?.toolArgs]);

  // Determine the content for the Final Report component
  const finalReportContent = useMemo(() => {
    if (!node?.isFinal) return null;
    if (node.role === Role.HUMAN) return null;
    
    // 1. Priority: Direct content from the final message
    if (node.content && node.content.trim().length > 0) {
        return node.content;
    }
    
    // 2. Fallback: 'report' field from complete_task tool args
    if (node.role === Role.TOOL_CALL && node.name === 'complete_task' && toolArgs?.report) {
        return toolArgs.report;
    }

    return null;
  }, [node?.isFinal, node?.content, node?.role, node?.name, toolArgs]);

  // Determine if the node should be visually treated as completed
  const isEffectivelyDone = useMemo(() => {
    if (ancestorFinished) return true;
    if (!node) return false;
    if (node.status === 'completed') return true;
    
    // If agent is streaming, check if it has finished a complete_task
    if (node.role === Role.ASSISTANT) {
        return node.children.some(childId => {
            const child = nodes.get(childId);
            return child?.role === Role.TOOL_CALL && 
                   child.name === 'complete_task' && 
                   child.status === 'completed';
        });
    }
    return false;
  }, [node, nodes, ancestorFinished]);

  if (!node) return null;

  const hasChildren = node.children.length > 0;
  const isAgent = node.role === Role.ASSISTANT;
  const isToolCall = node.role === Role.TOOL_CALL;
  const isError = node.role === Role.ERROR;
  const isHuman = node.role === Role.HUMAN;

  // Visual styling based on role
  let borderColor = 'border-slate-700';
  let bgColor = 'bg-slate-800/30';
  let textColor = 'text-slate-300';

  if (isAgent) {
      borderColor = 'border-purple-500/30';
      bgColor = 'bg-purple-900/10';
      textColor = 'text-purple-300';
  } else if (isToolCall) {
      borderColor = 'border-orange-500/30';
      bgColor = 'bg-orange-900/10';
  } else if (isHuman) {
      borderColor = 'border-blue-500/30';
      bgColor = 'bg-blue-900/10';
      textColor = 'text-blue-300';
  } else if (isError) {
      borderColor = 'border-red-500/30';
      bgColor = 'bg-red-900/10';
      textColor = 'text-red-300';
  }

  const getIcon = () => {
    if (node.status === 'streaming' && !isEffectivelyDone) return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />;
    if (isError || node.status === 'error') return <AlertCircle className="w-4 h-4 text-red-500" />;
    
    switch (node.role) {
      case Role.ASSISTANT:
        return <Bot className="w-4 h-4 text-purple-400" />;
      case Role.HUMAN:
        return <User className="w-4 h-4 text-blue-400" />;
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

  const getRoleLabel = (role: Role) => {
      switch(role) {
          case Role.ASSISTANT: return '智能体';
          case Role.HUMAN: return '用户';
          case Role.TOOL_CALL: return '工具调用';
          case Role.TOOL: return '工具结果';
          case Role.SYSTEM: return '系统';
          case Role.ERROR: return '错误';
          default: return (role as string).replace('_', ' ');
      }
  };

  const rawToolArgs = node.toolArgs || '';

  return (
    <div className={`flex flex-col mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300 ${isHuman ? 'items-end' : ''}`}>
      <div 
        className={`
          relative flex flex-col rounded-lg border ${borderColor} ${bgColor} 
          transition-all duration-200 overflow-hidden
          ${isHuman ? 'w-fit max-w-[85%] md:max-w-[70%]' : 'w-full'}
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
              <span className={`text-sm font-semibold truncate ${textColor}`}>
                {isHuman ? '你' : (node.name || '未知智能体')}
              </span>
              {!isHuman && (
                  <span className="text-xs text-slate-500 uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-900">
                    {getRoleLabel(node.role)}
                  </span>
              )}
              {isEffectivelyDone && !isError && !isHuman && (
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
            <div className={`px-3 pb-3 ${hasChildren || isToolCall ? 'pl-[3.25rem]' : 'pl-3'}`}>
                
                {/* 1. Tool Arguments (Input) */}
                {isToolCall && rawToolArgs && (
                <div className="flex flex-col gap-1 mb-2 mt-1">
                    <span className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">输入</span>
                    <div className="bg-slate-950/50 rounded p-2 font-mono text-xs text-orange-200/80 overflow-x-auto border border-orange-500/10">
                        <pre>{toolArgs ? JSON.stringify(toolArgs, null, 2) : rawToolArgs}</pre>
                    </div>
                </div>
                )}

                {/* 2. Tool Result (Output) */}
                {node.toolResult && (
                <div className="flex flex-col gap-1 mt-2 animate-in fade-in duration-500">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase text-slate-500 font-semibold tracking-wider">输出</span>
                        <ArrowRightLeft size={10} className="text-slate-600"/>
                    </div>
                    <div className="bg-slate-900/50 rounded p-2 font-mono text-xs text-green-200/70 border border-green-500/10 whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar">
                        {node.toolResult}
                    </div>
                </div>
                )}

                {/* 3. Text Content */}
                {/* 
                   If the content is exactly the same as the final report being shown below, 
                   we hide it here to avoid duplication.
                */}
                {(!isToolCall) && node.content && (finalReportContent !== node.content) && (
                <div className={`whitespace-pre-wrap leading-relaxed opacity-90 font-mono text-xs md:text-sm mt-1 ${isError ? 'text-red-400' : ''}`}>
                    {node.content}
                </div>
                )}

                {/* 4. Thinking Indicator */}
                {node.status === 'streaming' && !node.toolResult && !isEffectivelyDone && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                     <Loader2 className="w-3 h-3 animate-spin" />
                     <span className="italic">
                        {isToolCall ? '正在执行工具...' : '思考中...'}
                     </span>
                  </div>
                )}
            </div>

            {/* 5. Children (Nested Items) */}
            {hasChildren && (
                <div className="mt-1 border-t border-slate-700/50 bg-slate-900/20 p-2 pl-4 md:pl-6 rounded-b-lg">
                    {node.children.map(childId => (
                        <ResearchNode 
                        key={childId} 
                        nodeId={childId} 
                        nodes={nodes} 
                        depth={depth + 1} 
                        ancestorFinished={isEffectivelyDone}
                        />
                    ))}
                </div>
            )}
          </div>
        )}
      </div>

      {/* Final Report Component */}
      {finalReportContent && (
         <FinalReport report={finalReportContent} />
      )}
    </div>
  );
};

export default React.memo(ResearchNode);