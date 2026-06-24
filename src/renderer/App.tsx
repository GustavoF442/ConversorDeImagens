import React, { useState } from 'react';
import { TitleBar } from './components/TitleBar';
import { HomeScreen } from './components/HomeScreen';
import { ShoeConverter } from './components/ShoeConverter';
import { PdfMerger } from './components/PdfMerger';
import { ImageConverter } from './components/ImageConverter';

export default function App() {
  const [module, setModule] = useState<'home' | 'shoe' | 'pdf' | 'image'>('home');

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <TitleBar />
      {module === 'home' && <HomeScreen onSelectModule={setModule} />}
      {module === 'shoe' && <ShoeConverter onBack={() => setModule('home')} />}
      {module === 'pdf' && <PdfMerger onBack={() => setModule('home')} />}
      {module === 'image' && <ImageConverter onBack={() => setModule('home')} />}
    </div>
  );
}
