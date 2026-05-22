/**
 * Logo — Componente reutilizable de la marca "Jamm Free".
 * Usa assets separados: isotipo (icono JF) + tipografía (JAMM FREE).
 *
 * Props:
 *   - size: 'sm' | 'md' | 'lg' | 'xl' (default: 'md')
 *   - showText: boolean (default: true) — muestra la tipografía al lado del isotipo
 *   - iconOnly: boolean (default: false) — muestra solo el isotipo sin texto
 *   - className: string — clases CSS adicionales para el contenedor
 *   - onClick: function — handler opcional de clic
 */
const SIZES = {
  sm: { icon: 'h-8', text: 'h-3.5', pull: '-ml-0.5' },
  md: { icon: 'h-10', text: 'h-4', pull: '-ml-0.5' },
  lg: { icon: 'h-14', text: 'h-5', pull: '-ml-1' },
  xl: { icon: 'h-20', text: 'h-7', pull: '-ml-1' },
};

const Logo = ({ size = 'md', showText = true, iconOnly = false, className = '', onClick }) => {
  const s = SIZES[size] || SIZES.md;

  const content = (
    <div className={`flex items-center select-none ${className}`}>
      <img
        src="/assets/jamm-free-icon.png"
        alt="Jamm Free"
        className={`${s.icon} w-auto object-contain drop-shadow-lg`}
        draggable={false}
      />
      {showText && !iconOnly && (
        <img
          src="/assets/jamm-free-text.png"
          alt="JAMM FREE"
          className={`${s.text} ${s.pull} w-auto object-contain`}
          draggable={false}
        />
      )}
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="focus:outline-none"
        aria-label="Jamm Free"
      >
        {content}
      </button>
    );
  }

  return content;
};

export default Logo;
