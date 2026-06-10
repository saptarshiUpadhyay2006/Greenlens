'use client';
import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { Zap, Coins, ScanLine, Compass, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';

export default function FeaturesShowcase() {
  const { isSignedIn } = useUser();
  const cardsRef = useRef([]);

  useEffect(() => {
    // Subtle float entry for the showcase cards on mount
    gsap.fromTo(cardsRef.current, 
      { opacity: 0, y: 30 }, 
      { opacity: 1, y: 0, duration: 0.8, stagger: 0.15, ease: 'power3.out', delay: 0.2 }
    );
  }, []);

  return (
    <div className="min-h-screen w-screen bg-[#fafdfb] flex flex-col justify-center overflow-hidden relative font-sans py-20">
      {/* Decorative Blur Backgrounds */}
      <div className="absolute top-[20%] left-[-10%] w-[45%] h-[45%] rounded-full bg-emerald-400/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[45%] h-[45%] rounded-full bg-teal-400/5 blur-[120px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 flex flex-col lg:flex-row items-center justify-between gap-12 w-full">
        
        {/* Left Side: Copywriting */}
        <div className="w-full lg:w-[50%] flex flex-col justify-center text-left z-10">
          <div className="inline-flex items-center gap-2 bg-emerald-100/60 border border-emerald-200/50 px-4 py-1.5 rounded-full text-xs font-bold text-emerald-800 mb-6 w-fit backdrop-blur-sm animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            Core App Features
          </div>
          
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight leading-none uppercase mb-4">
            AI Technology & <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-teal-600">
              Ecosystem Actions
            </span>
          </h2>
          
          <p className="text-lg text-slate-600 font-semibold leading-relaxed max-w-xl">
            GreenLens delivers precision sustainability calculations. Through connected APIs and file parsing, your actual impact translates to measurable tokens that directly sponsor clean energy and biodiversity recovery.
          </p>
          
          <div className="mt-8">
            <Link href={isSignedIn ? "/home" : "/auth"}>
              <button className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-md rounded-2xl shadow-md transition duration-300 cursor-pointer">
                Enter Dashboard
              </button>
            </Link>
          </div>
        </div>

        {/* Right Side: Grid */}
        <div className="w-full lg:w-[50%] grid grid-cols-1 sm:grid-cols-2 gap-4 z-10">
          
          {/* Card 1: AI OCR Scan */}
          <Link href={isSignedIn ? "/home" : "/auth"} className="block cursor-pointer">
            <div 
              ref={(el) => (cardsRef.current[0] = el)}
              className="p-6 bg-white/70 backdrop-blur-xl border border-emerald-500/10 rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-500/20 transition-all duration-300 h-full"
            >
              <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center mb-4">
                <ScanLine className="w-5 h-5 text-yellow-600" />
              </div>
              <h3 className="text-md font-bold text-slate-900 mb-1">AI OCR Bill Parsing</h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Upload images or PDF bills. Our Fast-API service parses units and carpet area instantly.
              </p>
            </div>
          </Link>

          {/* Card 2: Transit Routing */}
          <Link href={isSignedIn ? "/home" : "/auth"} className="block cursor-pointer">
            <div 
              ref={(el) => (cardsRef.current[1] = el)}
              className="p-6 bg-white/70 backdrop-blur-xl border border-emerald-500/10 rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-500/20 transition-all duration-300 h-full"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <Compass className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-md font-bold text-slate-900 mb-1">Transit Routing Math</h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Input travel origin/destination. Auto-calculates commute distance and travel carbon.
              </p>
            </div>
          </Link>

          {/* Card 3: Dynamic ML Engine */}
          <Link href={isSignedIn ? "/home" : "/auth"} className="block cursor-pointer">
            <div 
              ref={(el) => (cardsRef.current[2] = el)}
              className="p-6 bg-white/70 backdrop-blur-xl border border-emerald-500/10 rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-500/20 transition-all duration-300 h-full"
            >
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <Zap className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-md font-bold text-slate-900 mb-1">Personalized ML Model</h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Evaluates home type energy use against benchmarks. Rewards smart carbon saving.
              </p>
            </div>
          </Link>

          {/* Card 4: NGO Offset Shop */}
          <Link href={isSignedIn ? "/home" : "/auth"} className="block cursor-pointer">
            <div 
              ref={(el) => (cardsRef.current[3] = el)}
              className="p-6 bg-white/70 backdrop-blur-xl border border-emerald-500/10 rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-500/20 transition-all duration-300 h-full"
            >
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <Coins className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="text-md font-bold text-slate-900 mb-1">NGO Carbon Offset</h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Deduct/burn Green Tokens in MongoDB to sponsor reforestation or ocean cleanup.
              </p>
            </div>
          </Link>

        </div>

      </div>
    </div>
  );
}
