import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Network, 
  ChevronRight, 
  Layers, 
  Users, 
  Map as MapIcon, 
  ShieldCheck, 
  Zap,
  BookOpen
} from 'lucide-react';

interface MindMapNode {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  children?: MindMapNode[];
  color?: string;
}

interface MindMapProps {
  data: MindMapNode;
  title: string;
}

const MindMap: React.FC<MindMapProps> = ({ data, title }) => {
  const renderNode = (node: MindMapNode, level: number = 0) => {
    return (
      <div key={node.id} className="flex flex-col items-center flex-1">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: level * 0.1, duration: 0.4 }}
          className={`
            relative p-5 rounded-2xl border shadow-xl transition-all hover:scale-105 duration-300
            ${level === 0 ? 'bg-primary border-primary text-black scale-110 mb-16 ring-4 ring-primary/20' : 
              level === 1 ? 'bg-zinc-800 border-primary/30 text-white mb-12 w-48' : 
              'bg-zinc-900 border-zinc-800 text-zinc-300 w-44'}
            text-center z-10 select-none
          `}
        >
          <div className={`mb-2 flex justify-center ${level === 0 ? 'text-black' : 'text-primary'}`}>
            {node.icon || (level === 0 ? <Zap className="w-6 h-6" /> : <ChevronRight className="w-4 h-4" />)}
          </div>
          <h3 className={`font-bold leading-tight ${level === 0 ? 'text-xl' : 'text-sm'}`}>
            {node.label}
          </h3>
          {node.description && (
            <p className="text-[10px] mt-2 opacity-70 leading-relaxed font-medium">
              {node.description}
            </p>
          )}
        </motion.div>

        {node.children && node.children.length > 0 && (
          <div className="relative flex justify-center pt-4">
            {/* Vertical stem from parent */}
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-0.5 bg-gradient-to-b from-primary/50 to-zinc-800 ${level === 0 ? 'h-16' : 'h-12'}`} />
            
            <div className="flex gap-12 px-6">
              {node.children.map((child, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === node.children!.length - 1;
                const isOnly = node.children!.length === 1;

                return (
                  <div key={child.id} className="relative pt-12">
                    {/* Horizontal link line */}
                    {!isOnly && (
                      <div 
                        className={`absolute top-0 h-0.5 bg-zinc-800 
                          ${isFirst ? 'left-1/2 right-0' : isLast ? 'left-0 right-1/2' : 'left-0 right-0'}`} 
                      />
                    )}
                    {/* Vertical stem to child */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-12 bg-zinc-800" />
                    
                    {renderNode(child, level + 1)}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full bg-zinc-950 p-12 border border-zinc-800 rounded-[2rem] overflow-x-auto custom-scrollbar">
      <div className="flex flex-col items-center min-w-max pb-12">
        <div className="mb-20 flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20">
            <Network className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <h2 className="text-4xl font-black text-white uppercase tracking-tighter text-center">
            {title}
          </h2>
          <div className="w-24 h-1 bg-primary rounded-full" />
        </div>
        <div className="flex justify-center w-full">
          {renderNode(data)}
        </div>
      </div>
    </div>
  );
};

export default MindMap;
