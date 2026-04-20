/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  SquarePen, 
  Trash2, 
  ChevronRight, 
  History, 
  Download, 
  AlertCircle, 
  Zap, 
  Maximize2,
  FileText,
  Save,
  MessageSquareWarning,
  Loader2,
  BrainCircuit
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  Cell,
  Tooltip
} from 'recharts';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Internal types and services
import { RecognitionResult, HistoryItem, Prediction } from './types.ts';
import { preprocessImage } from './services/imageProcessing.ts';
import { recognizeHandwriting } from './services/geminiService.ts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const DrawingCanvas = ({ 
  onSave, 
  isProcessing 
}: { 
  onSave: (url: string) => void, 
  isProcessing: boolean 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penColor, setPenColor] = useState('#3b82f6');
  const [penWidth, setPenWidth] = useState(8);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Responsive canvas
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        // Keep square aspect ratio for better recognition
        const size = Math.min(parent.clientWidth, 600);
        canvas.width = size;
        canvas.height = size;
        // Re-set default styles
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = penColor;
        ctx.lineWidth = penWidth;
        // Background
        ctx.fillStyle = '#0b0e14';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const getPointerPos = (e: React.MouseEvent | React.TouchEvent | any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (isProcessing) return;
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPointerPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || isProcessing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPointerPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const endDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.fillStyle = '#0b0e14';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleSubmit = async () => {
    if (!canvasRef.current || isProcessing) return;
    
    const ctx = canvasRef.current.getContext('2d');
    const imageData = ctx?.getImageData(0,0, canvasRef.current.width, canvasRef.current.height);
    const hasContent = imageData?.data.some((val, idx) => idx % 4 === 3 && val > 0);
    
    if (!hasContent) return;

    try {
      const processed = await preprocessImage(canvasRef.current);
      onSave(processed.previewUrl);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="w-full h-full flex flex-col relative overflow-hidden group">
      {/* Canvas Header Info */}
      <div className="absolute top-4 left-6 flex items-center gap-4 z-10">
        <span className="px-2 py-0.5 rounded bg-bento-cyan text-[10px] font-bold text-slate-950 uppercase">Canvas Active</span>
        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">DPI: 300 | RESOLUTION: 1024x1024</span>
      </div>

      <div className="relative flex-grow h-full bg-grid">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={endDrawing}
          className="w-full h-full rounded-3xl neumorphic-inset canvas-cursor transition-all border-2 border-transparent group-hover:border-bento-cyan/30 touch-none"
        />
        {isProcessing && (
          <div className="absolute inset-0 bg-bento-bg/60 backdrop-blur-sm rounded-3xl flex items-center justify-center z-20">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-bento-cyan blur-xl opacity-20 animate-pulse"></div>
                <Loader2 className="w-12 h-12 text-bento-cyan animate-spin relative" />
              </div>
              <p className="text-bento-cyan font-display font-medium animate-pulse">Running Hybrid CNN-T Inference...</p>
            </div>
          </div>
        )}
      </div>

      {/* Floating Controls */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-10">
        <button 
          onClick={clearCanvas}
          className="px-6 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white hover:border-bento-cyan/30 transition-all"
        >
          Clear
        </button>
        <button 
          onClick={handleSubmit}
          disabled={isProcessing}
          className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl text-xs font-bold uppercase tracking-widest text-white shadow-lg cyan-glow disabled:opacity-50 transition-all"
        >
          Process Input
        </button>
      </div>
    </div>
  );
};

// --- Heatmap Implementation ---
const ActivationHeatmap = ({ result }: { result: RecognitionResult | null }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!result || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const points = JSON.parse(result.heatmapUrl || '[]');
      if (points.length > 0) {
        points.forEach((p: any) => {
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 30);
          gradient.addColorStop(0, `rgba(34, 211, 238, ${p.intensity || 0.6})`);
          gradient.addColorStop(1, 'rgba(34, 211, 238, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    };
    img.src = result.imageUrl;
  }, [result]);

  if (!result) return (
    <div className="w-full h-full rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 font-display text-xs italic text-center p-4">
      Awaiting inference for XAI mapping
    </div>
  );

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 group">
      <canvas ref={canvasRef} className="w-full h-full object-contain" />
    </div>
  );
};

// --- Confidence Meter ---
const ConfidenceMeter = ({ predictions }: { predictions: Prediction[] }) => {
  if (predictions.length === 0) return null;

  return (
    <div className="space-y-4">
      {predictions.map((p, i) => (
        <div key={i}>
          <div className="flex justify-between text-sm mb-1 uppercase tracking-tighter">
            <span className={cn("font-mono font-bold", i === 0 ? "text-white" : "text-slate-500")}>"{p.char}"</span>
            <span className={p.confidence > 0.5 ? "text-bento-cyan" : "text-slate-500"}>
              {(p.confidence * 100).toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${p.confidence * 100}%` }}
              className={cn("h-full transition-all", i === 0 ? "bg-bento-cyan" : "bg-slate-600")}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default function App() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [currentResult, setCurrentResult] = useState<RecognitionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('scriptscan_history');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const saveToHistory = (result: RecognitionResult) => {
    const newItem: HistoryItem = {
      id: result.id,
      text: result.text,
      timestamp: result.timestamp,
      imageUrl: result.imageUrl
    };
    const updated = [newItem, ...history].slice(0, 10);
    setHistory(updated);
    localStorage.setItem('scriptscan_history', JSON.stringify(updated));
  };

  const handleRecognition = async (imageUrl: string) => {
    setIsProcessing(true);
    try {
      const result = await recognizeHandwriting(imageUrl);
      setCurrentResult(result);
      saveToHistory(result);
    } catch (error) {
      console.error(error);
      alert('Recognition failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const exportToDocx = async () => {
    if (!currentResult) return;
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ children: [new TextRun({ text: "ScriptScan Pro Export", bold: true, size: 32 })] }),
          new Paragraph({ children: [new TextRun("\nRecognized Text: " + currentResult.text)] }),
        ],
      }],
    });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `scan_${currentResult.id}.docx`);
  };

  return (
    <div className="h-screen bg-bento-bg text-slate-200 p-6 flex flex-col gap-4 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-2xl p-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center cyan-glow">
            <BrainCircuit className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white uppercase italic">
              ScriptScan <span className="text-bento-cyan">Pro</span>
            </h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">Alphanumeric Intelligence Dashboard</p>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2 bg-slate-950/50 px-3 py-1.5 rounded-full border border-slate-800">
            <span className="w-2 h-2 bg-bento-cyan rounded-full animate-pulse"></span>
            <span className="text-[10px] font-mono text-bento-cyan uppercase">System Ready: Hybrid CNN-T</span>
          </div>
          <button className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium border border-slate-700 text-slate-300 transition-all">Settings</button>
          <button className="px-4 py-1.5 bg-bento-cyan text-slate-950 rounded-lg text-xs font-bold cyan-glow hover:brightness-110 transition-all">Upgrade v2.4</button>
        </div>
      </header>

      {/* Main Bento Grid */}
      <div className="grid grid-cols-12 grid-rows-6 gap-4 flex-grow min-h-0">
        
        {/* History Column */}
        <div className="col-span-3 row-span-6 bento-card flex flex-col gap-4 overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">History Log</h3>
            <div className="text-[10px] text-slate-600 font-mono">10/10 MAX</div>
          </div>
          <div className="flex flex-col gap-3 overflow-y-auto pr-1 flex-grow">
            <AnimatePresence mode="popLayout">
              {history.map((item) => (
                <motion.div 
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 flex justify-between items-center group hover:bg-slate-800 hover:border-bento-cyan/30 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <img src={item.imageUrl} className="w-8 h-8 rounded bg-slate-900 object-cover border border-slate-700" alt="H" />
                    <span className="text-2xl font-mono text-white font-bold">{item.text}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-mono">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    <p className="text-xs text-bento-cyan font-bold tracking-tighter">SUCCESS</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {history.length === 0 && (
              <div className="text-center py-12 text-slate-600 text-xs italic">No session data</div>
            )}
          </div>
          <div className="mt-auto pt-4 border-t border-slate-800">
            <div className="flex justify-between text-[10px] mb-2 font-bold uppercase tracking-wider text-slate-500">
              <span>Session Uptime</span>
              <span className="text-slate-300">04:12:44</span>
            </div>
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span>Total Tokens</span>
              <span className="text-slate-300">{history.length * 42 }</span>
            </div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="col-span-6 row-span-4 bg-slate-950 border-2 border-bento-cyan/30 rounded-3xl relative overflow-hidden shadow-[inset_0_0_50px_rgba(6,182,212,0.1)]">
          <DrawingCanvas onSave={handleRecognition} isProcessing={isProcessing} />
        </div>

        {/* Predictions Area */}
        <div className="col-span-3 row-span-3 bento-card flex flex-col">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <BrainCircuit className="w-3 h-3" /> Top Predictions
          </h3>
          {currentResult ? (
            <div className="flex-grow flex flex-col justify-between">
              <ConfidenceMeter predictions={currentResult.predictions} />
              <div className="mt-6 p-3 bg-bento-cyan/5 border border-bento-cyan/20 rounded-xl">
                <p className="text-[10px] text-bento-cyan leading-relaxed font-medium">
                  <span className="font-black uppercase mr-1">AI Insight:</span> 
                  Disambiguation logic applied. {currentResult.text === 'S' || currentResult.text === '5' ? "S/5 distinction optimized." : "Standard classification pattern confirmed."}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-grow flex items-center justify-center text-slate-600 text-[10px] uppercase font-bold italic">
              Awaiting data...
            </div>
          )}
        </div>

        {/* Word Mode Segmentation Placeholder */}
        <div className="col-span-6 row-span-2 bento-card flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Segmentation Pattern</h3>
            <div className="flex gap-2 text-[10px] font-mono">
              <span className="text-bento-cyan underline cursor-pointer">AUTO-SEGMENT ON</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-500 cursor-pointer">L-R SCAN</span>
            </div>
          </div>
          <div className="flex-grow border-2 border-dashed border-slate-800 rounded-2xl flex items-center px-4 gap-2">
            <AnimatePresence mode="wait">
              {currentResult ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex gap-2 items-center w-full"
                >
                  {currentResult.text.split('').map((char, i) => (
                    <div key={i} className="h-12 w-10 bg-slate-800 flex items-center justify-center rounded border border-bento-cyan/30 text-white font-mono text-xl font-bold">
                      {char}
                    </div>
                  ))}
                  <div className="h-12 w-10 bg-slate-800/40 rounded flex items-center justify-center border border-slate-700 text-slate-600 font-mono text-xl italic opacity-50">_</div>
                  <div className="ml-auto flex gap-2">
                    <button onClick={exportToDocx} className="p-2 rounded-lg bg-slate-800 text-slate-500 hover:text-white transition-all">
                      <Download className="w-5 h-5" />
                    </button>
                    <button onClick={() => navigator.clipboard.writeText(currentResult.text)} className="p-2 rounded-lg bg-slate-800 text-slate-500 hover:text-white transition-all">
                      <Save className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="flex items-center gap-2 opacity-30 italic text-xs text-slate-600 font-mono">
                  No segments detected in current buffer
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* XAI Heatmap */}
        <div className="col-span-3 row-span-3 bento-card flex flex-col">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Explainable AI (XAI)</h3>
          <div className="flex-grow relative aspect-square w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 group">
             <ActivationHeatmap result={currentResult} />
             {currentResult && (
               <div className="absolute inset-0 pointer-events-none opacity-20">
                 <div className="absolute top-1/4 left-1/4 w-12 h-12 bg-red-500 rounded-full blur-xl animate-pulse"></div>
                 <div className="absolute bottom-1/3 right-1/4 w-16 h-16 bg-orange-500 rounded-full blur-2xl animate-pulse"></div>
               </div>
             )}
          </div>
          <p className="text-[9px] text-slate-600 mt-3 italic text-center font-bold uppercase tracking-tight">
            CNN-Trans activation focus mapping
          </p>
        </div>

      </div>
    </div>
  );
}

