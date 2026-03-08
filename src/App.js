import React from 'react';
import Sidebar from './components/Sidebar';
import Hero from './components/Hero';
import ContentSection from './components/ContentSection';
import ToolsSection from './components/ToolsSection';
import AIComparison from './components/AIComparison';
import Footer from './components/Footer';
import './styles/App.css';

function App() {
  const leftSidebarItems = [
    'ALL TIME AI POPULAR TOPICS',
    'LAST WEEK DISCUSSIONS',
    'TRENDING AI INNOVATION'
  ];

  const rightSidebarItems = [
    'POPULAR AI APPS',
    'HOW FAR DO YOU UNDERSTAND AI?',
    "WHAT'S NEXT?"
  ];

  return (
    <div className="main-wrapper">
      <Sidebar items={leftSidebarItems} />
      
      <main className="content-center">
        <div className="logo-container">
          <img src="pointingai.png" alt="vAIbes Logo" className="logo-image" />
        </div>

        <Hero />
        
        {/* AI Comparison moved here - right after hero */}
        <AIComparison />
        
        <section id="content" className="section-padding">
          <ContentSection />
          
          <div className="tools-intro">
            <h3>Below are tools you may find helpful</h3>
            <p>You are free to use any of the tools below, depending on what you are trying to understand or verify.</p>
            <p>You do not need to use all of them.</p>
            <p>No single tool guarantees accuracy. Agreement across sources matters more than confidence.</p>
            <p><strong>If answers differ, take a moment to compare sources and decide what makes sense to you.</strong></p>
          </div>

          <ToolsSection />
        </section>

        <Footer />
      </main>

      <Sidebar items={rightSidebarItems} isRight={true} />
    </div>
  );
}

export default App;