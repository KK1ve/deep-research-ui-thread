import React from 'react';
import { FileText, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  report: string;
}

export const FinalReport: React.FC<Props> = ({ report }) => {
  if (!report) return null;

  return (
    <div className="mt-4 mb-2 animate-in zoom-in-95 duration-500">
      <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/10 border border-green-500/30 rounded-xl overflow-hidden shadow-2xl shadow-green-900/20">
        <div className="bg-green-500/10 p-3 border-b border-green-500/20 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-green-400" />
          <h2 className="text-sm font-bold text-green-100">Final Research Report</h2>
        </div>
        <div className="p-4 md:p-6 text-sm text-slate-200">
           <ReactMarkdown 
             remarkPlugins={[remarkGfm]}
             className="prose prose-invert prose-sm max-w-none prose-a:text-green-400 prose-headings:text-green-100 prose-strong:text-green-200"
             components={{
               a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300 underline" />,
             }}
           >
             {report}
           </ReactMarkdown>
        </div>
        <div className="bg-green-950/30 p-2 text-center text-[10px] text-green-600/60 uppercase tracking-widest font-semibold">
            End of Transmission
        </div>
      </div>
    </div>
  );
};