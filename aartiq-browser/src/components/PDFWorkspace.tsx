"use client";

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Tesseract from 'tesseract.js';
import { FileText, Camera, Edit3, Trash2, Download, Search, Move, ZoomIn, ZoomOut, RotateCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Configure react-pdf worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

const PDFWorkspace = () => {
    const [file, setFile] = useState<File | null>(null);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [ocrText, setOcrText] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [annotations, setAnnotations] = useState<{ id: string; text: string; x: number; y: number }[]>([]);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // react-pdf specific state
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState(1);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        setPageNumber(1);
    }


    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            setFile(f);
            setFileUrl(URL.createObjectURL(f));
        }
    };

    const runOCR = async () => {
        if (!file) return;
        setIsProcessing(true);
        try {
            const result = await Tesseract.recognize(file, 'eng', {
                logger: m => {
                    if (m.status === 'recognizing text') setProgress(Math.round(m.progress * 100));
                }
            });
            setOcrText(result.data.text);
        } catch (err) {
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    const addAnnotation = () => {
        const newAnn = {
            id: Math.random().toString(36).substr(2, 9),
            text: "New Note",
            x: 100,
            y: 100
        };
        setAnnotations([...annotations, newAnn]);
    };

    return (
        <div className="flex h-full w-full bg-[var(--primary-bg)] text-[var(--primary-text)] relative z-50">
            {/* Sidebar */}
            <div className="w-72 border-r border-[var(--border-color)] p-6 flex flex-col gap-6 adaptive-theme-surface relative z-50">
                <div className="flex items-center gap-2 text-deep-space-accent-neon font-bold text-xl mb-4">
                    <FileText size={24} />
                    <span>Docs AI</span>
                </div>

                <div className="space-y-4">
                    <label className="block p-4 rounded-2xl border-2 border-dashed border-[var(--border-color)] hover:border-accent/30 hover:bg-[var(--primary-bg)]/5 transition-all cursor-pointer text-center">
                        <input type="file" className="hidden" accept="application/pdf,image/*" onChange={handleFileChange} />
                        <Download className="mx-auto mb-2 text-[var(--secondary-text)]/30" />
                        <span className="text-xs font-bold text-[var(--secondary-text)]/60">Upload PDF or Image</span>
                    </label>

                    {file && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-2xl bg-[var(--primary-bg)]/5 space-y-4">
                            <p className="text-xs font-mono text-[var(--secondary-text)]/40 truncate">{file.name}</p>
                            <button
                                onClick={runOCR}
                                disabled={isProcessing}
                                className="w-full py-2 bg-accent text-[var(--primary-bg)] rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg disabled:opacity-50"
                            >
                                {isProcessing ? `OCR: ${progress}%` : 'Extract Text (OCR)'}
                            </button>
                            <button
                                onClick={addAnnotation}
                                className="w-full py-2 bg-[var(--primary-bg)]/5 border border-[var(--border-color)] rounded-xl text-[10px] uppercase font-bold tracking-widest text-[var(--secondary-text)]/60 hover:bg-[var(--primary-bg)]/10 hover:text-[var(--primary-text)] transition-all"
                            >
                                Add Annotation
                            </button>
                        </motion.div>
                    )}
                </div>

                <div className="mt-auto">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/20 mb-3">Extracted Content</h4>
                    <div className="p-3 bg-white/[0.02] rounded-xl border border-white/5 text-[11px] text-white/40 max-h-40 overflow-y-auto custom-scrollbar italic leading-relaxed">
                        {ocrText || "No text extracted yet. Use the OCR tool above."}
                    </div>
                </div>
            </div>

            {/* Main Preview Area */}
            <div className="flex-1 overflow-hidden relative p-8 flex flex-col items-center justify-center bg-[var(--primary-bg)]">
                {!fileUrl ? (
                    <div className="text-center opacity-20">
                        <div className="w-24 h-24 rounded-full border-2 border-white/20 flex items-center justify-center mx-auto mb-6">
                            <FileText size={48} />
                        </div>
                        <p className="font-bold uppercase tracking-widest text-sm">No Document Selected</p>
                    </div>
                ) : (
                    <div className="relative w-full h-full flex items-center justify-center overflow-auto custom-scrollbar">
                        <div className="relative bg-white shadow-2xl rounded-sm group min-w-[600px] min-h-[800px]">
                            {file?.type === 'application/pdf' ? (
                                <div style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transition: 'transform 0.3s ease-out' }}>
                                    <Document
                                        file={fileUrl}
                                        onLoadSuccess={onDocumentLoadSuccess}
                                        className="shadow-2xl"
                                    >
                                        <Page
                                            pageNumber={pageNumber}
                                            renderTextLayer={true}
                                            renderAnnotationLayer={true}
                                        />
                                    </Document>
                                </div>
                            ) : (
                                <img
                                    src={fileUrl!}
                                    className="max-w-full"
                                    alt="document"
                                    style={{
                                        transform: `scale(${zoom}) rotate(${rotation}deg)`,
                                        transition: 'transform 0.3s ease-out'
                                    }}
                                />
                            )}

                            {/* Floating Annotations */}
                            {annotations.map((ann) => (
                                <motion.div
                                    drag
                                    key={ann.id}
                                    className="absolute p-3 glass-dark border border-deep-space-accent-neon/30 rounded-lg text-xs min-w-[120px] shadow-2xl cursor-move z-50 text-white"
                                    style={{ left: ann.x, top: ann.y }}
                                >
                                    <div className="flex items-center gap-2 mb-2 text-[10px] text-white/30 font-bold uppercase tracking-tighter">
                                        <Move size={8} />
                                        <span>Note</span>
                                    </div>
                                    <textarea
                                        value={ann.text}
                                        onChange={(e) => {
                                            const newAnns = [...annotations];
                                            const idx = newAnns.findIndex(a => a.id === ann.id);
                                            newAnns[idx].text = e.target.value;
                                            setAnnotations(newAnns);
                                        }}
                                        className="w-full bg-transparent border-none outline-none resize-none font-medium h-20"
                                    />
                                    <button
                                        onClick={() => setAnnotations(annotations.filter(a => a.id !== ann.id))}
                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-[8px]"
                                    >
                                        <Trash2 size={10} />
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Floating Toolbar */}
                <AnimatePresence>
                    {fileUrl && (
                        <motion.div
                            initial={{ y: 100 }}
                            animate={{ y: 0 }}
                            className="absolute bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl glass shadow-2xl flex gap-6 items-center border border-white/10"
                        >
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
                                    className="p-2 text-white/40 hover:text-white transition-all rounded-lg hover:bg-white/5"
                                >
                                    <ZoomOut size={18} />
                                </button>
                                <span className="text-[10px] font-black w-8 text-center text-white/60">{Math.round(zoom * 100)}%</span>
                                <button
                                    onClick={() => setZoom(z => Math.min(3, z + 0.1))}
                                    className="p-2 text-white/40 hover:text-white transition-all rounded-lg hover:bg-white/5"
                                >
                                    <ZoomIn size={18} />
                                </button>
                            </div>
                            <div className="w-[1px] h-8 bg-white/10" />
                            {file?.type === 'application/pdf' && (
                                <>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setPageNumber(prevPage => Math.max(1, prevPage - 1))}
                                            className="p-2 text-white/40 hover:text-white transition-all rounded-lg hover:bg-white/5"
                                            disabled={pageNumber <= 1}
                                        >
                                            <ChevronLeft size={18} />
                                        </button>
                                        <span className="text-[10px] font-black w-16 text-center text-white/60">
                                            Page {pageNumber} of {numPages || '-'}
                                        </span>
                                        <button
                                            onClick={() => setPageNumber(prevPage => Math.min(numPages || 1, prevPage + 1))}
                                            className="p-2 text-white/40 hover:text-white transition-all rounded-lg hover:bg-white/5"
                                            disabled={pageNumber >= (numPages || 1)}
                                        >
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>
                                    <div className="w-[1px] h-8 bg-white/10" />
                                </>
                            )}
                            <button
                                onClick={() => setRotation(r => (r + 90) % 360)}
                                className="flex flex-col items-center gap-1 text-white/40 hover:text-white transition-all font-bold"
                            >
                                <RotateCw size={18} />
                                <span className="text-[10px] uppercase tracking-tighter">Rotate</span>
                            </button>
                            <div className="w-[1px] h-8 bg-white/10" />
                            <button className="flex flex-col items-center gap-1 text-white/40 hover:text-white transition-all font-bold">
                                <Edit3 size={18} />
                                <span className="text-[10px] uppercase tracking-tighter">Annotate</span>
                            </button>
                            <div className="w-[1px] h-8 bg-white/10" />
                            <button
                                onClick={() => {
                                    if (window.electronAPI && fileUrl && file) {
                                        window.electronAPI.triggerDownload(fileUrl, file.name);
                                    }
                                }}
                                className="flex flex-col items-center gap-1 text-deep-space-accent-neon hover:scale-110 transition-all font-bold neon-glow"
                            >
                                <Download size={18} />
                                <span className="text-[10px] uppercase tracking-tighter">Export</span>
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default PDFWorkspace;
