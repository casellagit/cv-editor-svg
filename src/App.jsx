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
  Image as ImageIcon
} from 'lucide-react';

const App = () => {
  const [elements, setElements] = useState([]);
  const [maskData, setMaskData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [assetLibrary, setAssetLibrary] = useState([]);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 800, h: 450 });
  const [customFonts, setCustomFonts] = useState([]);

  const svgRef = useRef(null);
  const dragInfo = useRef({ active: false, id: null, offset: { x: 0, y: 0 } });

  // --- Font Face Injection ---
  // Genera dinamicamente i font nel documento per la preview immediata
  const fontStyles = useMemo(() => {
    return customFonts.map(f => `
      @font-face {
        font-family: '${f.name}';
        src: url('${f.url}') format('truetype');
      }
    `).join('\n');
  }, [customFonts]);

  // --- SVG Style Scoping ---
  const sanitizeSvgStyles = (svgContent, prefix) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const svgEl = doc.querySelector('svg');
    if (!svgEl) return svgContent;

    const styles = doc.querySelectorAll('style');
    styles.forEach(styleTag => {
      let cssText = styleTag.textContent;
      const classRegex = /\.([a-zA-Z0-9_-]+)/g;
      const classMap = {};
      cssText = cssText.replace(classRegex, (match, className) => {
        const newClassName = `${prefix}-${className}`;
        classMap[className] = newClassName;
        return `.${newClassName}`;
      });
      styleTag.textContent = cssText;

      Object.keys(classMap).forEach(oldClass => {
        const elementsWithClass = doc.querySelectorAll(`[class*="${oldClass}"]`);
        elementsWithClass.forEach(el => {
          const classes = (el.getAttribute('class') || '').split(' ');
          const updatedClasses = classes.map(c => c === oldClass ? classMap[oldClass] : c);
          el.setAttribute('class', updatedClasses.join(' '));
        });
      });
    });

    return svgEl.innerHTML;
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

  const handleFontUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fontName = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '-');
    const base64 = await fileToBase64(file);
    setCustomFonts(prev => [...prev, { name: fontName, url: base64 }]);
  };

  const handleMaskUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type === 'image/svg+xml') {
      const text = await file.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'image/svg+xml');
      const svgEl = doc.querySelector('svg');
      if (svgEl) {
        const vb = svgEl.getAttribute('viewBox')?.split(/\s+|,/).map(Number) || [0, 0, 800, 450];
        setViewBox({ x: vb[0], y: vb[1], w: vb[2], h: vb[3] });
        const scopedContent = sanitizeSvgStyles(text, `mask-${crypto.randomUUID().slice(0, 4)}`);
        setMaskData({ type: 'svg', content: scopedContent });
      }
    } else {
      const base64 = await fileToBase64(file);
      const img = new Image();
      img.onload = () => {
        setViewBox({ x: 0, y: 0, w: img.width, h: img.height });
        setMaskData({ type: 'raster', content: base64 });
      };
      img.src = base64;
    }
  };

  const handleAssetUpload = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const prefix = `icon-${crypto.randomUUID().slice(0, 8)}`;
      if (file.type === 'image/svg+xml') {
        const text = await file.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'image/svg+xml');
        const svgEl = doc.querySelector('svg');
        if (svgEl) {
          const scopedContent = sanitizeSvgStyles(text, prefix);
          setAssetLibrary(prev => [...prev, { 
            id: crypto.randomUUID(), 
            type: 'svg',
            content: scopedContent, 
            viewBox: svgEl.getAttribute('viewBox') || "0 0 100 100", 
            name: file.name 
          }]);
        }
      } else {
        const base64 = await fileToBase64(file);
        setAssetLibrary(prev => [...prev, { 
          id: crypto.randomUUID(), 
          type: 'raster',
          content: base64, 
          name: file.name 
        }]);
      }
    }
  };

  const addAssetToCanvas = (asset) => {
    const newEl = {
      id: crypto.randomUUID(),
      type: asset.type,
      content: asset.content,
      x: viewBox.x + viewBox.w / 2 - 50,
      y: viewBox.y + viewBox.h / 2 - 50,
      width: 100,
      height: 100,
      ...(asset.type === 'svg' ? { viewBox: asset.viewBox, color: null } : {})
    };
    setElements([...elements, newEl]);
    setSelectedId(newEl.id);
  };

  const addText = () => {
    const newText = {
      id: crypto.randomUUID(),
      type: 'text',
      x: viewBox.x + viewBox.w / 2,
      y: viewBox.y + viewBox.h / 2,
      content: 'Nuovo Testo',
      fontSize: 32,
      color: '#ffffff',
      fontFamily: 'sans-serif',
      fontWeight: 'bold'
    };
    setElements([...elements, newText]);
    setSelectedId(newText.id);
  };

  const exportPNG = () => {
    const svg = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    canvas.width = viewBox.w;
    canvas.height = viewBox.h;

    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = "design.png";
      downloadLink.click();
    };
    img.src = url;
  };

  const getMousePos = (e) => {
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    const touch = e.touches ? e.touches[0] : e;
    return {
      x: (touch.clientX - CTM.e) / CTM.a,
      y: (touch.clientY - CTM.f) / CTM.d
    };
  };

  const startDrag = (e, id) => {
    e.stopPropagation();
    const pos = getMousePos(e);
    const el = elements.find(item => item.id === id);
    if (!el) return;
    dragInfo.current = {
      active: true,
      id,
      offset: { x: pos.x - el.x, y: pos.y - el.y }
    };
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

  const endDrag = () => {
    dragInfo.current.active = false;
  };

  const selectedElement = elements.find(el => el.id === selectedId);

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden font-sans">
      <style dangerouslySetInnerHTML={{ __html: fontStyles }} />
      
      {/* Sidebar */}
      <aside className="w-72 bg-slate-800 border-r border-slate-700 flex flex-col">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <h1 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" /> Editor
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <section>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-widest">Base Display</label>
            <label className="flex flex-col items-center justify-center w-full h-16 border border-dashed border-slate-600 rounded-lg cursor-pointer hover:bg-slate-750 transition-all">
              <Upload size={16} className="mb-1 text-slate-400" />
              <span className="text-[10px]">Carica Maschera</span>
              <input type="file" className="hidden" accept=".svg,.png,.jpg" onChange={handleMaskUpload} />
            </label>
          </section>

          <section>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Icone & PNG</label>
              <label className="cursor-pointer hover:text-blue-400">
                <Plus size={16} />
                <input type="file" className="hidden" accept=".svg,.png,.jpg" multiple onChange={handleAssetUpload} />
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {assetLibrary.map(asset => (
                <button 
                  key={asset.id}
                  onClick={() => addAssetToCanvas(asset)}
                  className="aspect-square bg-slate-900 border border-slate-700 rounded p-1 hover:border-blue-500 overflow-hidden"
                >
                  {asset.type === 'svg' ? (
                    <svg viewBox={asset.viewBox} className="w-full h-full pointer-events-none fill-current" dangerouslySetInnerHTML={{ __html: asset.content }} />
                  ) : (
                    <img src={asset.content} className="w-full h-full object-contain pointer-events-none" alt="" />
                  )}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Font (.ttf)</label>
              <label className="cursor-pointer hover:text-blue-400">
                <Plus size={16} />
                <input type="file" className="hidden" accept=".ttf,.otf" onChange={handleFontUpload} />
              </label>
            </div>
            <div className="space-y-1">
              {customFonts.map(f => (
                <div key={f.name} className="text-[10px] bg-slate-750 p-2 rounded flex items-center justify-between">
                  <span style={{ fontFamily: f.name }}>{f.name}</span>
                  <button onClick={() => setCustomFonts(customFonts.filter(item => item.name !== f.name))}><Trash2 size={10}/></button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>

      {/* Canvas */}
      <main className="flex-1 flex flex-col bg-slate-950 relative" onMouseMove={onDrag} onMouseUp={endDrag} onMouseLeave={endDrag}>
        <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-10">
          <button onClick={addText} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded text-xs hover:bg-slate-700 transition-colors">
            <Type size={14} /> Aggiungi Testo
          </button>
          <div className="flex gap-2">
            <button onClick={exportPNG} className="px-4 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs hover:bg-slate-700">Scarica PNG</button>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center p-8 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]">
          <div className="bg-black shadow-2xl relative" style={{ width: 'fit-content' }}>
            <svg
              ref={svgRef}
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
              width={viewBox.w}
              height={viewBox.h}
              className="max-w-full max-h-[80vh] block"
              xmlns="http://www.w3.org/2000/svg"
              onClick={() => setSelectedId(null)}
            >
              {maskData && (
                maskData.type === 'svg' ? (
                  <g dangerouslySetInnerHTML={{ __html: maskData.content }} />
                ) : (
                  <image href={maskData.content} width={viewBox.w} height={viewBox.h} x={viewBox.x} y={viewBox.y} />
                )
              )}

              {elements.map((el) => (
                <g key={el.id} onMouseDown={(e) => startDrag(e, el.id)} className="cursor-move">
                  {/* Hit Area Trasparente */}
                  <rect 
                    x={el.type === 'text' ? el.x - (el.fontSize * 2) : el.x} 
                    y={el.type === 'text' ? el.y - el.fontSize : el.y} 
                    width={el.type === 'text' ? el.fontSize * 4 : el.width} 
                    height={el.type === 'text' ? el.fontSize * 2 : el.height} 
                    fill="transparent"
                    pointerEvents="all"
                  />

                  {el.type === 'text' && (
                    <text 
                      x={el.x} y={el.y} 
                      fontSize={el.fontSize} 
                      fill={el.color} 
                      fontFamily={el.fontFamily} 
                      fontWeight={el.fontWeight} 
                      textAnchor="middle" 
                      dominantBaseline="middle" 
                      pointerEvents="none"
                      style={{ userSelect: 'none' }}
                    >
                      {el.content}
                    </text>
                  )}
                  {el.type === 'svg' && (
                    <svg x={el.x} y={el.y} width={el.width} height={el.height} viewBox={el.viewBox} className="overflow-visible" pointerEvents="none">
                       <g fill={el.color || undefined} dangerouslySetInnerHTML={{ __html: el.content }} />
                    </svg>
                  )}
                  {el.type === 'raster' && (
                    <image href={el.content} x={el.x} y={el.y} width={el.width} height={el.height} pointerEvents="none" />
                  )}
                  
                  {selectedId === el.id && (
                    <rect 
                      x={el.type === 'text' ? el.x - (el.fontSize * 2) : el.x} 
                      y={el.type === 'text' ? el.y - el.fontSize : el.y} 
                      width={el.type === 'text' ? el.fontSize * 4 : el.width} 
                      height={el.type === 'text' ? el.fontSize * 2 : el.height} 
                      fill="none" stroke="#3b82f6" strokeWidth={1} strokeDasharray="4" 
                    />
                  )}
                </g>
              ))}
            </svg>
          </div>
        </div>
      </main>

      {/* Property Panel */}
      {selectedId && selectedElement && (
        <aside className="w-72 bg-slate-800 border-l border-slate-700 p-5 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Proprietà</h2>
            <button onClick={() => setSelectedId(null)} className="text-slate-500 hover:text-white"><X size={16}/></button>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-4 gap-2">
               <button title="Sposta Su" onClick={() => {
                 const idx = elements.findIndex(e => e.id === selectedId);
                 if (idx < elements.length - 1) {
                   const newArr = [...elements];
                   [newArr[idx], newArr[idx+1]] = [newArr[idx+1], newArr[idx]];
                   setElements(newArr);
                 }
               }} className="bg-slate-700 p-2 rounded hover:bg-slate-600 flex justify-center"><MoveUp size={14}/></button>
               <button title="Sposta Giù" onClick={() => {
                 const idx = elements.findIndex(e => e.id === selectedId);
                 if (idx > 0) {
                   const newArr = [...elements];
                   [newArr[idx], newArr[idx-1]] = [newArr[idx-1], newArr[idx]];
                   setElements(newArr);
                 }
               }} className="bg-slate-700 p-2 rounded hover:bg-slate-600 flex justify-center"><MoveDown size={14}/></button>
               <button title="Duplica" onClick={() => {
                 const newEl = {...selectedElement, id: crypto.randomUUID(), x: selectedElement.x + 20, y: selectedElement.y + 20};
                 setElements([...elements, newEl]);
                 setSelectedId(newEl.id);
               }} className="bg-slate-700 p-2 rounded hover:bg-slate-600 flex justify-center"><Copy size={14}/></button>
               <button title="Elimina" onClick={() => setElements(elements.filter(e => e.id !== selectedId))} className="bg-red-900/40 text-red-400 p-2 rounded hover:bg-red-900/60 flex justify-center"><Trash2 size={14}/></button>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-700">
               {selectedElement.type === 'text' && (
                 <>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-tighter">Contenuto Testo</label>
                    <input type="text" value={selectedElement.content} onChange={e => setElements(prev => prev.map(el => el.id === selectedId ? {...el, content: e.target.value} : el))} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-tighter">Font</label>
                    <select 
                      value={selectedElement.fontFamily} 
                      onChange={e => setElements(prev => prev.map(el => el.id === selectedId ? {...el, fontFamily: e.target.value} : el))}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs"
                    >
                      <optgroup label="Standard">
                        <option value="sans-serif">Sans Serif</option>
                        <option value="serif">Serif</option>
                        <option value="monospace">Monospace</option>
                      </optgroup>
                      {customFonts.length > 0 && (
                        <optgroup label="Custom">
                          {customFonts.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                        </optgroup>
                      )}
                    </select>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-[10px] text-slate-500 uppercase tracking-tighter">Dimensione Font</label>
                      <input type="number" value={selectedElement.fontSize} onChange={e => setElements(prev => prev.map(el => el.id === selectedId ? {...el, fontSize: parseInt(e.target.value) || 0} : el))} className="w-14 bg-slate-900 text-right text-[10px] border border-slate-700 rounded px-1" />
                    </div>
                    <input type="range" min="8" max="300" value={selectedElement.fontSize} onChange={e => setElements(prev => prev.map(el => el.id === selectedId ? {...el, fontSize: parseInt(e.target.value)} : el))} className="w-full" />
                  </div>
                 </>
               )}

               {(selectedElement.type === 'svg' || selectedElement.type === 'raster') && (
                 <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-[10px] text-slate-500 uppercase tracking-tighter">Larghezza</label>
                      <input type="number" value={Math.round(selectedElement.width)} onChange={e => {
                        const val = parseInt(e.target.value) || 0;
                        setElements(prev => prev.map(el => el.id === selectedId ? {...el, width: val, height: val} : el));
                      }} className="w-14 bg-slate-900 text-right text-[10px] border border-slate-700 rounded px-1" />
                    </div>
                    <input type="range" min="10" max="1200" value={selectedElement.width} onChange={e => {
                      const val = parseInt(e.target.value);
                      setElements(prev => prev.map(el => el.id === selectedId ? {...el, width: val, height: val} : el));
                    }} className="w-full" />
                 </div>
               )}

               {selectedElement.type !== 'raster' && (
                 <div>
                    <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-tighter">Colore Elemento</label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={selectedElement.color || '#ffffff'} onChange={e => setElements(prev => prev.map(el => el.id === selectedId ? {...el, color: e.target.value} : el))} className="w-8 h-8 bg-transparent cursor-pointer" />
                      <button 
                        onClick={() => setElements(prev => prev.map(el => el.id === selectedId ? {...el, color: null} : el))}
                        className="text-[9px] bg-slate-700 px-2 h-8 rounded hover:bg-slate-600 transition-colors"
                      >
                        Default
                      </button>
                    </div>
                 </div>
               )}

               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-tighter">Coord X</label>
                    <input type="number" value={Math.round(selectedElement.x)} onChange={e => setElements(prev => prev.map(el => el.id === selectedId ? {...el, x: parseInt(e.target.value) || 0} : el))} className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs font-mono" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-tighter">Coord Y</label>
                    <input type="number" value={Math.round(selectedElement.y)} onChange={e => setElements(prev => prev.map(el => el.id === selectedId ? {...el, y: parseInt(e.target.value) || 0} : el))} className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs font-mono" />
                  </div>
               </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};

export default App;
