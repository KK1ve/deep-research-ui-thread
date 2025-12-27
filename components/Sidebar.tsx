import React, { useEffect, useState } from 'react';
import { ConversionVO, PaginationResponse } from '../types';
import { fetchHistory, deleteConversation } from '../services/api';
import { MessageSquare, Trash2, Clock, Loader2, Plus, ChevronLeft } from 'lucide-react';

interface Props {
  activeId: string | null;
  onSelect: (uuid: string) => void;
  onNewChat: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<Props> = ({ activeId, onSelect, onNewChat, isOpen, onClose }) => {
  const [conversations, setConversations] = useState<ConversionVO[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  const loadData = async (pageNum: number, append: boolean = false) => {
    try {
      setLoading(true);
      const data = await fetchHistory(pageNum);
      setConversations(prev => append ? [...prev, ...data.items] : data.items);
      setHasNext(data.has_next);
      setPage(data.page_num);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
        loadData(1);
    }
  }, [isOpen]); // Reload when opened to be fresh

  const handleDelete = async (e: React.MouseEvent, uuid: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation?')) return;
    
    try {
      await deleteConversation(uuid);
      setConversations(prev => prev.filter(c => c.conversion_uuid !== uuid));
      if (activeId === uuid) {
          onNewChat();
      }
    } catch (err) {
      console.error('Failed to delete', err);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <>
        {/* Mobile Overlay */}
        {isOpen && (
            <div 
                className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
                onClick={onClose}
            />
        )}

        {/* Sidebar Container */}
        <div className={`
            fixed top-0 bottom-0 left-0 z-50
            w-72 bg-slate-900 border-r border-white/5 shadow-2xl
            transform transition-transform duration-300 ease-in-out flex flex-col
            ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
            
            {/* Header */}
            <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="font-bold text-slate-200 flex items-center gap-2">
                    <Clock size={18} className="text-blue-400"/>
                    <span>History</span>
                </div>
                <button onClick={onClose} className="md:hidden text-slate-400 p-1">
                    <ChevronLeft />
                </button>
            </div>

            {/* New Chat Button */}
            <div className="p-4 shrink-0">
                <button 
                    onClick={() => {
                        onNewChat();
                        if (window.innerWidth < 768) onClose();
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-lg transition-colors font-medium text-sm shadow-lg shadow-blue-900/20"
                >
                    <Plus size={18} />
                    <span>New Research</span>
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-2 pb-4 scrollbar-thin">
                {conversations.length === 0 && !loading && (
                    <div className="text-center text-slate-500 mt-10 text-sm p-4">
                        No history found.
                    </div>
                )}

                <div className="space-y-1">
                    {conversations.map(conv => (
                        <div 
                            key={conv.conversion_uuid}
                            onClick={() => {
                                onSelect(conv.conversion_uuid);
                                if (window.innerWidth < 768) onClose();
                            }}
                            className={`
                                group relative p-3 rounded-lg cursor-pointer transition-all border border-transparent
                                ${activeId === conv.conversion_uuid 
                                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-100' 
                                    : 'hover:bg-slate-800 text-slate-300 hover:border-slate-700/50'
                                }
                            `}
                        >
                            <div className="pr-6">
                                <div className="font-medium text-sm truncate mb-1">
                                    {conv.title || 'Untitled Research'}
                                </div>
                                <div className="text-[10px] opacity-60 font-mono">
                                    {formatDate(conv.create_time)}
                                </div>
                            </div>
                            
                            <button 
                                onClick={(e) => handleDelete(e, conv.conversion_uuid)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/30 rounded opacity-0 group-hover:opacity-100 transition-all"
                                title="Delete"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>

                {loading && (
                    <div className="flex justify-center p-4">
                        <Loader2 className="animate-spin text-slate-500 w-5 h-5" />
                    </div>
                )}

                {hasNext && !loading && (
                    <button 
                        onClick={() => loadData(page + 1, true)}
                        className="w-full text-center text-xs text-slate-500 hover:text-blue-400 py-3 mt-2 border-t border-white/5"
                    >
                        Load More
                    </button>
                )}
            </div>
        </div>
    </>
  );
};

export default Sidebar;
