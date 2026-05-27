import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Save, UploadCloud, Plus, Pencil } from 'lucide-react';
import { usePOS } from '../../context/POSContext';

const NewItemModal = ({ isOpen, onClose, onSave, currentCategoryId }) => {
  const { extras, updateExtra, deleteExtra } = usePOS();
  const { t } = useTranslation();
  const [type, setType] = useState(currentCategoryId ? 'producto' : 'categoria');
  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState(null);
  
  // Estado para nuevos extras pendientes de guardar
  const [pendingExtras, setPendingExtras] = useState([]);
  // Estado para edición inline de precio de extras existentes
  const [editingExtraId, setEditingExtraId] = useState(null);
  const [editingPrice, setEditingPrice] = useState('');
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setType(currentCategoryId ? 'producto' : 'categoria');
      setName('');
      setIngredients('');
      setPrice('');
      setImage(null);
      setPendingExtras([]);
      setEditingExtraId(null);
      setEditingPrice('');
    }
  }, [isOpen, currentCategoryId]);

  if (!isOpen) return null;

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddExtraToList = () => {
    if (!name.trim() || !price || isNaN(price)) return alert(t('modals.validExtra'));
    // Evitar duplicados con extras existentes
    const isDuplicate = extras.some(ex => ex.name.toLowerCase() === name.trim().toLowerCase());
    const isPendingDuplicate = pendingExtras.some(ex => ex.name.toLowerCase() === name.trim().toLowerCase());
    if (isDuplicate || isPendingDuplicate) return alert(t('modals.duplicateExtra'));

    setPendingExtras(prev => [...prev, { name: name.trim(), price: parseFloat(price) }]);
    setName('');
    setPrice('');
  };

  const handleRemovePendingExtra = (index) => {
    setPendingExtras(prev => prev.filter((_, i) => i !== index));
  };

  const handleStartEditPrice = (extra) => {
    setEditingExtraId(extra.id);
    setEditingPrice(String(extra.price));
  };

  const handleSaveEditPrice = async (id) => {
    const newPrice = parseFloat(editingPrice);
    if (isNaN(newPrice) || newPrice < 0) return alert(t('modals.validPrice'));
    await updateExtra(id, newPrice);
    setEditingExtraId(null);
    setEditingPrice('');
  };

  const handleDeleteExtra = async (id) => {
    if (!confirm(t('modals.deleteExtra'))) return;
    await deleteExtra(id);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (type === 'extra') {
      const extrasToSave = [...pendingExtras];
      if (name.trim() && price && !isNaN(price)) {
        extrasToSave.push({ name: name.trim(), price: parseFloat(price) });
      }
      if (extrasToSave.length === 0) return alert(t('modals.noNewExtras'));
      
      onSave({ type, data: extrasToSave });
      onClose();
      return;
    }

    if (!name.trim()) return alert(t('modals.requiredName'));
    
    if (type === 'producto') {
      if (!price || isNaN(price)) return alert(t('modals.validPrice'));
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

        <h2 className="text-2xl font-bold text-white mb-6">{t('modals.newElement')}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">{t('modals.elementType')}</label>
            <select 
              value={type} 
              onChange={(e) => setType(e.target.value)}
              disabled={!!currentCategoryId}
              className="glass-input w-full appearance-none cursor-pointer disabled:opacity-50"
            >
              <option value="categoria" className="bg-slate-800 text-white">{t('modals.category')}</option>
              <option value="producto" className="bg-slate-800 text-white">{t('modals.product')}</option>
              <option value="extra" className="bg-slate-800 text-white">{t('modals.extra')}</option>
            </select>
          </div>

          {/* === SECCIÓN EXTRAS === */}
          {type === 'extra' && (
            <>
              {/* Input para agregar nuevo extra */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t('modals.addExtra')}</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="glass-input flex-1"
                    placeholder={t('modals.extraName')}
                  />
                  <div className="relative w-24 shrink-0">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input 
                      type="number" 
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="glass-input w-full pl-8"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={handleAddExtraToList}
                    className="btn-secondary h-[42px] w-[42px] flex items-center justify-center shrink-0"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              {/* Lista completa de extras (existentes + pendientes) */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t('modals.extras')}</label>
                <div className="glass-panel p-3 min-h-[120px] max-h-[260px] overflow-y-auto space-y-2">
                  
                  {/* Extras existentes de la BD */}
                  {extras.map(ex => (
                    <div key={ex.id} className="flex items-center justify-between bg-slate-800/50 px-3 py-2 rounded-lg border border-white/5">
                      <span className="text-white font-medium text-sm truncate mr-2">{ex.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {editingExtraId === ex.id ? (
                          <>
                            <div className="relative w-20">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                              <input
                                type="number"
                                value={editingPrice}
                                onChange={(e) => setEditingPrice(e.target.value)}
                                className="glass-input w-full pl-6 py-1 text-sm"
                                step="0.01"
                                min="0"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.preventDefault(); handleSaveEditPrice(ex.id); }
                                  if (e.key === 'Escape') { setEditingExtraId(null); }
                                }}
                              />
                            </div>
                            <button 
                              type="button" 
                              onClick={() => handleSaveEditPrice(ex.id)} 
                              className="text-emerald-400 hover:text-emerald-300 transition-colors"
                              title={t('modals.savePrice')}
                            >
                              <Save size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <span 
                              className="text-green-400 font-mono text-sm cursor-pointer hover:text-green-300 transition-colors flex items-center gap-1"
                              onClick={() => handleStartEditPrice(ex)}
                              title={t('modals.editPrice')}
                            >
                              ${Number(ex.price).toFixed(2)}
                              <Pencil size={12} className="opacity-50" />
                            </span>
                          </>
                        )}
                        <button 
                          type="button" 
                          onClick={() => handleDeleteExtra(ex.id)} 
                          className="text-red-400/60 hover:text-red-400 transition-colors"
                          title={t('modals.deleteExtraTitle')}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Nuevos extras pendientes de guardar */}
                  {pendingExtras.map((ex, i) => (
                    <div key={`pending-${i}`} className="flex items-center justify-between bg-emerald-500/10 px-3 py-2 rounded-lg border border-emerald-500/20">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 text-xs font-medium uppercase tracking-wider">{t('modals.new')}</span>
                        <span className="text-white font-medium text-sm">{ex.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-green-400 font-mono text-sm">${ex.price.toFixed(2)}</span>
                        <button type="button" onClick={() => handleRemovePendingExtra(i)} className="text-red-400/60 hover:text-red-400 transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Mensaje vacío */}
                  {extras.length === 0 && pendingExtras.length === 0 && (
                    <p className="text-slate-500 text-sm italic text-center py-6">{t('modals.noExtras')}</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* === SECCIÓN CATEGORÍA / PRODUCTO === */}
          {type !== 'extra' && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">{t('common.labels.name')}:</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="glass-input w-full"
                placeholder={`${t('common.labels.name')} ${type}`}
                required
              />
            </div>
          )}

          {type === 'producto' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t('modals.ingredients')}</label>
                <textarea 
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                  className="glass-input w-full min-h-[80px] resize-none"
                  placeholder={t('modals.ingredientsPlaceholder')}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">{t('modals.price')}</label>
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
              <label className="block text-sm font-medium text-slate-300 mb-1">{t('modals.imageOptional')}</label>
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
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-secondary text-sm">{t('modals.change')}</button>
                  </div>
                </div>
              ) : (
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary w-full flex items-center justify-center gap-2 border-dashed border-2 py-4 text-slate-400 hover:text-white"
                >
                  <UploadCloud size={20} />
                  <span>{t('modals.uploadImage')}</span>
                </button>
              )}
            </div>
          )}

          <div className="pt-4">
            <button type="submit" className="btn-primary w-full flex justify-center items-center gap-2 py-3">
              <Save size={20} />
              {type === 'extra' 
                ? (pendingExtras.length > 0 ? t('modals.saveNewExtras', { count: pendingExtras.length, plural: pendingExtras.length > 1 ? 's' : '' }) : t('modals.saveExtras'))
                : (type === 'categoria' ? t('modals.saveCategory') : t('modals.saveProduct'))
              }
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default NewItemModal;
