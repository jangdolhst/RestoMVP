import { useRef, useState, useCallback, useEffect } from 'react';
import IntlTelInput from '@intl-tel-input/react';
import 'intl-tel-input/styles';

/**
 * PhoneInput — Componente reutilizable de input telefónico internacional.
 * Wrapper de intl-tel-input adaptado al diseño glassmorphism del Resto-MVP.
 * 
 * Props:
 *  - value: string (E.164 o raw)
 *  - onChange: (e164Number: string) => void
 *  - placeholder: string
 *  - className: string (clases extra para el wrapper)
 */
const PhoneInput = ({ value, onChange, placeholder = 'Ingresa tu celular', className = '' }) => {
  const ref = useRef(null);
  const [isValid, setIsValid] = useState(true);
  const [hasInput, setHasInput] = useState(false);

  // Detectar país del navegador (mismo approach que SaaS-MVP)
  const detectCountry = () => {
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
  };

  const handleChangeNumber = useCallback((num) => {
    setHasInput(num.trim().length > 0);
    if (onChange) onChange(num);
  }, [onChange]);

  const handleChangeValidity = useCallback((valid) => {
    setIsValid(valid);
  }, []);

  // Sincronizar valor externo con la instancia ITI
  useEffect(() => {
    if (value && ref.current) {
      const instance = ref.current.getInstance?.();
      if (instance) {
        const currentNumber = instance.getNumber?.() || '';
        if (currentNumber !== value) {
          instance.setNumber?.(value);
        }
      }
    }
  }, [value]);

  return (
    <div className={`phone-input-wrapper ${className}`}>
      <IntlTelInput
        ref={ref}
        initialCountry={detectCountry()}
        separateDialCode={true}
        countrySearch={true}
        loadUtils={() => import('intl-tel-input/utils')}
        onChangeNumber={handleChangeNumber}
        onChangeValidity={handleChangeValidity}
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
