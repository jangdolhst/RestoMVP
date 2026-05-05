import { useState, useEffect, useRef } from 'react';
import { X, Save, UploadCloud, Plus } from 'lucide-react';

const NewItemModal = ({ isOpen, onClose, onSave, currentCategoryId }) => {
  const [type, setType] = useState(currentCategoryId ? 'producto' : 'categoria');
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState(null);
  
  // Estado para bulk extras
  const [pendingExtras, setPendingExtras] = useState([]);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setType(currentCategoryId ? 'producto' : 'categoria');
      setName('');
      setIngredients('');
      setPrice('');
      setImage(null);
      setPendingExtras([]);
    }
  }, [isOpen, currentCategoryId]);

  if (!isOpen) return null;

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result); // Base64 string
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddExtraToList = () => {
    if (!name.trim() || !price || isNaN(price)) return alert('Ingresa un nombre y precio válido para el extra');
    setPendingExtras(prev => [...prev, { name: name.trim(), price: parseFloat(price) }]);
    setName('');
    setPrice('');
  };

  const handleRemovePendingExtra = (index) => {
    setPendingExtras(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (type === 'extra') {
      const extrasToSave = [...pendingExtras];
      if (name.trim() && price && !isNaN(price)) {
        extrasToSave.push({ name: name.trim(), price: parseFloat(price) });
      }
      if (extrasToSave.length === 0) return alert('No hay extras para guardar');
      
      onSave({ type, data: extrasToSave });
      onClose();
      return;
    }

    if (!name.trim()) return alert('El nombre es requerido');
    
    if (type === 'producto') {
      if (!price || isNaN(price)) return alert('Ingresa un precio válido');
      onSave({
        type,
        data: {
          name,
          price: parseFloat(price),
          ingredients: ingredients.split(/[\n,]+/).map(i => i.trim()).filter(Boolean).join(', '),
          image,
          categoryId: currentCategoryId || null,
        }
      });
    } else {
      onSave({
        type,
        data: { name, image }
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-200">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold text-white mb-6">Nuevo Elemento</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Tipo de elemento</label>
            <select 
              value={type} 
              onChange={(e) => setType(e.target.value)}
              disabled={!!currentCategoryId}
              className="glass-input w-full appearance-none cursor-pointer disabled:opacity-50"
            >
              <option value="categoria" className="bg-slate-800 text-white">Categoría</option>
              <option value="producto" className="bg-slate-800 text-white">Producto</option>
              <option value="extra" className="bg-slate-800 text-white">Extra</option>
            </select>
          </div>

          <div className={`grid gap-4 ${type === 'extra' ? 'grid-cols-2 items-end' : 'grid-cols-1'}`}>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Nombre:</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="glass-input w-full"
                placeholder={`Nombre ${type === 'extra' ? 'del' : 'de la'} ${type}`}
                required={type !== 'extra' || pendingExtras.length === 0}
              />
            </div>

            {type === 'extra' && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-300 mb-1">Precio:</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input 
                      type="number" 
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="glass-input w-full pl-8"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      required={pendingExtras.length === 0}
                    />
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={handleAddExtraToList}
                  className="btn-secondary h-12 w-12 flex items-center justify-center shrink-0 mb-0"
                >
                  <Plus size={20} />
                </button>
              </div>
            )}
          </div>

          {type === 'extra' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-300 mb-1">Extras pendientes:</label>
              <div className="glass-panel p-4 min-h-[120px] max-h-[200px] overflow-y-auto flex flex-col gap-2">
                {pendingExtras.length === 0 ? (
                  <p className="text-slate-500 text-sm italic text-center py-4">Agrega extras a la lista</p>
                ) : (
                  pendingExtras.map((ex, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg border border-white/5">
                      <span className="text-white font-medium">{ex.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-green-400 font-mono">${ex.price.toFixed(2)}</span>
                        <button type="button" onClick={() => handleRemovePendingExtra(i)} className="text-red-400 hover:text-red-300">
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {type === 'producto' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Ingredientes:</label>
                <textarea 
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                  className="glass-input w-full min-h-[80px] resize-none"
                  placeholder="Lista de ingredientes base..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Precio:</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                  <input 
                    type="number" 
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="glass-input w-full pl-8"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>
              </div>
            </>
          )}

          {type !== 'extra' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Imagen (Opcional):</label>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleImageUpload}
              />
              {image ? (
                <div className="relative w-full h-32 rounded-lg overflow-hidden border border-white/10 group">
                  <img src={image} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary text-sm">Cambiar</button>
                  </div>
                </div>
              ) : (
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary w-full flex items-center justify-center gap-2 border-dashed border-2 py-4 text-slate-400 hover:text-white"
                >
                  <UploadCloud size={20} />
                  <span>Subir imagen</span>
                </button>
              )}
            </div>
          )}

          <div className="pt-4">
            <button type="submit" className="btn-primary w-full flex justify-center items-center gap-2 py-3">
              <Save size={20} />
              Guardar {type === 'categoria' ? 'Categoría' : type === 'producto' ? 'Producto' : 'Extras'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default NewItemModal;
