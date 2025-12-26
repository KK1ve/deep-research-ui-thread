import React, { useState } from 'react';
import Visualization from './components/Visualization';
import Sidebar from './components/Sidebar';
import { Menu } from 'lucide-react';

const App: React.FC = () => {
  const [currentConversionId, setCurrentConversionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [refreshSidebarTrigger, setRefreshSidebarTrigger] = useState(0);

  const handleConversionCreated = (uuid: string) => {
    setCurrentConversionId(uuid);
    setRefreshSidebarTrigger(prev => prev + 1);
  };

  const handleNewChat = () => {
    setCurrentConversionId(null);
    setRefreshSidebarTrigger(prev => prev + 1);
  };

  return (
    <div className="flex w-full h-full bg-background text-white font-sans selection:bg-purple-500/30 selection:text-purple-200 overflow-hidden">
       
       {/* Background decorative elements */}
       <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-20 -right-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 -left-20 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl"></div>
       </div>

       <Sidebar 
         onSelectConversion={setCurrentConversionId}
         onNewChat={handleNewChat}
         currentConversionId={currentConversionId}
         isOpen={isSidebarOpen}
         onClose={() => setIsSidebarOpen(false)}
         refreshTrigger={refreshSidebarTrigger}
       />
       
       <div className="flex-1 flex flex-col relative z-10 h-full w-full">
         {/* Mobile Header for Sidebar Toggle */}
         <div className="md:hidden p-4 flex items-center border-b border-slate-800">
            <button onClick={() => setIsSidebarOpen(true)} className="text-slate-400 hover:text-white">
              <Menu size={24} />
            </button>
            <span className="ml-4 font-bold text-slate-200">Deep Research</span>
         </div>

         <Visualization 
            conversionId={currentConversionId} 
            onConversionCreated={handleConversionCreated}
         />
       </div>
    </div>
  );
};

export default App;
