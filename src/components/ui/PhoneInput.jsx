import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import IntlTelInput from '@intl-tel-input/react';
import 'intl-tel-input/styles';

/**
 * PhoneInput — Componente reutilizable de input telefónico internacional.
 * Wrapper de intl-tel-input adaptado al diseño glassmorphism del Resto-MVP.
 * 
 * Props:
 *  - value: string (E.164 o raw)
 *  - onChange: (e164Number: string) => void
 *  - onValidityChange: (isValid: boolean) => void
 *  - placeholder: string
 *  - className: string (clases extra para el wrapper)
 */
const PhoneInput = ({ value, onChange, onValidityChange, placeholder = 'Ingresa tu celular', className = '' }) => {
  const ref = useRef(null);
  const [isValid, setIsValid] = useState(false);
  const [hasInput, setHasInput] = useState(false);

  // Detectar país del navegador
  const initialCountry = useMemo(() => {
    try {
      const lang = navigator.language || '';
      const parts = lang.split('-');
      if (parts.length >= 2 && parts[1].length === 2) {
        return parts[1].toLowerCase();
      }
      const langMap = { es: 'mx', en: 'us', pt: 'br', fr: 'fr', de: 'de', it: 'it', ja: 'jp', ko: 'kr', zh: 'cn', ru: 'ru', ar: 'sa' };
      return langMap[parts[0]?.toLowerCase()] || 'us';
    } catch {
      return 'us';
    }
  }, []);

  const onChangeRef = useRef(onChange);
  const onValidityChangeRef = useRef(onValidityChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onValidityChangeRef.current = onValidityChange;
  }, [onValidityChange]);

  const handleChangeNumber = useCallback((num) => {
    const safeNum = num || '';
    setHasInput(safeNum.trim().length > 0);
    if (safeNum !== value) {
      if (onChangeRef.current) onChangeRef.current(safeNum);
    }
  }, [value]);

  const handleChangeValidity = useCallback((valid) => {
    setIsValid(valid);
    // Comunicar validez al componente padre
    if (onValidityChangeRef.current) onValidityChangeRef.current(valid);
  }, []);

  return (
    <div className={`phone-input-wrapper ${className}`}>
      <IntlTelInput
        ref={ref}
        initialCountry={initialCountry}
        separateDialCode={true}
        countrySearch={true}
        loadUtils={() => import('intl-tel-input/utils')}
        onChangeNumber={handleChangeNumber}
        onChangeValidity={handleChangeValidity}
        value={value}
        inputProps={{
          placeholder,
          className: 'glass-input phone-field',
        }}
      />
      {hasInput && !isValid && (
        <small className="phone-hint invalid">✗ Número incompleto o inválido</small>
      )}
      {hasInput && isValid && (
        <small className="phone-hint valid">✓ Número válido</small>
      )}
    </div>
  );
};

export default PhoneInput;
