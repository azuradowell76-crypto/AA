import React from 'react';
import MindmapGenerator from './components/MindmapGenerator';
import './App.css';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-3xl font-bold text-gray-900">
            🧠 AI思维导图生成器
          </h1>
          <p className="text-gray-600 mt-2">
            {/* 基于本地AI的智能思维导图创建工具 */}
          </p>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <MindmapGenerator />
      </main>
    </div>
  );
}

export default App;