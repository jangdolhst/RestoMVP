import { Trash2 } from 'lucide-react';

const ItemCard = ({ item, isCategory, onClick, onDelete, isClientMode = false }) => {
  return (
    <div 
      className="glass-card flex flex-col items-center justify-center p-4 h-48 relative overflow-hidden group cursor-pointer"
    >
      {/* Botón de Eliminar (visible en hover y solo si no es cliente) */}
      {!isClientMode && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id, isCategory);
          }}
          className="absolute top-2 right-2 p-1.5 bg-red-500/20 text-red-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/40 z-10"
          title="Eliminar"
        >
          <Trash2 size={16} />
        </button>
      )}

      <div onClick={() => onClick(item)} className="w-full h-full flex flex-col items-center justify-center">
        {/* Indicador superior de tipo */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 group-hover:bg-orange-500/50 transition-colors z-20"></div>
        
        {/* Imagen en toda la mitad superior */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-black/40 flex items-center justify-center overflow-hidden">
          {item.image ? (
            <img src={item.image} alt={item.name} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
          ) : (
            <span className="text-slate-500 text-xs text-center px-2">Sin Imagen</span>
          )}
        </div>

        {/* Contenido desplazado hacia abajo */}
        <div className="mt-20 flex flex-col items-center justify-center w-full z-10 px-2">
          <h3 className="text-white font-semibold text-lg text-center leading-tight mb-1">
            {item.name}
          </h3>

          {/* Si es producto, mostramos precio y un resumen de ingredientes */}
          {!isCategory && (
            <div className="flex flex-col items-center mt-auto w-full">
              {item.ingredients && (
                <p className="text-xs text-slate-400 text-center truncate w-full px-2 mb-1">
                  {item.ingredients}
                </p>
              )}
              <span className="text-orange-400 font-bold bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                ${item.price}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemCard;
