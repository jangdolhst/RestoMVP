/**
 * Logo — Componente reutilizable de la marca "Jamm Free".
 * Carga la imagen PNG transparente del logotipo original
 * con soporte para 3 tamaños predefinidos.
 *
 * Props:
 *   - size: 'sm' | 'md' | 'lg' (default: 'md')
 *   - showText: boolean (default: true) — muestra el nombre "Jamm Free" al lado
 *   - className: string — clases CSS adicionales para el contenedor
 *   - onClick: function — handler opcional de clic
 */
const SIZES = {
  sm: { img: 'w-8 h-8', text: 'text-lg', sub: 'text-[9px]' },
  md: { img: 'w-10 h-10', text: 'text-xl', sub: 'text-[10px]' },
  lg: { img: 'w-16 h-16', text: 'text-3xl', sub: 'text-xs' },
};

const Logo = ({ size = 'md', showText = true, className = '', onClick }) => {
  const s = SIZES[size] || SIZES.md;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 select-none focus:outline-none ${className}`}
      aria-label="Jamm Free"
    >
      <img
        src="/assets/jamm-free-logo.png"
        alt="Jamm Free logo"
        className={`${s.img} object-contain drop-shadow-lg`}
        draggable={false}
      />
      {showText && (
        <div className="flex flex-col leading-none">
          <span className={`font-extrabold tracking-tight text-white ${s.text}`}>
            Jamm<span className="text-orange-400"> Free</span>
          </span>
          <span className={`font-medium tracking-widest uppercase text-slate-400 ${s.sub}`}>
            Easy Collection
          </span>
        </div>
      )}
    </button>
  );
};

export default Logo;
