import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  Upload, 
  Type, 
  Download, 
  Trash2, 
  Layers, 
  MoveUp, 
  MoveDown, 
  Copy,
  Plus,
  X,
  Image as ImageIcon,
  Type as TypeIcon,
  MousePointer2,
  Settings2,
  ChevronDown,
  Save,
  FolderOpen,
  Maximize2,
  Minimize2
} from 'lucide-react';

const App = () => {
  const [elements, setElements] = useState([]);
  const [maskData, setMaskData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [assetLibrary, setAssetLibrary] = useState([]);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 800, h: 450 });
  const [customFonts, setCustomFonts] = useState([]);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const svgRef = useRef(null);
  const fileInputRef = useRef(null);
  const maskInputRef = useRef(null);
  const assetInputRef = useRef(null);
  const fontInputRef = useRef(null);
  const dragInfo = useRef({ active: false, id: null, offset: { x: 0, y: 0 } });

  const removeMask = () => setMaskData(null);
  const removeAsset = (id) => setAssetLibrary(prev => prev.filter(a => a.id !== id));

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const fontStyles = useMemo(() => {
    return customFonts.map(f => `
      @font-face {
        font-family: '${f.name}';
        src: url('${f.url}') format('truetype');
      }
    `).join('\n');
  }, [customFonts]);

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

  const exportProject = () => {
    try {
      const projectData = { 
        elements, 
        maskData, 
        assetLibrary, 
        viewBox, 
        customFonts,
        version: "1.1" 
      };
      const jsonString = JSON.stringify(projectData);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `designer_project_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Errore durante il salvataggio:", err);
    }
  };

  const processSvgString = (svgString) => {
    if (!svgString || typeof svgString !== 'string') return '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) return svgString;
    
    svgEl.removeAttribute('width');
    svgEl.removeAttribute('height');
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svgEl.setAttribute('width', '100%');
    svgEl.setAttribute('height', '100%');
    
    return svgEl.outerHTML;
  };

  const importProject = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        const sanitizedElements = (data.elements || []).map(el => {
          if (el.type === 'svg') {
            return { ...el, content: processSvgString(el.content) };
          }
          return el;
        });
        const sanitizedLibrary = (data.assetLibrary || []).map(asset => {
          if (asset.type === 'svg') {
            return { ...asset, content: processSvgString(asset.content) };
          }
          return asset;
        });
        setElements(sanitizedElements);
        setAssetLibrary(sanitizedLibrary);
        setCustomFonts(data.customFonts || []);
        setViewBox(data.viewBox || { x: 0, y: 0, w: 800, h: 450 });
        setMaskData(data.maskData || null);
        setSelectedId(null);
      } catch (err) {
        console.error("Errore importazione JSON:", err);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const handleMaskUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type === 'image/svg+xml') {
      const text = await file.text();
      const processed = processSvgString(text);
      setMaskData({ type: 'svg', content: processed });
    } else {
      const base64 = await fileToBase64(file);
      setMaskData({ type: 'raster', content: base64 });
    }
  };

  const addText = () => {
    const newText = {
      id: crypto.randomUUID(),
      type: 'text',
      name: 'Nuovo Testo',
      x: viewBox.x + viewBox.w / 2,
      y: viewBox.y + viewBox.h / 2,
      content: 'TESTO',
      fontSize: 40,
      color: '#ffffff',
      strokeColor: 'none',
      strokeWidth: 0,
      fontFamily: 'sans-serif',
      fontWeight: 'bold'
    };
    setElements([...elements, newText]);
    setSelectedId(newText.id);
  };

  const getMousePos = (e) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return { x: (e.clientX - CTM.e) / CTM.a, y: (e.clientY - CTM.f) / CTM.d };
  };

  const handleElementMouseDown = (e, id) => {
    e.stopPropagation();
    if (isFullscreen) return;
    const pos = getMousePos(e);
    const el = elements.find(item => item.id === id);
    if (!el) return;
    dragInfo.current = { active: true, id, offset: { x: pos.x - el.x, y: pos.y - el.y } };
    setSelectedId(id);
  };

  const onDrag = useCallback((e) => {
    if (!dragInfo.current.active) return;
    const pos = getMousePos(e);
    setElements(prev => prev.map(el => 
      el.id === dragInfo.current.id 
        ? { ...el, x: pos.x - dragInfo.current.offset.x, y: pos.y - dragInfo.current.offset.y } 
        : el
    ));
  }, []);

  // Nuova funzione di esportazione robusta
  const exportAs = async (format) => {
    const svg = svgRef.current;
    if (!svg) return;

    // Crea un clone dell'SVG per manipolarlo senza influenzare la UI
    const clonedSvg = svg.cloneNode(true);
    
    // Rimuove i rettangoli di selezione
    clonedSvg.querySelectorAll('rect[stroke="#3b82f6"]').forEach(r => r.remove());

    // Incorpora i font nel clone
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = fontStyles;
    clonedSvg.prepend(style);

    // Forza dimensioni esplicite per il rendering su canvas
    clonedSvg.setAttribute('width', viewBox.w);
    clonedSvg.setAttribute('height', viewBox.h);

    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(clonedSvg);
    
    // Fix per assicurare che il namespace sia presente
    if (!svgString.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }

    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    
    if (format === 'svg') {
      const link = document.createElement("a");
      link.href = url;
      link.download = `design_${Date.now()}.svg`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const img = new Image();
      // Cruciale per evitare Tainted Canvas se ci sono immagini incorporate
      img.crossOrigin = "anonymous"; 
      
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        
        canvas.width = viewBox.w;
        canvas.height = viewBox.h;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        try {
          ctx.drawImage(img, 0, 0, viewBox.w, viewBox.h);
          const pngUrl = canvas.toDataURL("image/png");
          const downloadLink = document.createElement("a");
          downloadLink.href = pngUrl;
          downloadLink.download = `design_${Date.now()}.png`;
          downloadLink.click();
        } catch (e) {
          console.error("Fallimento esportazione PNG:", e);
          alert("Impossibile generare il PNG. Assicurati che non ci siano immagini da siti esterni caricate.");
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      
      img.onerror = () => {
          console.error("L'immagine SVG non è valida per la conversione PNG.");
          URL.revokeObjectURL(url);
      };
      
      img.src = url;
    }
    setIsExportOpen(false);
  };

  const updateElement = (id, updates) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const selectedElement = elements.find(el => el.id === selectedId);

  return (
    <div className="flex h-screen bg-[#0a0c10] text-slate-100 overflow-hidden font-sans">
      <style dangerouslySetInnerHTML={{ __html: fontStyles }} />
      
      {!isFullscreen && (
        <aside className="w-[280px] bg-[#161b22] border-r border-slate-800 flex flex-col z-20 shadow-2xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-[#1c2128]">
            <h1 className="text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center gap-2">
              <Layers size={14}/> Designer
            </h1>
            <div className="flex gap-2">
              <label className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-md cursor-pointer transition-all">
                <FolderOpen size={18} />
                <input ref={fileInputRef} type="file" className="hidden" accept=".json" onChange={importProject} />
              </label>
              <button onClick={exportProject} className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-md transition-all">
                <Save size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-8 custom-scrollbar">
            <section className="space-y-3">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Sfondo / Maschera</label>
              {!maskData ? (
                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-800 rounded-2xl hover:bg-slate-800/50 hover:border-blue-500/50 cursor-pointer transition-all group">
                  <Upload size={24} className="text-slate-600 group-hover:text-blue-400 mb-2" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Carica Immagine</span>
                  <input ref={maskInputRef} type="file" className="hidden" accept=".svg,.png,.jpg" onChange={handleMaskUpload} />
                </label>
              ) : (
                <div className="relative group rounded-xl overflow-hidden border border-slate-700 bg-black aspect-video">
                  {maskData.type === 'svg' ? (
                    <div className="w-full h-full flex items-center justify-center" dangerouslySetInnerHTML={{ __html: maskData.content }} />
                  ) : (
                    <img src={maskData.content} className="w-full h-full object-contain" alt="Maschera" />
                  )}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <button onClick={removeMask} className="bg-red-600 text-white p-2 rounded-full shadow-xl hover:scale-110 transition-transform">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Media ({assetLibrary.length})</label>
                <label className="p-1 bg-blue-500/10 text-blue-400 rounded cursor-pointer hover:bg-blue-500/20">
                  <Plus size={14} />
                  <input ref={assetInputRef} type="file" className="hidden" accept=".svg,.png,.jpg" multiple onChange={async (e) => {
                    const files = Array.from(e.target.files);
                    for (const file of files) {
                      const base64 = await fileToBase64(file);
                      let content = base64;
                      let type = file.type === 'image/svg+xml' ? 'svg' : 'raster';
                      if (type === 'svg') {
                        const text = await file.text();
                        content = processSvgString(text);
                      }
                      setAssetLibrary(prev => [...prev, { id: crypto.randomUUID(), type, content, name: file.name }]);
                    }
                    e.target.value = '';
                  }} />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {assetLibrary.map(asset => (
                  <div key={asset.id} className="relative group aspect-square bg-[#0d1117] border border-slate-800 rounded-lg p-1.5 hover:border-blue-500 transition-colors shadow-inner overflow-hidden flex items-center justify-center">
                    {asset.type === 'svg' ? (
                       <div className="w-full h-full flex items-center justify-center pointer-events-none overflow-hidden" dangerouslySetInnerHTML={{ __html: asset.content }} />
                    ) : (
                       <img src={asset.content} className="w-full h-full object-contain pointer-events-none" alt="" />
                    )}
                    <div className="absolute inset-0 cursor-pointer" onClick={() => setElements([...elements, { id: crypto.randomUUID(), type: asset.type, content: asset.content, x: viewBox.x + 50, y: viewBox.y + 50, width: 100, height: 100, name: asset.name, color: asset.type === 'svg' ? 'currentColor' : undefined, strokeColor: asset.type === 'svg' ? 'none' : undefined, strokeWidth: asset.type === 'svg' ? 0 : undefined }])} />
                    <button onClick={() => removeAsset(asset.id)} className="absolute top-0 right-0 p-1 bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-bl z-10">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Livelli</label>
              <div className="space-y-2">
                {[...elements].reverse().map(el => (
                  <div key={el.id} onClick={() => setSelectedId(el.id)} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer border transition-all ${selectedId === el.id ? 'bg-blue-600 border-blue-400' : 'bg-[#0d1117] border-slate-800 hover:bg-slate-800 shadow-sm'}`}>
                    {el.type === 'text' ? <TypeIcon size={14} className="text-amber-400"/> : <ImageIcon size={14} className="text-blue-400"/>}
                    <span className="text-[11px] truncate flex-1 font-semibold">{el.name || el.content}</span>
                    <button onClick={(e) => { e.stopPropagation(); setElements(elements.filter(i => i.id !== el.id)); }} className="text-slate-500 hover:text-white"><X size={14}/></button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </aside>
      )}

      <main className={`flex-1 flex flex-col relative transition-all duration-300 ${isFullscreen ? 'bg-black' : 'bg-[#010409]'}`}>
        {!isFullscreen && (
          <header className="h-16 bg-[#161b22]/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-8 z-30 shadow-sm">
            <button onClick={addText} className="flex items-center gap-2 px-4 py-2 bg-[#21262d] border border-slate-700 text-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-[#30363d] transition-all shadow-sm active:scale-95">
              <Type size={14} className="text-blue-400" /> Testo
            </button>
            <div className="flex items-center gap-4">
              <div className="relative">
                <button onClick={() => setIsExportOpen(!isExportOpen)} className="flex items-center gap-2 px-5 py-2.5 bg-[#21262d] border border-slate-700 rounded-xl text-[11px] font-bold hover:bg-[#30363d] transition-colors">
                  ESPORTA <ChevronDown size={14} />
                </button>
                {isExportOpen && (
                  <div className="absolute right-0 mt-3 w-44 bg-[#161b22] border border-slate-700 rounded-2xl shadow-2xl py-2 z-50 overflow-hidden ring-1 ring-black">
                    <button onClick={() => exportAs('png')} className="w-full text-left px-5 py-3 text-[11px] hover:bg-blue-600 font-bold uppercase transition-colors">PNG</button>
                    <button onClick={() => exportAs('svg')} className="w-full text-left px-5 py-3 text-[11px] hover:bg-blue-600 font-bold border-t border-slate-800 uppercase transition-colors">SVG</button>
                  </div>
                )}
              </div>
              <button onClick={() => setIsFullscreen(true)} className="p-3 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-lg">
                <Maximize2 size={20} />
              </button>
            </div>
          </header>
        )}

        <div className="flex-1 flex items-center justify-center p-4 overflow-hidden select-none" onMouseMove={onDrag} onMouseUp={() => { dragInfo.current.active = false; }} onMouseDown={() => setSelectedId(null)}>
          <div className="w-full h-full flex items-center justify-center relative">
            <svg
              ref={svgRef}
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
              style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%', aspectRatio: `${viewBox.w} / ${viewBox.h}`, boxShadow: isFullscreen ? 'none' : '0 25px 100px -12px rgba(0, 0, 0, 0.7)' }}
              className="block bg-black transition-all duration-300"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g className="mask-layer">
                {maskData && (maskData.type === 'svg' ? <g dangerouslySetInnerHTML={{ __html: maskData.content }} /> : <image href={maskData.content} width={viewBox.w} height={viewBox.h} x={viewBox.x} y={viewBox.y} preserveAspectRatio="xMidYMid slice" />)}
              </g>

              <g className="elements-layer">
                {elements.map((el) => {
                    const isSvg = el.type === 'svg';
                    const isText = el.type === 'text';
                    const fillColor = el.color === 'none' ? 'none' : el.color;
                    return (
                        <g key={el.id} onMouseDown={(e) => handleElementMouseDown(e, el.id)} className={isFullscreen ? 'pointer-events-none' : 'cursor-move'}>
                        {isText ? (
                            <text x={el.x} y={el.y} fontSize={el.fontSize} fill={fillColor} stroke={el.strokeColor} strokeWidth={el.strokeWidth} fontFamily={el.fontFamily} fontWeight={el.fontWeight} textAnchor="middle" dominantBaseline="middle" className={el.color === 'none' && el.strokeColor === 'none' ? 'opacity-20' : ''} style={el.color === 'none' && el.strokeColor === 'none' ? { stroke: '#3b82f6', strokeWidth: 0.5, strokeDasharray: '2,2' } : {}}>{el.content}</text>
                        ) : isSvg ? (
                            <g transform={`translate(${el.x}, ${el.y})`}>
                                <g style={{ color: (fillColor === 'currentColor' || !fillColor) ? 'inherit' : fillColor }} dangerouslySetInnerHTML={{ 
                                    __html: processSvgString(
                                        (fillColor === 'currentColor' || !fillColor) ? el.content : el.content.replace(/fill="[^"]*"/g, `fill="${fillColor}"`).replace(/stroke="[^"]*"/g, `stroke="${el.strokeColor}"`).replace(/stroke-width="[^"]*"/g, `stroke-width="${el.strokeWidth}"`)
                                    ).replace('<svg', `<svg width="${el.width}" height="${el.height}"`)
                                }} />
                            </g>
                        ) : (
                            <image href={el.content} x={el.x} y={el.y} width={el.width} height={el.height} />
                        )}
                        {!isFullscreen && selectedId === el.id && (
                            <rect x={isText ? el.x - (el.content.length * el.fontSize/4) : el.x} y={isText ? el.y - el.fontSize/2 : el.y} width={isText ? (el.content.length * el.fontSize/2) : el.width} height={isText ? el.fontSize : el.height} fill="none" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4,2" />
                        )}
                        </g>
                    );
                })}
              </g>
            </svg>
          </div>
        </div>
      </main>

      {!isFullscreen && (
        <aside className="w-[320px] bg-[#161b22] border-l border-slate-800 flex flex-col z-20 shadow-2xl">
          <div className="p-4 border-b border-slate-800 bg-[#1c2128]">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Proprietà</h2>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-2 custom-scrollbar">
            {selectedElement ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
                <div className="flex gap-2">
                  <button title="Sposta su" onClick={() => { const idx = elements.findIndex(e => e.id === selectedId); if (idx < elements.length - 1) { const copy = [...elements]; [copy[idx], copy[idx+1]] = [copy[idx+1], copy[idx]]; setElements(copy); } }} className="flex-1 p-3 bg-[#21262d] rounded-xl hover:bg-slate-700 transition-colors"><MoveUp size={16} className="mx-auto"/></button>
                  <button title="Sposta giù" onClick={() => { const idx = elements.findIndex(e => e.id === selectedId); if (idx > 0) { const copy = [...elements]; [copy[idx], copy[idx-1]] = [copy[idx-1], copy[idx]]; setElements(copy); } }} className="flex-1 p-3 bg-[#21262d] rounded-xl hover:bg-slate-700 transition-colors"><MoveDown size={16} className="mx-auto"/></button>
                  <button title="Copia" onClick={() => { const newEl = {...selectedElement, id: crypto.randomUUID(), x: selectedElement.x + 20, y: selectedElement.y + 20}; setElements([...elements, newEl]); setSelectedId(newEl.id); }} className="flex-1 p-3 bg-[#21262d] rounded-xl hover:bg-slate-700 text-blue-400 transition-colors"><Copy size={16} className="mx-auto"/></button>
                  <button title="Elimina" onClick={() => { setElements(elements.filter(e => e.id !== selectedId)); setSelectedId(null); }} className="flex-1 p-3 bg-red-900/10 text-red-500 rounded-xl hover:bg-red-900/30 transition-colors"><Trash2 size={16} className="mx-auto"/></button>
                </div>

                <div className="space-y-5">
                  {selectedElement.type === 'text' ? (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Testo</label>
                        <textarea value={selectedElement.content} onChange={e => updateElement(selectedId, {content: e.target.value})} className="w-full bg-[#0d1117] border border-slate-700 rounded-xl p-3 text-[13px] outline-none focus:border-blue-500 transition-colors" rows={3} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Font</label>
                        <select value={selectedElement.fontFamily} onChange={e => updateElement(selectedId, {fontFamily: e.target.value})} className="w-full bg-[#0d1117] border border-slate-700 rounded-xl p-3 text-[12px] outline-none">
                          <option value="sans-serif">Sans Serif</option>
                          <option value="serif">Serif</option>
                          <option value="monospace">Monospace</option>
                          {customFonts.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between"><label className="text-[10px] font-black text-slate-500 uppercase">Dimensione</label><span className="text-blue-400 font-mono text-[11px]">{selectedElement.fontSize}px</span></div>
                        <input type="range" min="8" max="400" value={selectedElement.fontSize} onChange={e => updateElement(selectedId, {fontSize: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 rounded appearance-none accent-blue-500" />
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex justify-between"><label className="text-[10px] font-black text-slate-500 uppercase">Scala</label><span className="text-blue-400 font-mono text-[11px]">{selectedElement.width}px</span></div>
                      <input type="range" min="10" max="1500" value={selectedElement.width} onChange={e => { const val = parseInt(e.target.value); updateElement(selectedId, {width: val, height: val}); }} className="w-full h-1 bg-slate-800 rounded appearance-none accent-blue-500" />
                    </div>
                  )}

                  {(selectedElement.type === 'svg' || selectedElement.type === 'text') && (
                    <div className="pt-2 space-y-4 border-t border-slate-800">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500" /> Riempimento</label>
                        <div className="flex gap-2">
                          <input type="color" value={(selectedElement.color === 'none' || selectedElement.color === 'currentColor') ? '#000000' : (selectedElement.color || '#ffffff')} onChange={e => updateElement(selectedId, {color: e.target.value})} className="w-12 h-10 bg-transparent cursor-pointer rounded border border-slate-700" />
                          <input type="text" value={(selectedElement.color || '#ffffff').toUpperCase()} onChange={e => updateElement(selectedId, {color: e.target.value})} className="flex-1 bg-[#0d1117] border border-slate-700 rounded-xl px-4 text-[12px] font-mono text-blue-400 uppercase" />
                          <div className="flex flex-col gap-1">
                            <button onClick={() => updateElement(selectedId, {color: 'none'})} className={`px-2 py-1 rounded border border-slate-700 text-[9px] ${selectedElement.color === 'none' ? 'bg-blue-600 text-white border-blue-500' : 'text-slate-500'}`}>NONE</button>
                            {selectedElement.type === 'svg' && <button onClick={() => updateElement(selectedId, {color: 'currentColor'})} className={`px-2 py-1 rounded border border-slate-700 text-[9px] ${selectedElement.color === 'currentColor' || !selectedElement.color ? 'bg-blue-600 text-white border-blue-500' : 'text-slate-500'}`}>ORIG.</button>}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><div className="w-2 h-2 rounded-full border border-blue-500" /> Bordo (Tratto)</label>
                        <div className="flex gap-2">
                          <input type="color" value={selectedElement.strokeColor === 'none' ? '#000000' : (selectedElement.strokeColor || '#ffffff')} onChange={e => updateElement(selectedId, {strokeColor: e.target.value})} className="w-12 h-10 bg-transparent cursor-pointer rounded border border-slate-700" />
                          <input type="text" value={(selectedElement.strokeColor || 'NONE').toUpperCase()} onChange={e => updateElement(selectedId, {strokeColor: e.target.value})} className="flex-1 bg-[#0d1117] border border-slate-700 rounded-xl px-4 text-[12px] font-mono text-blue-400 uppercase" />
                          <button onClick={() => updateElement(selectedId, {strokeColor: 'none'})} className={`px-2 rounded-lg border border-slate-700 text-[10px] ${selectedElement.strokeColor === 'none' ? 'bg-blue-600 text-white border-blue-500' : 'text-slate-500'}`}>NONE</button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between"><label className="text-[10px] font-black text-slate-500 uppercase">Spessore Bordo</label><span className="text-blue-400 font-mono text-[11px]">{selectedElement.strokeWidth}px</span></div>
                        <input type="range" min="0" max="20" step="0.5" value={selectedElement.strokeWidth || 0} onChange={e => updateElement(selectedId, {strokeWidth: parseFloat(e.target.value)})} className="w-full h-1 bg-slate-800 rounded appearance-none accent-blue-500" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-slate-700 opacity-20">
                <MousePointer2 size={48} />
                <p className="text-[10px] font-black uppercase mt-4">Seleziona un oggetto</p>
              </div>
            )}
          </div>
          
          <div className="p-3 border-t border-slate-800 bg-[#0d1117]">
            <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Carica Font (.ttf)</span>
                <Plus size={14} className="text-blue-500" />
                <input ref={fontInputRef} type="file" className="hidden" accept=".ttf" onChange={async (e) => {
                  const file = e.target.files[0]; if (!file) return;
                  const name = file.name.split('.')[0].replace(/[^a-zA-Z]/g, '');
                  const url = await fileToBase64(file);
                  setCustomFonts(prev => [...prev, { name, url }]);
                  e.target.value = '';
                }} />
            </label>
          </div>
        </aside>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #30363d; border-radius: 4px; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; background: #3b82f6; border-radius: 50%; cursor: pointer; }
      `}</style>
    </div>
  );
};

export default App;
