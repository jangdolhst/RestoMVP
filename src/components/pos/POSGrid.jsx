import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePOS } from '../../context/POSContext';
import ItemCard from './ItemCard';
import NewItemModal from '../modals/NewItemModal';
import ExtrasModal from '../modals/ExtrasModal';
import { Plus, ChevronLeft } from 'lucide-react';

const POSGrid = ({ isClientMode = false, isOpen = true }) => {
  const { 
    visibleItems, 
    currentCategoryId, 
    setCurrentCategoryId, 
    categories,
    addToCart,
    addCategory,
    addProduct,
    addExtras,
    deleteCategory,
    deleteProduct
  } = usePOS();
  const { t } = useTranslation();

  // Estados de Modales
  const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
  
  // Estado para el Modal de Extras
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isExtrasModalOpen, setIsExtrasModalOpen] = useState(false);

  // Manejador del Click en ItemCard
  const handleItemClick = (item) => {
    if (item.price === undefined) {
      setCurrentCategoryId(item.id);
    } else {
      if (isClientMode && !isOpen) {
        alert(t('pos.errors.storeClosed'));
        return;
      }
      setSelectedProduct(item);
      setIsExtrasModalOpen(true);
    }
  };

  const handleDeleteItem = (id, isCategory) => {
    if(window.confirm(t('pos.deleteConfirm'))) {
      if (isCategory) deleteCategory(id);
      else deleteProduct(id);
    }
  };

  // Manejador de confirmación del Modal de Extras
  const handleConfirmProduct = (product, modifications) => {
    addToCart(product, modifications);
  };

  // Guardar nuevo item (Categoría, Producto o Extra)
  const handleSaveNewItem = ({ type, data }) => {
    if (type === 'categoria') {
      addCategory(data);
    } else if (type === 'producto') {
      addProduct(data);
    } else if (type === 'extra') {
      addExtras(data);
    }
  };

  // Encontrar el nombre de la categoría actual si estamos dentro de una
  const currentCategoryName = currentCategoryId 
    ? categories.find(c => c.id === currentCategoryId)?.name 
    : null;

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-100px)]">
      
      {/* Barra de Herramientas del Grid */}
      <div className="flex items-center justify-between mb-4 px-2 pt-4">
        <div className="flex items-center gap-3">
          {currentCategoryId && (
            <button 
              onClick={() => setCurrentCategoryId(null)}
              className="btn-secondary p-2 flex items-center justify-center rounded-full"
              title={t('pos.backCategories')}
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {currentCategoryName ? currentCategoryName : t('pos.currentMenu')}
          </h2>
        </div>
      </div>

      {/* Grid de Items */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          
          {visibleItems.map(item => (
            <ItemCard 
              key={item.id} 
              item={item} 
              isCategory={item.price === undefined} 
              onClick={handleItemClick} 
              onDelete={handleDeleteItem}
              isClientMode={isClientMode}
            />
          ))}

          {/* Botón Nuevo + (Oculto en Modo Cliente) */}
          {!isClientMode && (
            <button 
              onClick={() => setIsNewItemModalOpen(true)}
              className="glass-card flex flex-col items-center justify-center p-4 h-48 border-dashed border-2 border-white/20 hover:border-orange-500/50 hover:bg-orange-500/5 hover:text-orange-400 text-slate-400 group"
            >
              <div className="w-12 h-12 rounded-full bg-black/20 flex items-center justify-center mb-3 group-hover:bg-orange-500/20 transition-colors">
                <Plus size={24} />
              </div>
              <span className="font-semibold text-lg">{t('pos.newItem')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Modales */}
      <NewItemModal 
        isOpen={isNewItemModalOpen} 
        onClose={() => setIsNewItemModalOpen(false)}
        onSave={handleSaveNewItem}
        currentCategoryId={currentCategoryId}
      />

      {selectedProduct && (
        <ExtrasModal 
          isOpen={isExtrasModalOpen}
          onClose={() => {
            setIsExtrasModalOpen(false);
            setSelectedProduct(null);
          }}
          product={selectedProduct}
          onConfirm={handleConfirmProduct}
          isClientMode={isClientMode}
        />
      )}
    </div>
  );
};

export default POSGrid;
