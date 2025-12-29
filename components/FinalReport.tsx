import React, { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { Viewer } from '@bytemd/react';
import gfm from '@bytemd/plugin-gfm';
import highlight from '@bytemd/plugin-highlight';

const plugins = [
  gfm(),
  highlight(),
];

// Workaround for type definition mismatch in @bytemd/react
const MarkdownViewer = Viewer as any;

interface Props {
  report: string;
}

export const FinalReport: React.FC<Props> = ({ report }) => {
  const processedContent = useMemo(() => {
    if (!report) return '';
    
    let content = report;

    // Pattern 1: <source: http://example.com>
    // Replace <source: url> patterns with Markdown links
    content = content.replace(/<source:\s*([^>]+)>/gi, (_, url) => {
      const cleanUrl = url.trim();
      return ` [[Source]](${cleanUrl})`;
    });

    // Pattern 2: <source>http://example.com</source>
    // Replace standard XML-like source tags
    content = content.replace(/<source>(.*?)<\/source>/gi, (_, url) => {
      const cleanUrl = url.trim();
      return ` [[Source]](${cleanUrl})`;
    });

    return content;
  }, [report]);

  if (!report) return null;

  return (
    <div className="mt-4 mb-2 animate-in zoom-in-95 duration-500">
      <div className="bg-gradient-to-br from-green-900/20 to-emerald-900/10 border border-green-500/30 rounded-xl overflow-hidden shadow-2xl shadow-green-900/20">
        <div className="bg-green-500/10 p-3 border-b border-green-500/20 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-green-400" />
          <h2 className="text-sm font-bold text-green-100">Final Research Report</h2>
        </div>
        <div className="p-4 md:p-6 text-sm text-slate-200">
           {/* ByteMD Viewer renders with .markdown-body class. Styles are overridden in index.html */}
           <div className="w-full break-words">
               <MarkdownViewer value={processedContent} plugins={plugins} />
           </div>
        </div>
        <div className="bg-green-950/30 p-2 text-center text-[10px] text-green-600/60 uppercase tracking-widest font-semibold">
            End of Transmission
        </div>
      </div>
    </div>
  );
};