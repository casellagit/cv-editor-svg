import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, Image as ImageIcon, Type, X, 
  ChevronLeft, ChevronRight, Layers, Trash2, Move, 
  Maximize, Minimize, DownloadCloud, FileJson, Save, Upload,
  ArrowUp, ArrowDown, ChevronUp, ChevronDown
} from 'lucide-react';

const DEFAULT_CANVAS_WIDTH = 1920;
const DEFAULT_CANVAS_HEIGHT = 1080;

const App = () => {
  const [project, setProject] = useState({
    name: "Nuovo Progetto",
    background: null,
    assets: [],
    elements: [],
    canvasWidth: DEFAULT_CANVAS_WIDTH,
    canvasHeight: DEFAULT_CANVAS_HEIGHT
  });

  const [selectedId, setSelectedId] = useState(null);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [zoom, setZoom] = useState(0.4);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const iconInputRef = useRef(null);
  const fontInputRef = useRef(null);
  const jsonInputRef = useRef(null);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const updateElement = (id, updates) => {
    setProject(prev => ({
      ...prev,
      elements: prev.elements.map(el => el.id === id ? { ...el, ...updates } : el)
    }));
  };

  const deleteElement = (id) => {
    setProject(prev => ({
      ...prev,
      elements: prev.elements.filter(el => el.id !== id)
    }));
    if (selectedId === id) setSelectedId(null);
  };

  const deleteAsset = (id) => {
    setProject(prev => ({
      ...prev,
      assets: prev.assets.filter(a => a.id !== id),
      elements: prev.elements.filter(el => el.assetId !== id)
    }));
  };

  const removeBackground = (e) => {
    e.stopPropagation();
    setProject(prev => ({
      ...prev,
      background: null,
      canvasWidth: DEFAULT_CANVAS_WIDTH,
      canvasHeight: DEFAULT_CANVAS_HEIGHT
    }));
  };

  const updateZIndex = (id, action) => {
    setProject(prev => {
      const elements = [...prev.elements].sort((a, b) => a.zIndex - b.zIndex);
      const index = elements.findIndex(el => el.id === id);
      if (index === -1) return prev;

      const newElements = [...elements];
      
      switch(action) {
        case 'front':
          const [elFront] = newElements.splice(index, 1);
          newElements.push(elFront);
          break;
        case 'back':
          const [elBack] = newElements.splice(index, 1);
          newElements.unshift(elBack);
          break;
        case 'up':
          if (index < newElements.length - 1) {
            [newElements[index], newElements[index + 1]] = [newElements[index + 1], newElements[index]];
          }
          break;
        case 'down':
          if (index > 0) {
            [newElements[index], newElements[index - 1]] = [newElements[index - 1], newElements[index]];
          }
          break;
        default: break;
      }

      return {
        ...prev,
        elements: newElements.map((el, i) => ({ ...el, zIndex: i }))
      };
    });
  };

  const handleBackgroundUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setProject(prev => ({
          ...prev,
          background: { src: event.target.result, width: img.width, height: img.height },
          canvasWidth: img.width,
          canvasHeight: img.height
        }));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleIconUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            setProject(prev => ({
              ...prev,
              assets: [...prev.assets, { 
                id: generateId(), 
                name: file.name, 
                src: event.target.result, 
                type: 'icon',
                width: img.width,
                height: img.height
              }]
            }));
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFontUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fontName = `CustomFont_${generateId()}`;
    const reader = new FileReader();
    reader.onload = (event) => {
      const newStyle = document.createElement('style');
      newStyle.appendChild(document.createTextNode(`@font-face { font-family: '${fontName}'; src: url('${event.target.result}'); }`));
      document.head.appendChild(newStyle);
      setProject(prev => ({
        ...prev,
        assets: [...prev.assets, { id: generateId(), name: file.name, family: fontName, type: 'font' }]
      }));
    };
    reader.readAsDataURL(file);
  };

  const addText = () => {
    const newEl = {
      id: generateId(),
      type: 'text',
      content: 'Nuovo Testo',
      x: project.canvasWidth / 2,
      y: project.canvasHeight / 2,
      scale: 1,
      rotation: 0,
      zIndex: project.elements.length,
      fontSize: 48,
      color: '#ffffff',
      fontFamily: 'sans-serif',
      fontWeight: 'normal',
      strokeWidth: 0,
      strokeColor: '#000000'
    };
    setProject(prev => ({ ...prev, elements: [...prev.elements, newEl] }));
    setSelectedId(newEl.id);
  };

  const addIcon = (asset) => {
    const newEl = {
      id: generateId(),
      type: 'icon',
      assetId: asset.id,
      src: asset.src,
      width: asset.width,
      height: asset.height,
      x: project.canvasWidth / 2,
      y: project.canvasHeight / 2,
      scale: 1,
      rotation: 0,
      zIndex: project.elements.length
    };
    setProject(prev => ({ ...prev, elements: [...prev.elements, newEl] }));
    setSelectedId(newEl.id);
  };

  const handleElementStartDrag = (e, el) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    setSelectedId(el.id);
    setIsDragging(true);
    
    const rect = canvasRef.current.getBoundingClientRect();
    const xOnCanvas = (clientX - rect.left) / zoom;
    const yOnCanvas = (clientY - rect.top) / zoom;
    setDragOffset({ x: xOnCanvas - el.x, y: yOnCanvas - el.y });
  };

  const handleInteractionMove = (e) => {
    if (!isDragging || !selectedId) return;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const xOnCanvas = (clientX - rect.left) / zoom;
    const yOnCanvas = (clientY - rect.top) / zoom;
    
    updateElement(selectedId, {
      x: Math.round(xOnCanvas - dragOffset.x),
      y: Math.round(yOnCanvas - dragOffset.y)
    });
  };

  const handleEndDrag = () => {
    setIsDragging(false);
  };

  const exportProjectJSON = () => {
    const dataStr = JSON.stringify(project, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `${project.name}.json`);
    linkElement.click();
  };

  const importProjectJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        setProject(imported);
        setSelectedId(null);
      } catch (err) {
        console.error("Errore caricamento JSON", err);
      }
    };
    reader.readAsText(file);
  };

  const exportPNG = async () => {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = project.canvasWidth;
    offCanvas.height = project.canvasHeight;
    const ctx = offCanvas.getContext('2d');

    if (project.background) {
      const bg = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = project.background.src; });
      ctx.drawImage(bg, 0, 0, offCanvas.width, offCanvas.height);
    } else {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);
    }

    const sorted = [...project.elements].sort((a, b) => a.zIndex - b.zIndex);
    for (const el of sorted) {
      ctx.save();
      ctx.translate(el.x, el.y);
      ctx.rotate((el.rotation * Math.PI) / 180);
      ctx.scale(el.scale, el.scale);

      if (el.type === 'text') {
        ctx.font = `${el.fontWeight} ${el.fontSize}px ${el.fontFamily}`;
        ctx.fillStyle = el.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (el.strokeWidth > 0) {
          ctx.strokeStyle = el.strokeColor;
          ctx.lineWidth = el.strokeWidth;
          ctx.strokeText(el.content, 0, 0);
        }
        ctx.fillText(el.content, 0, 0);
      } else {
        const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = el.src; });
        ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
      }
      ctx.restore();
    }
    const link = document.createElement('a');
    link.download = `${project.name}.png`;
    link.href = offCanvas.toDataURL('image/png');
    link.click();
  };

  const exportSVG = async () => {
    const sorted = [...project.elements].sort((a, b) => a.zIndex - b.zIndex);
    let svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<svg width="${project.canvasWidth}" height="${project.canvasHeight}" viewBox="0 0 ${project.canvasWidth} ${project.canvasHeight}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">`;
    
    // Background
    if (project.background) {
      svgContent += `\n<image href="${project.background.src}" x="0" y="0" width="${project.canvasWidth}" height="${project.canvasHeight}" preserveAspectRatio="none" />`;
    } else {
      svgContent += `\n<rect width="100%" height="100%" fill="#111" />`;
    }

    for (const el of sorted) {
      if (el.type === 'text') {
        // Fix per il testo: Usiamo dy=".35em" che è molto più compatibile di dominant-baseline per il centro verticale
        svgContent += `\n<g transform="translate(${el.x}, ${el.y}) rotate(${el.rotation}) scale(${el.scale})">`;
        svgContent += `<text x="0" y="0" dy=".35em" font-family="${el.fontFamily}" font-size="${el.fontSize}" fill="${el.color}" font-weight="${el.fontWeight}" text-anchor="middle" stroke="${el.strokeColor}" stroke-width="${el.strokeWidth}">${el.content}</text>`;
        svgContent += `</g>`;
      } else {
        const w = el.width || 100;
        const h = el.height || 100;
        const offsetX = -w / 2;
        const offsetY = -h / 2;
        svgContent += `\n<g transform="translate(${el.x}, ${el.y}) rotate(${el.rotation}) scale(${el.scale}) translate(${offsetX}, ${offsetY})">`;
        svgContent += `<image href="${el.src}" x="0" y="0" width="${w}" height="${h}" />`;
        svgContent += `</g>`;
      }
    }

    svgContent += `\n</svg>`;
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${project.name}.svg`;
    link.href = url;
    link.click();
  };

  const selectedElement = project.elements.find(el => el.id === selectedId);

  return (
    <div className="flex h-screen w-full bg-[#0f0f0f] text-gray-200 overflow-hidden font-sans select-none">
      
      {/* PANNELLO SINISTRO */}
      <aside className={`transition-all duration-300 bg-[#1a1a1a] border-r border-gray-800 flex flex-col overflow-hidden flex-shrink-0 ${leftPanelOpen ? 'w-80 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
        <div className="p-4 flex flex-col h-full overflow-y-auto w-80">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Layers className="w-5 h-5 text-blue-400" /> Assets</h2>
          
          <section className="mb-6">
            <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">Sfondo</h3>
            <div className="relative group">
              <button 
                onClick={() => !project.background && fileInputRef.current.click()} 
                className={`w-full aspect-video border-2 border-dashed border-gray-700 rounded-lg flex flex-col items-center justify-center transition-colors bg-black/20 overflow-hidden ${!project.background ? 'hover:border-blue-500' : ''}`}
              >
                {project.background ? (
                  <img src={project.background.src} className="h-full w-full object-contain" alt="bg" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-gray-600" />
                )}
              </button>
              {project.background && (
                <button 
                  onClick={removeBackground}
                  className="absolute top-2 right-2 p-1 bg-red-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  title="Rimuovi sfondo"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleBackgroundUpload} />
          </section>

          <section className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase">Icone</h3>
              <button onClick={() => iconInputRef.current.click()} className="p-1 hover:bg-gray-700 rounded"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {project.assets.filter(a => a.type === 'icon').map(asset => (
                <div key={asset.id} className="relative group aspect-square bg-black/40 rounded border border-gray-700 p-1 hover:border-blue-500 cursor-pointer">
                  <img 
                    src={asset.src} 
                    className="w-full h-full object-contain" 
                    alt="icon" 
                    onClick={() => addIcon(asset)}
                  />
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteAsset(asset.id); }}
                    className="absolute -top-1 -right-1 p-0.5 bg-red-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    title="Elimina asset"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <input type="file" ref={iconInputRef} hidden multiple accept="image/*" onChange={handleIconUpload} />
          </section>

          <section className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-gray-400 uppercase">Font</h3>
              <button onClick={() => fontInputRef.current.click()} className="p-1 hover:bg-gray-700 rounded"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {project.assets.filter(a => a.type === 'font').map(asset => (
                <div key={asset.id} className="text-xs bg-black/20 p-2 rounded border border-gray-800" style={{ fontFamily: asset.family }}>{asset.name}</div>
              ))}
            </div>
            <input type="file" ref={fontInputRef} hidden accept=".ttf,.woff,.woff2" onChange={handleFontUpload} />
          </section>

          <div className="mt-auto space-y-3 pt-4 border-t border-gray-800">
            <button onClick={addText} className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center justify-center gap-2 font-medium"><Type className="w-4 h-4" /> Testo</button>
            
            <div className="grid grid-cols-2 gap-2">
              <button onClick={exportProjectJSON} className="py-2 bg-gray-800 hover:bg-gray-700 rounded flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-tighter">
                <FileJson className="w-3 h-3" /> Esporta JSON
              </button>
              <button onClick={() => jsonInputRef.current.click()} className="py-2 bg-gray-800 hover:bg-gray-700 rounded flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-tighter">
                <Upload className="w-3 h-3" /> Importa JSON
              </button>
              <input type="file" ref={jsonInputRef} hidden accept=".json" onChange={importProjectJSON} />
            </div>
          </div>
        </div>
      </aside>

      <div className="flex flex-col justify-center gap-4 z-50">
        <button onClick={() => setLeftPanelOpen(!leftPanelOpen)} className="h-12 w-6 bg-[#1a1a1a] border border-gray-800 border-l-0 rounded-r-lg hover:bg-gray-700">
          {leftPanelOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
      </div>

      {/* AREA CENTRALE CANVAS */}
      <main 
        className="flex-1 relative overflow-hidden bg-black/60 flex items-center justify-center p-4" 
        onMouseMove={handleInteractionMove} 
        onMouseUp={handleEndDrag}
        onTouchMove={handleInteractionMove}
        onTouchEnd={handleEndDrag}
      >
        <div className="absolute top-6 right-6 flex gap-2 z-50">
            <div className="bg-[#1a1a1a] p-1 rounded-lg border border-gray-800 flex shadow-xl">
                <button onClick={exportPNG} className="px-4 py-2 hover:bg-gray-800 rounded flex items-center gap-2 text-xs font-bold text-blue-400">
                    <Save className="w-4 h-4"/> PNG
                </button>
                <button onClick={exportSVG} className="px-4 py-2 hover:bg-gray-800 rounded flex items-center gap-2 text-xs font-bold text-purple-400">
                    <DownloadCloud className="w-4 h-4"/> SVG
                </button>
            </div>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#1a1a1a] p-2 rounded-full shadow-2xl flex items-center gap-4 px-4 border border-gray-800 z-50">
          <button onClick={() => setZoom(z => Math.max(0.05, z - 0.05))} className="p-1 hover:bg-gray-700 rounded-full"><Minimize className="w-4 h-4"/></button>
          <span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(4, z + 0.05))} className="p-1 hover:bg-gray-700 rounded-full"><Maximize className="w-4 h-4"/></button>
        </div>

        <div className="w-full h-full overflow-auto flex items-center justify-center custom-scrollbar">
          <div 
            ref={canvasRef}
            onMouseDown={(e) => e.target === canvasRef.current && setSelectedId(null)}
            className="relative shadow-2xl flex-shrink-0"
            style={{
              width: project.canvasWidth,
              height: project.canvasHeight,
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
              backgroundColor: '#111',
              backgroundImage: project.background ? `url(${project.background.src})` : 'none',
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat'
            }}
          >
            {project.elements.sort((a,b) => a.zIndex - b.zIndex).map(el => (
              <div
                key={el.id}
                onMouseDown={(e) => handleElementStartDrag(e, el)}
                onTouchStart={(e) => handleElementStartDrag(e, el)}
                className={`absolute flex items-center justify-center pointer-events-auto cursor-move touch-none ${selectedId === el.id ? 'ring-2 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : ''}`}
                style={{
                  left: el.x,
                  top: el.y,
                  transform: `translate(-50%, -50%) rotate(${el.rotation}deg) scale(${el.scale})`,
                  zIndex: el.zIndex,
                  width: el.type === 'icon' ? el.width : 'auto',
                  height: el.type === 'icon' ? el.height : 'auto',
                }}
              >
                {el.type === 'text' ? (
                  <div style={{
                    fontFamily: el.fontFamily,
                    fontSize: el.fontSize,
                    color: el.color,
                    fontWeight: el.fontWeight,
                    whiteSpace: 'nowrap',
                    WebkitTextStroke: `${el.strokeWidth}px ${el.strokeColor}`,
                    textAlign: 'center'
                  }}>{el.content}</div>
                ) : (
                  <img src={el.src} draggable={false} className="max-w-none block" style={{ width: '100%', height: '100%' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      <div className="flex flex-col justify-center gap-4 z-50">
        <button onClick={() => setRightPanelOpen(!rightPanelOpen)} className="h-12 w-6 bg-[#1a1a1a] border border-gray-800 border-r-0 rounded-l-lg hover:bg-gray-700">
          {rightPanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* PANNELLO DESTRO */}
      <aside className={`transition-all duration-300 bg-[#1a1a1a] border-l border-gray-800 flex flex-col overflow-hidden flex-shrink-0 ${rightPanelOpen ? 'w-80 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
        <div className="p-4 overflow-y-auto w-80">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Move className="w-5 h-5 text-purple-400" /> Proprietà</h2>
          {selectedElement ? (
            <div className="space-y-6">
              <section>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div><label className="text-[10px] text-gray-500 uppercase">Posizione X</label><input type="number" value={selectedElement.x} onChange={(e) => updateElement(selectedId, { x: parseInt(e.target.value) || 0 })} className="w-full bg-black/40 border border-gray-700 rounded px-2 py-1 text-sm" /></div>
                  <div><label className="text-[10px] text-gray-500 uppercase">Posizione Y</label><input type="number" value={selectedElement.y} onChange={(e) => updateElement(selectedId, { y: parseInt(e.target.value) || 0 })} className="w-full bg-black/40 border border-gray-700 rounded px-2 py-1 text-sm" /></div>
                </div>
                <div className="mb-4">
                   <div className="flex justify-between items-center text-[10px] text-gray-500 uppercase mb-1">
                     <span>Scala</span>
                     <div className="flex items-center gap-1 bg-black/40 px-1 rounded border border-gray-700">
                        <input 
                          type="number" 
                          step="1"
                          value={Math.round(selectedElement.scale * 100)} 
                          onChange={(e) => updateElement(selectedId, { scale: (parseFloat(e.target.value) / 100) || 0.01 })}
                          className="w-12 bg-transparent text-right text-xs outline-none py-0.5"
                        />
                        <span className="text-[8px] text-gray-600">%</span>
                     </div>
                   </div>
                   <input type="range" min="0.01" max="5" step="0.01" value={selectedElement.scale} onChange={(e) => updateElement(selectedId, { scale: parseFloat(e.target.value) })} className="w-full accent-blue-500" />
                </div>
                <div className="mb-4">
                   <div className="flex justify-between text-[10px] text-gray-500 uppercase"><span>Rotazione</span><span>{selectedElement.rotation}°</span></div>
                   <input type="range" min="0" max="360" value={selectedElement.rotation} onChange={(e) => updateElement(selectedId, { rotation: parseInt(e.target.value) })} className="w-full accent-purple-500" />
                </div>
              </section>

              {/* GESTIONE LIVELLI */}
              <section className="pt-4 border-t border-gray-800">
                <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Livelli</h3>
                <div className="grid grid-cols-4 gap-2">
                  <button onClick={() => updateZIndex(selectedId, 'front')} className="p-2 bg-gray-800 hover:bg-gray-700 rounded flex flex-col items-center gap-1" title="In Primo Piano">
                    <ArrowUp className="w-4 h-4 text-blue-400" />
                    <span className="text-[8px] uppercase">Top</span>
                  </button>
                  <button onClick={() => updateZIndex(selectedId, 'up')} className="p-2 bg-gray-800 hover:bg-gray-700 rounded flex flex-col items-center gap-1" title="Sposta Su">
                    <ChevronUp className="w-4 h-4 text-gray-300" />
                    <span className="text-[8px] uppercase">Su</span>
                  </button>
                  <button onClick={() => updateZIndex(selectedId, 'down')} className="p-2 bg-gray-800 hover:bg-gray-700 rounded flex flex-col items-center gap-1" title="Sposta Giù">
                    <ChevronDown className="w-4 h-4 text-gray-300" />
                    <span className="text-[8px] uppercase">Giù</span>
                  </button>
                  <button onClick={() => updateZIndex(selectedId, 'back')} className="p-2 bg-gray-800 hover:bg-gray-700 rounded flex flex-col items-center gap-1" title="Sullo Sfondo">
                    <ArrowDown className="w-4 h-4 text-red-400" />
                    <span className="text-[8px] uppercase">Bottom</span>
                  </button>
                </div>
              </section>

              {selectedElement.type === 'text' && (
                <section className="space-y-4 pt-4 border-t border-gray-800">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase">Testo</h3>
                  <textarea value={selectedElement.content} onChange={(e) => updateElement(selectedId, { content: e.target.value })} className="w-full bg-black/40 border border-gray-700 rounded p-2 text-sm h-20" />
                  
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase mb-1 block">Famiglia Font</label>
                    <select 
                      value={selectedElement.fontFamily} 
                      onChange={(e) => updateElement(selectedId, { fontFamily: e.target.value })}
                      className="w-full bg-black/40 border border-gray-700 rounded px-2 py-1 text-sm"
                    >
                      <option value="sans-serif">Sans Serif</option>
                      <option value="serif">Serif</option>
                      <option value="monospace">Monospace</option>
                      {project.assets.filter(a => a.type === 'font').map(f => (
                        <option key={f.id} value={f.family}>{f.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase mb-1 block">Peso</label>
                      <select 
                        value={selectedElement.fontWeight} 
                        onChange={(e) => updateElement(selectedId, { fontWeight: e.target.value })}
                        className="w-full bg-black/40 border border-gray-700 rounded px-2 py-1 text-sm"
                      >
                        <option value="normal">Normale</option>
                        <option value="bold">Grassetto</option>
                        <option value="lighter">Sottile</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase mb-1 block">Dim. Base</label>
                      <input type="number" value={selectedElement.fontSize} onChange={(e) => updateElement(selectedId, { fontSize: parseInt(e.target.value) || 12 })} className="w-full bg-black/40 border border-gray-700 rounded px-2 py-1 text-sm" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="text-[10px] text-gray-500 uppercase mb-1 block">Colore Testo</label>
                        <input type="color" value={selectedElement.color} onChange={(e) => updateElement(selectedId, { color: e.target.value })} className="w-full h-8 cursor-pointer bg-transparent border-none p-0" />
                    </div>
                    <div>
                        <label className="text-[10px] text-gray-500 uppercase mb-1 block">Colore Bordo</label>
                        <input type="color" value={selectedElement.strokeColor} onChange={(e) => updateElement(selectedId, { strokeColor: e.target.value })} className="w-full h-8 cursor-pointer bg-transparent border-none p-0" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] text-gray-500 uppercase"><span>Spessore Bordo</span><span>{selectedElement.strokeWidth}px</span></div>
                    <input type="range" min="0" max="20" step="0.5" value={selectedElement.strokeWidth} onChange={(e) => updateElement(selectedId, { strokeWidth: parseFloat(e.target.value) })} className="w-full accent-blue-500" />
                  </div>
                </section>
              )}
              <button onClick={() => deleteElement(selectedId)} className="w-full py-3 bg-red-900/20 text-red-500 border border-red-900/50 rounded-lg font-bold hover:bg-red-900/40 transition-colors">ELIMINA</button>
            </div>
          ) : <div className="text-center text-gray-600 mt-20 italic">Seleziona un elemento</div>}
        </div>
      </aside>

      <style>{`
        input[type="range"] { -webkit-appearance: none; height: 4px; background: #333; border-radius: 2px; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; background: #3b82f6; border-radius: 50%; cursor: pointer; }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #444; }
        input[type="number"]::-webkit-inner-spin-button, 
        input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      `}</style>
    </div>
  );
};

export default App;
