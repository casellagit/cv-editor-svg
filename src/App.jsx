import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
Upload, Trash2, Layers, Plus, X, 
Image as ImgIcon, Type as TxtIcon, ChevronDown, 
FolderOpen, Maximize2, ChevronLeft, ChevronRight,
Download, FontCursor, ArrowUp, ArrowDown, ChevronUp
} from 'lucide-react';

const App = () => {
const [elements, setElements] = useState([]);
const [maskData, setMaskData] = useState(null);
const [maskOpacity, setMaskOpacity] = useState(0.5);
const [selectedId, setSelectedId] = useState(null);
const [isDragging, setIsDragging] = useState(false);
const [assetLibrary, setAssetLibrary] = useState([]);
const [customFonts, setCustomFonts] = useState([]);
const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 800, h: 450 });
const [isExportOpen, setIsExportOpen] = useState(false);
const [isFullscreen, setIsFullscreen] = useState(false);
const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
const [rightSidebarOpen, setRightSidebarOpen] = useState(true);

const svgRef = useRef(null);
const dragInfo = useRef({ active: false, id: null, offset: { x: 0, y: 0 } });

useEffect(() => {
customFonts.forEach(async (font) => {
if (!document.fonts.check(`12px "${font.name}"`) && font.data) {
try {
const fontFace = new FontFace(font.name, `url(${font.data})`);
const loadedFace = await fontFace.load();
document.fonts.add(loadedFace);
} catch (err) {
console.error(`Errore caricamento font ${font.name}:`, err);
}
}
});
}, [customFonts]);

useEffect(() => {
const handleKeyDown = (e) => {
if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
setElements(prev => prev.filter(el => el.id !== selectedId));
setSelectedId(null);
}
};
window.addEventListener('keydown', handleKeyDown);
return () => window.removeEventListener('keydown', handleKeyDown);
}, [isFullscreen, selectedId]);

const fileToBase64 = (file) => new Promise((resolve, reject) => {
const reader = new FileReader();
reader.readAsDataURL(file);
reader.onload = () => resolve(reader.result);
reader.onerror = error => reject(error);
});

const handleFontUpload = async (e) => {
const files = Array.from(e.target.files);
for (const file of files) {
const fontName = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_');
try {
const base64Data = await fileToBase64(file);
const fontFace = new FontFace(fontName, `url(${base64Data})`);
const loadedFace = await fontFace.load();
document.fonts.add(loadedFace);
setCustomFonts(prev => [...prev, { name: fontName, file: file.name, data: base64Data }]);
} catch (err) {
console.error("Errore caricamento font:", err);
}
}
};

const getSvgMetadata = (svgString) => {
const parser = new DOMParser();
const doc = parser.parseFromString(svgString, "image/svg+xml");
const svgEl = doc.querySelector('svg');
if (!svgEl) return { viewBox: "0 0 100 100", width: 100, height: 100, content: "" };
const vb = svgEl.getAttribute('viewBox');
const w = parseFloat(svgEl.getAttribute('width')) || 100;
const h = parseFloat(svgEl.getAttribute('height')) || 100;
// Rimuoviamo gli stili che potrebbero forzare colori dall'esterno se presenti nel root
return { viewBox: vb || `0 0 ${w} ${h}`, width: w, height: h, content: svgEl.innerHTML };
};

const sanitizeSvgForPreview = (svgContent) => {
return svgContent.replace(/<svg([^>]*)>/, (match, attrs) => {
const cleaned = attrs.replace(/width="[^"]*"/gi, '').replace(/height="[^"]*"/gi, '');
return `<svg${cleaned} style="max-width:100%; max-height:100%; width:auto; height:auto;">`;
});
};

const saveProject = () => {
const project = { 
elements, maskData, viewBox, assetLibrary, customFonts, maskOpacity,
timestamp: Date.now(), version: '1.8' 
};
const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url; link.download = `project_${Date.now()}.json`; link.click();
URL.revokeObjectURL(url);
};

const loadProject = (e) => {
const file = e.target.files[0];
if (!file) return;
const reader = new FileReader();
reader.onload = (e) => {
try {
const project = JSON.parse(e.target.result);
if (project.elements) setElements(project.elements);
if (project.maskData !== undefined) setMaskData(project.maskData);
if (project.viewBox) setViewBox(project.viewBox);
if (project.assetLibrary) setAssetLibrary(project.assetLibrary);
if (project.customFonts) setCustomFonts(project.customFonts);
if (project.maskOpacity !== undefined) setMaskOpacity(project.maskOpacity);
setSelectedId(null);
} catch (err) { console.error("Errore caricamento JSON:", err); }
};
reader.readAsText(file);
e.target.value = null;
};

const getEventPos = (e) => {
if (!svgRef.current) return { x: 0, y: 0 };
const svg = svgRef.current;
const point = svg.createSVGPoint();
if (e.touches && e.touches.length > 0) {
point.x = e.touches[0].clientX; point.y = e.touches[0].clientY;
} else {
point.x = e.clientX; point.y = e.clientY;
}
const ctm = svg.getScreenCTM().inverse();
return point.matrixTransform(ctm);
};

const startDrag = (e, id) => {
e.stopPropagation();
if (isFullscreen) return;
const pos = getEventPos(e);
const el = elements.find(item => item.id === id);
if (!el) return;
dragInfo.current = { active: true, id, offset: { x: pos.x - el.x, y: pos.y - el.y } };
setIsDragging(true);
setSelectedId(id);
};

const handleDrag = useCallback((e) => {
if (!dragInfo.current.active) return;
const pos = getEventPos(e);
setElements(prev => prev.map(el => 
el.id === dragInfo.current.id 
? { ...el, x: Math.round(pos.x - dragInfo.current.offset.x), y: Math.round(pos.y - dragInfo.current.offset.y) } 
: el
));
}, []);

const stopDrag = () => {
dragInfo.current.active = false;
setIsDragging(false);
};

const updateElement = (id, updates) => {
setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
};

const moveLayer = (id, direction) => {
const index = elements.findIndex(el => el.id === id);
if (index === -1) return;
const newElements = [...elements];
const el = newElements.splice(index, 1)[0];
if (direction === 'top') newElements.push(el);
else if (direction === 'bottom') newElements.unshift(el);
else if (direction === 'up') newElements.splice(Math.min(index + 1, elements.length - 1), 0, el);
else if (direction === 'down') newElements.splice(Math.max(index - 1, 0), 0, el);
setElements(newElements);
};

const handleProportionalScale = (id, scaleValue) => {
setElements(prev => prev.map(el => {
if (el.id === id) {
const ratio = el.originalRatio || (el.width / el.height);
return { ...el, width: Math.round(scaleValue), height: Math.round(scaleValue / ratio) };
}
return el;
}));
};

const exportAs = async (format) => {
const svg = svgRef.current;
if (!svg) return;
const clonedSvg = svg.cloneNode(true);
clonedSvg.querySelectorAll('.selection-rect').forEach(r => r.remove());
const serializer = new XMLSerializer();
const svgString = serializer.serializeToString(clonedSvg);
const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
const url = URL.createObjectURL(svgBlob);
if (format === 'svg') {
const link = document.createElement("a");
link.href = url; link.download = `export_${Date.now()}.svg`; link.click();
} else {
const img = new Image();
img.onload = () => {
const canvas = document.createElement("canvas");
canvas.width = viewBox.w; canvas.height = viewBox.h;
const ctx = canvas.getContext("2d");
ctx.drawImage(img, 0, 0);
const link = document.createElement("a");
link.href = canvas.toDataURL("image/png"); link.download = `export_${Date.now()}.png`; link.click();
};
img.src = url;
}
setIsExportOpen(false);
};

const selectedElement = elements.find(el => el.id === selectedId);

return (
<div className="flex h-screen bg-[#0a0c10] text-slate-100 overflow-hidden font-sans select-none">
{!isFullscreen && (
<aside className={`${leftSidebarOpen ? 'w-[300px]' : 'w-0'} bg-[#161b22] border-r border-slate-800 flex flex-col z-20 transition-all duration-300 relative`}>
<button onClick={() => setLeftSidebarOpen(!leftSidebarOpen)} className="absolute top-1/2 -right-4 -translate-y-1/2 w-8 h-12 bg-[#161b22] border border-slate-800 border-l-0 rounded-r-lg flex items-center justify-center hover:bg-blue-600 z-30">
{leftSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
</button>

<div className={`${leftSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'} h-full flex flex-col overflow-hidden`}>
<div className="p-4 border-b border-slate-800 bg-[#1c2128] flex justify-between items-center text-xs font-black uppercase tracking-widest text-blue-400">
<span className="flex items-center gap-2"><Layers size={14}/> Designer Touch</span>
<div className="flex gap-2">
<button onClick={saveProject} className="p-1.5 hover:bg-slate-700 rounded text-slate-400"><Download size={14}/></button>
<label className="p-1.5 hover:bg-slate-700 rounded text-slate-400 cursor-pointer">
<FolderOpen size={14}/><input type="file" className="hidden" accept=".json" onChange={loadProject} />
</label>
</div>
</div>

<div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
<section className="space-y-3">
<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sfondo / Maschera</label>
{!maskData ? (
<label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-slate-700 rounded-lg hover:border-blue-500 hover:bg-blue-500/5 cursor-pointer transition-all">
<Upload size={16} className="text-slate-500 mb-1" />
<span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Carica Maschera</span>
<input type="file" className="hidden" accept="image/*" onChange={async (e) => {
const file = e.target.files[0];
if (file) setMaskData(await fileToBase64(file));
}} />
</label>
) : (
<div className="relative group rounded-lg overflow-hidden border border-slate-700 aspect-video">
<img src={maskData} className="w-full h-full object-cover" />
<button onClick={() => setMaskData(null)} className="absolute top-2 right-2 p-1 bg-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>
</div>
)}
</section>

<section className="space-y-3">
<div className="flex justify-between items-center">
<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Font Library</label>
<label className="cursor-pointer text-blue-400 hover:text-blue-300">
<Plus size={16} />
<input type="file" className="hidden" multiple accept=".ttf,.otf,.woff,.woff2" onChange={handleFontUpload} />
</label>
</div>
<div className="space-y-1">
{customFonts.map((font, i) => (
<div key={i} className="flex items-center justify-between bg-[#0d1117] border border-slate-800 rounded px-2 py-1.5 text-[10px]">
<span className="truncate text-slate-300" style={{ fontFamily: font.name }}>{font.name}</span>
<button onClick={() => setCustomFonts(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-600 hover:text-red-400"><X size={10}/></button>
</div>
))}
</div>
</section>

<section className="space-y-3">
<div className="flex justify-between items-center">
<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Asset Library</label>
<label className="cursor-pointer text-blue-400 hover:text-blue-300">
<Plus size={16} /><input type="file" className="hidden" multiple accept=".svg,.png,.jpg" onChange={async (e) => {
const files = Array.from(e.target.files);
for (const file of files) {
const content = file.type === 'image/svg+xml' ? await file.text() : await fileToBase64(file);
setAssetLibrary(prev => [...prev, { id: crypto.randomUUID(), type: file.type === 'image/svg+xml' ? 'svg' : 'raster', content, name: file.name }]);
}
}} />
</label>
</div>
<div className="grid grid-cols-4 gap-2">
{assetLibrary.map(asset => (
<div key={asset.id} className="relative group aspect-square bg-[#0d1117] border border-slate-800 rounded p-1 hover:border-blue-500 cursor-pointer flex items-center justify-center overflow-hidden"
onClick={() => {
const meta = asset.type === 'svg' ? getSvgMetadata(asset.content) : { width: 150, height: 150, viewBox: null };
const newEl = {
id: crypto.randomUUID(), type: asset.type, content: asset.content, 
innerContent: asset.type === 'svg' ? meta.content : null, 
viewBox: meta.viewBox, x: 100, y: 100, width: meta.width, height: meta.height, 
// Impostiamo 'original' per non sovrascrivere i colori nativi dell'SVG
color: asset.type === 'svg' ? 'original' : '#ffffff', 
strokeColor: asset.type === 'svg' ? 'original' : '#000000', 
strokeWidth: 0, name: asset.name, originalRatio: meta.width / meta.height
};
setElements(prev => [...prev, newEl]);
setSelectedId(newEl.id);
}}>
{asset.type === 'svg' ? (
<div className="w-full h-full pointer-events-none svg-preview-container" dangerouslySetInnerHTML={{ __html: sanitizeSvgForPreview(asset.content) }} />
) : ( <img src={asset.content} className="max-w-full max-h-full object-contain pointer-events-none" /> )}
<button onClick={(e) => { e.stopPropagation(); setAssetLibrary(prev => prev.filter(a => a.id !== asset.id)); }} className="absolute top-0 right-0 p-1 bg-red-600 text-white rounded-bl opacity-0 group-hover:opacity-100 z-10"><Trash2 size={10}/></button>
</div>
))}
</div>
</section>
</div>
</div>
</aside>
)}

<main className="flex-1 flex flex-col relative bg-[#010409]">
{!isFullscreen && (
<header className="h-14 bg-[#161b22] border-b border-slate-800 flex items-center justify-between px-6 z-30">
<button onClick={() => {
const newText = { id: crypto.randomUUID(), type: 'text', x: 100, y: 100, content: 'TESTO', fontSize: 40, color: '#ffffff', strokeColor: '#000000', strokeWidth: 0, fontFamily: 'sans-serif' };
setElements([...elements, newText]);
setSelectedId(newText.id);
}} className="px-3 py-1.5 bg-blue-600 rounded text-xs font-bold hover:bg-blue-500 shadow-lg flex items-center gap-2 uppercase tracking-tighter">
<Plus size={14}/> Testo
</button>
<div className="flex items-center gap-3">
<button onClick={() => setIsExportOpen(!isExportOpen)} className="flex items-center gap-2 px-4 py-1.5 bg-[#21262d] border border-slate-700 rounded text-xs font-bold hover:bg-[#30363d]">ESPORTA <ChevronDown size={14} /></button>
{isExportOpen && (
<div className="absolute top-14 right-20 mt-2 w-32 bg-[#161b22] border border-slate-700 rounded-lg shadow-2xl py-1 z-50">
<button onClick={() => exportAs('png')} className="w-full text-left px-4 py-2 text-xs hover:bg-blue-600">PNG</button>
<button onClick={() => exportAs('svg')} className="w-full text-left px-4 py-2 text-xs hover:bg-blue-600 border-t border-slate-800">SVG</button>
</div>
)}
<button onClick={() => setIsFullscreen(true)} className="p-2 text-slate-400 hover:text-white"><Maximize2 size={18}/></button>
</div>
</header>
)}

<div className="flex-1 flex items-center justify-center p-8 overflow-hidden touch-none" onMouseMove={handleDrag} onMouseUp={stopDrag} onMouseDown={() => setSelectedId(null)}>
<svg ref={svgRef} viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`} className="bg-[#0d1117] shadow-2xl border border-slate-800" style={{ width: '100%', height: 'auto', maxWidth: viewBox.w }}>
{maskData && <image href={maskData} x="0" y="0" width={viewBox.w} height={viewBox.h} opacity={maskOpacity} preserveAspectRatio="xMidYMid slice" />}
{elements.map((el) => (
<g key={el.id} onMouseDown={(e) => startDrag(e, el.id)} className="cursor-move">
{el.type === 'text' ? (
<text x={el.x} y={el.y} fontSize={el.fontSize} fill={el.color} stroke={el.strokeColor} strokeWidth={el.strokeWidth} fontFamily={el.fontFamily} textAnchor="middle" dominantBaseline="middle">{el.content}</text>
) : el.type === 'svg' ? (
<svg x={el.x} y={el.y} width={el.width} height={el.height} viewBox={el.viewBox} preserveAspectRatio="xMidYMid meet" overflow="visible">
<g 
dangerouslySetInnerHTML={{ __html: el.innerContent }} 
style={{ 
fill: el.color === 'original' ? undefined : el.color, 
stroke: el.strokeColor === 'original' ? undefined : el.strokeColor, 
strokeWidth: el.strokeWidth 
}} 
/>
</svg>
) : ( <image href={el.content} x={el.x} y={el.y} width={el.width} height={el.height} /> )}
{selectedId === el.id && !isFullscreen && (
<rect className="selection-rect pointer-events-none" x={el.type === 'text' ? el.x - (el.fontSize * 1.5) : el.x} y={el.type === 'text' ? el.y - (el.fontSize / 1.5) : el.y} width={el.type === 'text' ? (el.fontSize * 3) : el.width} height={el.type === 'text' ? el.fontSize * 1.3 : el.height} fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="3" />
)}
</g>
))}
</svg>
</div>
</main>

{!isFullscreen && (
<aside className={`${rightSidebarOpen ? 'w-[320px]' : 'w-0'} bg-[#161b22] border-l border-slate-800 flex flex-col z-20 transition-all duration-300 relative`}>
<button onClick={() => setRightSidebarOpen(!rightSidebarOpen)} className="absolute top-1/2 -left-4 -translate-y-1/2 w-8 h-12 bg-[#161b22] border border-slate-800 border-r-0 rounded-l-lg flex items-center justify-center hover:bg-blue-600 z-30">
{rightSidebarOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
</button>

<div className={`${rightSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'} h-full flex flex-col overflow-hidden`}>
{selectedElement ? (
<div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
<h2 className="text-[10px] font-black uppercase text-slate-500 tracking-widest border-b border-slate-800 pb-2">Proprietà</h2>
<div className="space-y-2">
<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Ordinamento Livelli</label>
<div className="grid grid-cols-4 gap-1">
<button onClick={() => moveLayer(selectedId, 'top')} className="flex flex-col items-center justify-center p-2 bg-[#0d1117] border border-slate-700 rounded hover:bg-blue-600 transition-colors"><ArrowUp size={14} /><span className="text-[7px] mt-1 uppercase">Top</span></button>
<button onClick={() => moveLayer(selectedId, 'up')} className="flex flex-col items-center justify-center p-2 bg-[#0d1117] border border-slate-700 rounded hover:bg-blue-600 transition-colors"><ChevronUp size={14} /><span className="text-[7px] mt-1 uppercase">Sopra</span></button>
<button onClick={() => moveLayer(selectedId, 'down')} className="flex flex-col items-center justify-center p-2 bg-[#0d1117] border border-slate-700 rounded hover:bg-blue-600 transition-colors"><ChevronDown size={14} /><span className="text-[7px] mt-1 uppercase">Sotto</span></button>
<button onClick={() => moveLayer(selectedId, 'bottom')} className="flex flex-col items-center justify-center p-2 bg-[#0d1117] border border-slate-700 rounded hover:bg-blue-600 transition-colors"><ArrowDown size={14} /><span className="text-[7px] mt-1 uppercase">Base</span></button>
</div>
</div>

<div className="space-y-2">
<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Posizione (X, Y)</label>
<div className="grid grid-cols-2 gap-2">
<div className="flex items-center bg-[#0d1117] border border-slate-700 rounded px-2">
<span className="text-[9px] text-slate-500 font-bold mr-2">X</span>
<input type="number" value={selectedElement.x} onChange={e => updateElement(selectedId, {x: parseInt(e.target.value) || 0})} className="w-full bg-transparent py-1.5 text-xs text-blue-400 outline-none"/>
</div>
<div className="flex items-center bg-[#0d1117] border border-slate-700 rounded px-2">
<span className="text-[9px] text-slate-500 font-bold mr-2">Y</span>
<input type="number" value={selectedElement.y} onChange={e => updateElement(selectedId, {y: parseInt(e.target.value) || 0})} className="w-full bg-transparent py-1.5 text-xs text-blue-400 outline-none"/>
</div>
</div>
</div>

{selectedElement.type === 'text' ? (
<div className="space-y-4">
<div className="space-y-2">
<label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Font Family</label>
<select value={selectedElement.fontFamily} onChange={e => updateElement(selectedId, {fontFamily: e.target.value})} className="w-full bg-[#0d1117] border border-slate-700 rounded p-2 text-xs text-blue-400 outline-none">
<option value="sans-serif">Sans Serif</option>
{customFonts.map((f, idx) => <option key={idx} value={f.name}>{f.name}</option>)}
</select>
</div>
<div className="space-y-2">
<div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase"><label>Dimensione</label><span>{selectedElement.fontSize}px</span></div>
<input type="range" min="8" max="500" step="1" value={selectedElement.fontSize} onChange={e => updateElement(selectedId, {fontSize: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 rounded-lg appearance-none accent-blue-500"/>
</div>
<textarea value={selectedElement.content} onChange={e => updateElement(selectedId, {content: e.target.value})} className="w-full bg-[#0d1117] border border-slate-700 rounded p-2 text-xs outline-none min-h-[60px]" />
</div>
) : (
<div className="space-y-4">
<div className="space-y-2">
<div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase"><label>Scala (W)</label><span className="text-blue-400 font-mono">{selectedElement.width}px</span></div>
<input type="range" min="5" max="1500" step="1" value={selectedElement.width} onChange={e => handleProportionalScale(selectedId, parseInt(e.target.value))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none accent-blue-500" />
</div>
</div>
)}

{(selectedElement.type === 'text' || selectedElement.type === 'svg') && (
<div className="space-y-4 pt-4 border-t border-slate-800">
<div className="space-y-2">
<div className="flex justify-between items-center">
<label className="text-[10px] font-bold text-slate-500 uppercase">Colore Riempimento</label>
{selectedElement.type === 'svg' && (
<button onClick={() => updateElement(selectedId, {color: 'original'})} className={`text-[8px] px-1.5 py-0.5 rounded border ${selectedElement.color === 'original' ? 'bg-blue-600 border-blue-500' : 'border-slate-700 text-slate-500'}`}>ORIGINALE</button>
)}
</div>
<div className="flex gap-2">
<input type="color" value={selectedElement.color === 'original' ? '#000000' : selectedElement.color} onChange={e => updateElement(selectedId, {color: e.target.value})} className="h-10 w-12 bg-[#0d1117] border border-slate-700 rounded cursor-pointer"/>
<input type="text" value={selectedElement.color} onChange={e => updateElement(selectedId, {color: e.target.value})} className="flex-1 bg-[#0d1117] border border-slate-700 rounded px-2 text-xs font-mono text-blue-400 uppercase outline-none"/>
</div>
</div>
<div className="space-y-2">
<div className="flex justify-between items-center">
<label className="text-[10px] font-bold text-slate-500 uppercase">Colore Bordo</label>
{selectedElement.type === 'svg' && (
<button onClick={() => updateElement(selectedId, {strokeColor: 'original'})} className={`text-[8px] px-1.5 py-0.5 rounded border ${selectedElement.strokeColor === 'original' ? 'bg-blue-600 border-blue-500' : 'border-slate-700 text-slate-500'}`}>ORIGINALE</button>
)}
</div>
<div className="flex gap-2">
<input type="color" value={selectedElement.strokeColor === 'original' ? '#000000' : selectedElement.strokeColor} onChange={e => updateElement(selectedId, {strokeColor: e.target.value})} className="h-10 w-12 bg-[#0d1117] border border-slate-700 rounded cursor-pointer"/>
<input type="text" value={selectedElement.strokeColor} onChange={e => updateElement(selectedId, {strokeColor: e.target.value})} className="flex-1 bg-[#0d1117] border border-slate-700 rounded px-2 text-xs font-mono text-blue-400 uppercase outline-none"/>
</div>
</div>
<div className="space-y-2">
<div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase"><label>Spessore Bordo</label><span>{selectedElement.strokeWidth}px</span></div>
<input type="range" min="0" max="20" step="0.5" value={selectedElement.strokeWidth} onChange={e => updateElement(selectedId, {strokeWidth: parseFloat(e.target.value)})} className="w-full h-1 bg-slate-800 rounded-lg appearance-none accent-blue-500"/>
</div>
</div>
)}
<button onClick={() => { setElements(elements.filter(e => e.id !== selectedId)); setSelectedId(null); }} className="w-full py-2 bg-red-900/20 text-red-500 rounded text-xs font-bold hover:bg-red-900/40 transition-colors flex items-center justify-center gap-2 uppercase tracking-widest"><Trash2 size={14}/> Elimina Elemento</button>
</div>
) : (
<div className="p-6 space-y-6">
<h2 className="text-[10px] font-black uppercase text-slate-500 tracking-widest border-b border-slate-800 pb-2">Canvas</h2>
<div className="grid grid-cols-2 gap-4">
<div className="space-y-1"><label className="text-[9px] text-slate-500 font-bold uppercase">W</label><input type="number" value={viewBox.w} onChange={e => setViewBox({...viewBox, w: parseInt(e.target.value) || 800})} className="w-full bg-[#0d1117] border border-slate-700 rounded p-2 text-xs text-blue-400 outline-none"/></div>
<div className="space-y-1"><label className="text-[9px] text-slate-500 font-bold uppercase">H</label><input type="number" value={viewBox.h} onChange={e => setViewBox({...viewBox, h: parseInt(e.target.value) || 450})} className="w-full bg-[#0d1117] border border-slate-700 rounded p-2 text-xs text-blue-400 outline-none"/></div>
</div>
<div className="space-y-2 pt-4 border-t border-slate-800">
<div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase"><label>Opacità Maschera</label><span>{Math.round(maskOpacity * 100)}%</span></div>
<input type="range" min="0" max="1" step="0.01" value={maskOpacity} onChange={e => setMaskOpacity(parseFloat(e.target.value))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none accent-blue-500" />
</div>
</div>
)}
</div>
</aside>
)}

<style>{`
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #30363d; border-radius: 10px; }
input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; background: #3b82f6; border-radius: 50%; cursor: pointer; }
.svg-preview-container svg { width: 100% !important; height: 100% !important; display: block; }
`}</style>
</div>
);
};

export default App;

