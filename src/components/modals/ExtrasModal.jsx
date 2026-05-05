import { useState, useMemo } from 'react';
import { X, Plus, Minus, Check } from 'lucide-react';
import { usePOS } from '../../context/POSContext';

const ExtrasModal = ({ product, isOpen, onClose, onConfirm, isClientMode }) => {
  const { extras } = usePOS();
  const [modifications, setModifications] = useState([]);
  const [manualExtraText, setManualExtraText] = useState('');

  // Ingredientes del producto
  const productIngredients = useMemo(() => {
    if (!product?.ingredients) return [];
    return product.ingredients.split(/[\n,]+/).map(i => i.trim()).filter(Boolean);
  }, [product]);

  // Clasificación de Extras
  const { recommendedExtras, otherExtras } = useMemo(() => {
    const recommended = [];
    const others = [];

    extras.forEach(ex => {
      // Es recomendado si el nombre del extra está contenido en algún ingrediente o viceversa
      const isRecommended = productIngredients.some(ing => 
        ing.toLowerCase().includes(ex.name.toLowerCase()) || 
        ex.name.toLowerCase().includes(ing.toLowerCase())
      );

      if (isRecommended) recommended.push(ex);
      else others.push(ex);
    });

    return { recommendedExtras: recommended, otherExtras: others };
  }, [extras, productIngredients]);

  if (!isOpen) return null;

  const handleAddExtra = (extra) => {
    // Evitar duplicados exactos
    if (modifications.some(m => m.type === 'extra' && m.name === extra.name)) return;
    setModifications([...modifications, { type: 'extra', name: extra.name, price: Number(extra.price) }]);
  };
  const handleRemoveIngredient = (ingredient) => {
    if (modifications.some(m => m.type === 'remove' && m.name === ingredient)) return;
    setModifications([...modifications, { type: 'remove', name: ingredient, price: 0 }]);
  };

  const removeModification = (index) => {
    setModifications(modifications.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    onConfirm(product, modifications);
    setModifications([]);
    setManualExtraText('');
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
          
          {/* Extras Recomendados */}
          {recommendedExtras.length > 0 && (
            <div>
              <label className="block text-emerald-400 font-medium mb-2">+ Extras Recomendados</label>
              <div className="flex flex-wrap gap-2">
                {recommendedExtras.map(ex => (
                  <button 
                    key={ex.id}
                    onClick={() => handleAddExtra(ex)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300 transition-colors text-sm"
                  >
                    <Plus size={16} />
                    <span>{ex.name}</span>
                    <span className="opacity-70 font-mono">+${Number(ex.price).toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Añadir Extra Manual (Solo Cajero) */}
          {!isClientMode && (
            <div>
              <label className="block text-emerald-400 font-medium mb-2">+ Añadir Extra Manual</label>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!manualExtraText.trim()) return;
                  
                  // Buscar si el texto coincide con algún extra global para asignarle precio
                  const foundExtra = extras.find(ex => ex.name.toLowerCase() === manualExtraText.trim().toLowerCase());
                  const price = foundExtra ? Number(foundExtra.price) : 0;
                  
                  if (modifications.some(m => m.type === 'extra' && m.name.toLowerCase() === manualExtraText.trim().toLowerCase())) return;
                  
                  setModifications([...modifications, { type: 'extra', name: manualExtraText.trim(), price }]);
                  setManualExtraText('');
                }} 
                className="flex gap-2"
              >
                <input 
                  type="text"
                  value={manualExtraText}
                  onChange={(e) => setManualExtraText(e.target.value)}
                  placeholder="Ej. Doble Queso"
                  className="glass-input flex-1 border-emerald-500/30 focus:border-emerald-500 focus:ring-emerald-500/30"
                  list="other-extras"
                />
                <datalist id="other-extras">
                  {otherExtras.map(ex => (
                    <option key={ex.id} value={ex.name}>+${Number(ex.price).toFixed(2)}</option>
                  ))}
                </datalist>
                <button type="submit" disabled={!manualExtraText.trim()} className="btn-success px-3 disabled:opacity-50 disabled:cursor-not-allowed">
                  <Plus size={20} />
                </button>
              </form>
            </div>
          )}

          {/* Quitar Ingredientes */}
          {productIngredients.length > 0 && (
            <div>
              <label className="block text-red-400 font-medium mb-2">- Quitar Ingredientes</label>
              <div className="flex flex-wrap gap-2">
                {productIngredients.map((ing, i) => (
                  <button 
                    key={i}
                    onClick={() => handleRemoveIngredient(ing)}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-300 transition-colors text-sm"
                  >
                    <Minus size={16} />
                    <span>{ing}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Si no hay opciones de personalización */}
          {recommendedExtras.length === 0 && (!otherExtras.length || isClientMode) && productIngredients.length === 0 && (
            <div className="p-4 bg-white/5 rounded-xl text-center text-slate-400 text-sm italic">
              No hay opciones de personalización configuradas para este producto.
            </div>
          )}

          {/* Lista Visual de Modificaciones Agregadas */}
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
                    {mod.type === 'extra' && mod.price > 0 && <span className="opacity-70 ml-1">(${mod.price.toFixed(2)})</span>}
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
