import React, { useEffect, useState } from 'react';
import { fetchConversations, deleteConversation } from '../services/api';
import { ConversionVO } from '../types';
import { MessageSquare, Trash2, Plus, Loader2, Menu, X, History, Settings } from 'lucide-react';
import { SettingsModal } from './SettingsModal';

interface Props {
  onSelectConversion: (uuid: string) => void;
  onNewChat: () => void;
  currentConversionId: string | null;
  isOpen: boolean;
  onClose: () => void;
  refreshTrigger: number; // Increment to force refresh
}

const Sidebar: React.FC<Props> = ({ 
  onSelectConversion, 
  onNewChat, 
  currentConversionId, 
  isOpen, 
  onClose,
  refreshTrigger
}) => {
  const [conversations, setConversations] = useState<ConversionVO[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadConversations();
  }, [refreshTrigger]);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const data = await fetchConversations();
      setConversations(data.items);
    } catch (error) {
      console.error('Failed to load history', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, uuid: string) => {
    e.stopPropagation();
    if (!window.confirm('确定要删除这段对话吗？')) return;
    
    try {
      await deleteConversation(uuid);
      if (currentConversionId === uuid) {
        onNewChat();
      }
      loadConversations();
    } catch (error) {
      console.error('Failed to delete', error);
    }
  };

  return (
    <>
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden" 
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed top-0 left-0 z-40 h-full bg-slate-900 border-r border-slate-800 
        w-72 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0
      `}>
        <div className="flex flex-col h-full p-4">
          
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <History className="w-6 h-6 text-blue-500" />
              <span className="text-slate-100">历史记录</span>
            </h2>
            <button onClick={onClose} className="md:hidden text-slate-400">
              <X size={24} />
            </button>
          </div>

          {/* New Chat Button */}
          <button 
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 768) onClose();
            }}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors mb-4 font-medium"
          >
            <Plus size={18} />
            新建研究
          </button>

          {/* List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar mb-4">
            {loading && conversations.length === 0 ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
              </div>
            ) : (
              conversations.map((conv) => (
                <div 
                  key={conv.conversion_uuid}
                  onClick={() => {
                    onSelectConversion(conv.conversion_uuid);
                    if (window.innerWidth < 768) onClose();
                  }}
                  className={`
                    group flex items-center justify-between p-3 rounded-lg cursor-pointer border transition-all
                    ${currentConversionId === conv.conversion_uuid 
                      ? 'bg-slate-800 border-blue-500/50 text-blue-100' 
                      : 'bg-transparent border-transparent hover:bg-slate-800 text-slate-300'}
                  `}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <MessageSquare size={16} className={currentConversionId === conv.conversion_uuid ? 'text-blue-400' : 'text-slate-500'} />
                    <div className="flex flex-col overflow-hidden">
                       <span className="truncate text-sm font-medium">
                         {conv.title || '未命名研究'}
                       </span>
                       <span className="text-[10px] text-slate-500">
                         {new Date(conv.create_time).toLocaleDateString()}
                       </span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={(e) => handleDelete(e, conv.conversion_uuid)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-900/30 text-slate-500 hover:text-red-400 rounded transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer Settings */}
          <div className="pt-2 border-t border-slate-800">
            <button 
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-3 w-full p-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Settings size={18} />
              <span className="text-sm font-medium">系统设置</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;