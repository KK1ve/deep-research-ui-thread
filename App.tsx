import React from 'react';
import Visualization from './components/Visualization';

const App: React.FC = () => {
  return (
    <div className="w-full h-full bg-background text-white font-sans selection:bg-purple-500/30 selection:text-purple-200">
       {/* Background decorative elements */}
       <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-20 -right-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 -left-20 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl"></div>
       </div>
       
       <div className="relative z-10 w-full h-full">
         <Visualization />
       </div>
    </div>
  );
};

export default App;