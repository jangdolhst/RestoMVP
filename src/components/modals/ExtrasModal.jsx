import { useState } from 'react';
import { X, Plus, Minus, Check } from 'lucide-react';

const ExtrasModal = ({ product, isOpen, onClose, onConfirm }) => {
  const [extraInput, setExtraInput] = useState('');
  const [removeInput, setRemoveInput] = useState('');
  const [modifications, setModifications] = useState([]);

  if (!isOpen) return null;

  const handleAddExtra = (e) => {
    e.preventDefault();
    if (!extraInput.trim()) return;
    setModifications([...modifications, { type: 'extra', name: extraInput.trim() }]);
    setExtraInput('');
  };

  const handleAddRemove = (e) => {
    e.preventDefault();
    if (!removeInput.trim()) return;
    setModifications([...modifications, { type: 'remove', name: removeInput.trim() }]);
    setRemoveInput('');
  };

  const removeModification = (index) => {
    setModifications(modifications.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    onConfirm(product, modifications);
    // Reset state
    setModifications([]);
    setExtraInput('');
    setRemoveInput('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-200">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold text-white mb-1">Personalizar</h2>
        <p className="text-slate-400 mb-6">{product.name}</p>

        <div className="space-y-6">
          {/* Sección de Extras */}
          <div>
            <label className="block text-emerald-400 font-medium mb-2">+ Agregar Extra</label>
            <form onSubmit={handleAddExtra} className="flex gap-2">
              <input 
                type="text" 
                value={extraInput}
                onChange={(e) => setExtraInput(e.target.value)}
                className="glass-input flex-1 border-emerald-500/30 focus:border-emerald-500 focus:ring-emerald-500/30"
                placeholder="Ej. Doble Queso"
              />
              <button type="submit" className="btn-success px-3">
                <Plus size={20} />
              </button>
            </form>
          </div>

          {/* Sección de Quitar */}
          <div>
            <label className="block text-red-400 font-medium mb-2">- Quitar Ingrediente</label>
            <form onSubmit={handleAddRemove} className="flex gap-2">
              <input 
                type="text" 
                value={removeInput}
                onChange={(e) => setRemoveInput(e.target.value)}
                className="glass-input flex-1 border-red-500/30 focus:border-red-500 focus:ring-red-500/30"
                placeholder="Ej. Cebolla"
              />
              <button type="submit" className="btn-danger px-3">
                <Minus size={20} />
              </button>
            </form>
          </div>

          {/* Lista Visual de Modificaciones */}
          {modifications.length > 0 && (
            <div className="p-4 bg-black/20 border border-white/5 rounded-xl">
              <h4 className="text-sm font-medium text-slate-300 mb-3">Modificaciones actuales:</h4>
              <div className="flex flex-wrap gap-2">
                {modifications.map((mod, index) => (
                  <span 
                    key={index} 
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border cursor-pointer hover:opacity-80 transition-opacity ${
                      mod.type === 'extra' 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                        : 'bg-red-500/20 text-red-300 border-red-500/30'
                    }`}
                    onClick={() => removeModification(index)}
                    title="Click para remover"
                  >
                    {mod.type === 'extra' ? '+' : '-'} {mod.name}
                    <X size={14} className="ml-1 opacity-60" />
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8">
          <button onClick={handleConfirm} className="btn-primary w-full py-3 flex justify-center items-center gap-2">
            <Check size={20} />
            Añadir a la Orden
          </button>
        </div>

      </div>
    </div>
  );
};

export default ExtrasModal;
