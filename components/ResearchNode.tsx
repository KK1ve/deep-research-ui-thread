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

  // Visual indentation logic
  const paddingLeft = `${depth * 1.5}rem`;

  const getIcon = () => {
    if (node.status === 'streaming') return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />;
    if (isError) return <AlertCircle className="w-4 h-4 text-red-500" />;
    
    switch (node.role) {
      case Role.ASSISTANT:
        return <Bot className="w-4 h-4 text-purple-400" />;
      case Role.TOOL_CALL:
        if (node.name?.includes('search')) return <Search className="w-4 h-4 text-orange-400" />;
        if (node.name?.includes('fetch')) return <Globe className="w-4 h-4 text-blue-400" />;
        return <Cpu className="w-4 h-4 text-orange-400" />;
      case Role.TOOL:
        return <FileText className="w-4 h-4 text-green-400" />;
      case Role.SYSTEM:
        return <Cpu className="w-4 h-4 text-gray-400" />;
      default:
        return <Bot className="w-4 h-4 text-gray-400" />;
    }
  };

  const getRoleName = (role: Role) => {
    switch (role) {
      case Role.HUMAN: return '用户';
      case Role.ASSISTANT: return '智能体';
      case Role.TOOL_CALL: return '工具调用';
      case Role.TOOL: return '工具结果';
      case Role.SYSTEM: return '系统';
      case Role.ERROR: return '错误';
      default: return role;
    }
  };

  const getTranslatedName = (name: string) => {
    if (!name) return '未知';
    const lower = name.toLowerCase();
    if (lower.includes('web_search')) return '网络搜索';
    if (lower.includes('search')) return '搜索';
    if (lower.includes('fetch')) return '网页抓取';
    if (lower.includes('complete_task')) return '任务完成';
    if (lower.includes('run_blocking_subagent')) return '调用子智能体';
    if (lower.includes('subagent')) return '子智能体';
    if (lower === 'lead_agent' || lower === 'main') return '主控智能体';
    return name;
  };

  const borderColor = isAgent ? 'border-purple-500/30' : isToolCall ? 'border-orange-500/30' : 'border-slate-700';
  const bgColor = isAgent ? 'bg-purple-900/10' : isToolCall ? 'bg-orange-900/10' : 'bg-slate-800/30';

  // Parse content if it's a tool call to show formatted args
  const toolArgs = useMemo(() => {
    if (isToolCall && node.content) {
      try {
        return JSON.parse(node.content);
      } catch (e) {
        return null;
      }
    }
    return null;
  }, [isToolCall, node.content]);

  // If this is a "complete_task" tool call, it often contains the final answer/report.
  const isFinalReportTool = isToolCall && node.name === 'complete_task';

  return (
    <div className={`flex flex-col mb-2 animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div 
        className={`
          relative flex flex-col rounded-lg border ${borderColor} ${bgColor} 
          transition-all duration-200 hover:border-opacity-50
        `}
        style={{ marginLeft: depth > 0 ? '1rem' : '0' }}
      >
        {/* Connector Line for nested items */}
        {depth > 0 && (
          <div 
            className="absolute -left-4 top-4 w-4 h-[1px] bg-slate-700"
            aria-hidden="true"
          />
        )}

        {/* Header */}
        <div 
          className="flex items-center p-3 gap-3 cursor-pointer select-none"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-slate-800 border border-slate-700">
            {getIcon()}
          </div>
          
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold truncate ${isAgent ? 'text-purple-300' : 'text-slate-300'}`}>
                {getTranslatedName(node.name)}
              </span>
              <span className="text-xs text-slate-500 uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-900">
                {getRoleName(node.role)}
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
          <div className="px-3 pb-3 pl-[3.25rem] text-sm text-slate-400 overflow-hidden">
            
            {/* Tool Arguments (Request) */}
            {isToolCall && toolArgs && (
              <div className="bg-slate-950/50 rounded p-2 mb-2 font-mono text-xs text-orange-200/80 overflow-x-auto relative group">
                <div className="absolute top-1 right-2 text-[10px] text-slate-600 uppercase">输入</div>
                <pre>{JSON.stringify(toolArgs, null, 2)}</pre>
              </div>
            )}

            {/* Special Highlight for Final Report Tool Call */}
            {isFinalReportTool && toolArgs?.report && (
                 <div className="mt-2 p-4 bg-green-900/20 border border-green-500/30 rounded text-green-100 prose prose-invert prose-sm max-w-none">
                    <div className="font-bold text-green-400 mb-1 flex items-center gap-2">
                        <FileText size={14}/> 报告已生成
                    </div>
                    {toolArgs.report}
                 </div>
            )}

            {/* Tool Result (Response) - Rendered if it exists */}
            {node.toolResult && (
               <div className="mt-2 bg-slate-900/50 border border-slate-700/50 rounded p-2 font-mono text-xs text-green-200/80 overflow-x-auto relative">
                  <div className="absolute top-1 right-2 text-[10px] text-slate-600 uppercase flex items-center gap-1">
                    <ArrowRightLeft size={10} /> 输出
                  </div>
                  <div className="whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar">
                    {node.toolResult}
                  </div>
               </div>
            )}

            {/* Standard Text Content (if not parsed as tool args) */}
            {(!isToolCall || !toolArgs) && node.content && (
              <div className="whitespace-pre-wrap leading-relaxed opacity-90 font-mono text-xs md:text-sm">
                {node.content}
              </div>
            )}

            {/* Streaming Indicator if no content yet */}
            {node.status === 'streaming' && !node.content && !node.toolResult && (
              <span className="animate-pulse text-slate-600">思考中...</span>
            )}
          </div>
        )}
      </div>

      {/* Children Recursion */}
      {!isCollapsed && hasChildren && (
        <div className="flex flex-col mt-2 border-l border-slate-800 ml-4 pl-0">
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
  );
};

export default React.memo(ResearchNode);