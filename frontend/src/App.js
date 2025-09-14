import React from 'react';
import MindmapGenerator from './components/MindmapGenerator';
import Logo from './components/Logo';
import './App.css';

function App() {
  return (
    <div className="min-h-screen">
      <header className="bg-white shadow-sm border-b" style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="header-content">
            <Logo size={48} showText={true} showIcon={true} />
            <div className="header-text">
              <h3 className="text-4xl font-bold text-gray-900" style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                思维导图生成器
                『 节点级AI对话，思维无限延伸 』
              </h3>
              {/* <p className="text-gray-600 mt-3 text-lg">
                节点级AI对话，思维无限延伸
              </p> */}
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <MindmapGenerator />
      </main>
    </div>
  );
}

export default App;