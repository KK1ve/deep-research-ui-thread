import React from 'react';
import { FileText, Sparkles } from 'lucide-react';

interface Props {
  report: string;
}

export const FinalReport: React.FC<Props> = ({ report }) => {
  if (!report) return null;

  return (
    <div className="mt-8 animate-in zoom-in-95 duration-500">
      <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/10 border border-green-500/30 rounded-xl overflow-hidden shadow-2xl shadow-green-900/20">
        <div className="bg-green-500/10 p-4 border-b border-green-500/20 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-bold text-green-100">Final Research Report</h2>
        </div>
        <div className="p-6 md:p-8">
           <div className="prose prose-invert prose-green max-w-none">
             <div className="whitespace-pre-wrap text-slate-200 leading-7">
               {report}
             </div>
           </div>
        </div>
        <div className="bg-green-950/30 p-3 text-center text-xs text-green-600/60 uppercase tracking-widest font-semibold">
            End of Transmission
        </div>
      </div>
    </div>
  );
};