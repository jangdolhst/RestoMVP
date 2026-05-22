import { useState, useEffect, useCallback, useRef } from 'react';
import { Save, Upload, Image, Store, Loader2, CheckCircle2, AlertCircle, X, MapPin, Search, Plus, UserRound, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import PhoneInput from '../components/ui/PhoneInput';
import AddressMapPreview from '../components/ui/AddressMapPreview';

const AVAILABLE_CATEGORIES = [
  'Pizza', 'Hamburguesas', 'Sushi', 'Tacos', 'Mariscos',
  'Italiana', 'China', 'Postres', 'Café', 'Saludable',
  'BBQ', 'Pollo', 'Mexicana', 'Japonesa', 'Árabe'
];

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * WaitersSection — Subcomponente para gestionar lista de meseros.
 */
const WaitersSection = ({ waiters = [], onChange }) => {
  const [newName, setNewName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    if (waiters.includes(name)) return;
    onChange([...waiters, name]);
    setNewName('');
    setIsAdding(false);
  };

  const handleRemove = (name) => {
    onChange(waiters.filter((w) => w !== name));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') { setIsAdding(false); setNewName(''); }
  };

  return (
    <div className="glass-panel p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Meseros</h2>
          <p className="text-xs text-slate-400">Agrega meseros para asignarlos a las órdenes en el POS.</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-all"
          >
            <Plus size={14} />
            Añadir
          </button>
        )}
      </div>

      {/* Input para añadir */}
      {isAdding && (
        <div className="flex items-center gap-2 animate-fade-in">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="glass-input flex-1 py-2"
            placeholder="Nombre del mesero"
            maxLength={30}
            autoFocus
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-400 disabled:bg-white/5 disabled:text-slate-600 transition-all"
          >
            Guardar
          </button>
          <button
            onClick={() => { setIsAdding(false); setNewName(''); }}
            className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Lista de meseros */}
      {waiters.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {waiters.map((name) => (
            <div
              key={name}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-sm"
            >
              <UserRound size={14} className="text-orange-400" />
              <span className="text-white font-medium">{name}</span>
              <button
                onClick={() => handleRemove(name)}
                className="p-0.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title={`Eliminar ${name}`}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500 italic">No hay meseros agregados.</p>
      )}
    </div>
  );
};

const SettingsPage = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error' | null
  const [uploadingField, setUploadingField] = useState(null); // 'logo' | 'banner' | null

  const [isGeocoding, setIsGeocoding] = useState(false);
  const geocodeTimerRef = useRef(null);

  const [profile, setProfile] = useState({
    name: '',
    description: '',
    logo_url: '',
    banner_url: '',
    address: '',
    phone: '',
    categories: [],
    is_active: false,
    latitude: null,
    longitude: null,
    table_count: 0,
    waiters: [],
  });

  // Cargar perfil existente
  useEffect(() => {
    if (!user?.id) return;

    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('restaurant_profiles')
          .select('name, description, logo_url, banner_url, address, phone, categories, is_active, latitude, longitude, table_count, waiters')
          .eq('id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setProfile({
            name: data.name || '',
            description: data.description || '',
            logo_url: data.logo_url || '',
            banner_url: data.banner_url || '',
            address: data.address || '',
            phone: data.phone || '',
            categories: data.categories || [],
            is_active: data.is_active || false,
            latitude: data.latitude || null,
            longitude: data.longitude || null,
            table_count: data.table_count || 0,
            waiters: data.waiters || [],
          });
        }
      } catch (err) {
        console.error('Error cargando perfil:', err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user?.id]);

  const handleChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    setSaveStatus(null);
  };

  /**
   * Geocodificar la dirección usando Nominatim (OpenStreetMap).
   * Devuelve { lat, lng } o null si falla.
   */
  const runGeocode = useCallback(async (address) => {
    if (!address || address.trim().length < 5) return null;

    try {
      const encoded = encodeURIComponent(address.trim());
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1&addressdetails=0`,
        {
          headers: {
            'Accept': 'application/json',
            'Accept-Language': 'es',
          },
        }
      );

      if (!response.ok) {
        console.error('Nominatim HTTP error:', response.status);
        return null;
      }

      const results = await response.json();

      if (results && results.length > 0) {
        return {
          lat: parseFloat(results[0].lat),
          lng: parseFloat(results[0].lon),
        };
      }

      console.warn('Nominatim: sin resultados para:', address);
      return null;
    } catch (err) {
      console.error('Error geocodificando dirección:', err);
      return null;
    }
  }, []);

  /**
   * Geocodificación con debounce al teclear.
   */
  const geocodeWithDebounce = useCallback((address) => {
    if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);

    geocodeTimerRef.current = setTimeout(async () => {
      setIsGeocoding(true);
      const result = await runGeocode(address);
      if (result) {
        setProfile(prev => ({
          ...prev,
          latitude: result.lat,
          longitude: result.lng,
        }));
      }
      setIsGeocoding(false);
    }, 1500);
  }, [runGeocode]);

  /**
   * Auto-geocodificar al cargar si hay dirección pero no coordenadas.
   */
  useEffect(() => {
    if (isLoading) return;
    if (profile.address && profile.address.trim().length >= 5 && !profile.latitude && !profile.longitude) {
      const autoGeocode = async () => {
        setIsGeocoding(true);
        const result = await runGeocode(profile.address);
        if (result) {
          setProfile(prev => ({
            ...prev,
            latitude: result.lat,
            longitude: result.lng,
          }));
        }
        setIsGeocoding(false);
      };
      autoGeocode();
    }
  }, [isLoading, profile.address, profile.latitude, profile.longitude, runGeocode]);

  const handleAddressChange = (value) => {
    handleChange('address', value);
    geocodeWithDebounce(value);
  };

  /**
   * Botón manual para forzar geocodificación.
   */
  const handleManualGeocode = async () => {
    setIsGeocoding(true);
    const result = await runGeocode(profile.address);
    if (result) {
      setProfile(prev => ({
        ...prev,
        latitude: result.lat,
        longitude: result.lng,
      }));
    } else {
      alert('No se pudo encontrar la ubicación. Intenta con una dirección más específica (ej: incluye ciudad y país).');
    }
    setIsGeocoding(false);
  };

  const handleMapPositionChange = (lat, lng) => {
    setProfile(prev => ({ ...prev, latitude: lat, longitude: lng }));
    setSaveStatus(null);
  };

  const toggleCategory = (category) => {
    setProfile(prev => {
      const exists = prev.categories.includes(category);
      const updated = exists
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category];
      return { ...prev, categories: updated };
    });
    setSaveStatus(null);
  };

  const uploadImage = useCallback(async (file, type) => {
    if (!user?.id || !file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert('La imagen no debe superar los 2MB.');
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Solo se permiten imágenes JPG, PNG o WebP.');
      return;
    }

    setUploadingField(type);

    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/${type}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('restaurant-media')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('restaurant-media')
        .getPublicUrl(filePath);

      const urlField = type === 'logo' ? 'logo_url' : 'banner_url';
      setProfile(prev => ({ ...prev, [urlField]: urlData.publicUrl }));
      setSaveStatus(null);
    } catch (err) {
      console.error(`Error subiendo ${type}:`, err.message);
      alert(`Error al subir la imagen: ${err.message}`);
    } finally {
      setUploadingField(null);
    }
  }, [user?.id]);

  const handleSave = async () => {
    if (!user?.id) return;

    if (!profile.name.trim()) {
      alert('El nombre del negocio es obligatorio.');
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      const { error } = await supabase
        .from('restaurant_profiles')
        .upsert({
          id: user.id,
          name: profile.name.trim(),
          description: profile.description.trim(),
          logo_url: profile.logo_url,
          banner_url: profile.banner_url,
          address: profile.address.trim(),
          phone: profile.phone.trim(),
          categories: profile.categories,
          is_active: profile.is_active,
          latitude: profile.latitude,
          longitude: profile.longitude,
          table_count: profile.table_count,
          waiters: profile.waiters,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (error) throw error;
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Error guardando perfil:', err.message);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-orange-500" size={32} />
      </div>
    );
  }

  return (
    <div className="flex-1 w-full h-full overflow-y-auto p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Store size={24} className="text-orange-400" />
              Mi Negocio
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Configura tu perfil para aparecer en el directorio de restaurantes.
            </p>
          </div>
        </div>

        {/* Toggle Visibilidad */}
        <div className="glass-panel p-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Visible en el Directorio</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {profile.is_active
                ? 'Tu negocio aparece en el marketplace para los clientes.'
                : 'Tu negocio no es visible para los clientes aún.'}
            </p>
          </div>
          <button
            onClick={() => handleChange('is_active', !profile.is_active)}
            className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
              profile.is_active ? 'bg-emerald-500' : 'bg-white/10'
            }`}
            aria-label="Toggle visibilidad"
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
                profile.is_active ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Imágenes */}
        <div className="glass-panel p-5 space-y-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Image size={20} className="text-orange-400" />
            Imágenes
          </h2>

          {/* Banner */}
          <div>
            <label className="text-sm text-slate-300 font-medium mb-2 block">Portada / Banner</label>
            <div className="relative group rounded-xl overflow-hidden border border-white/10 h-40 bg-white/5">
              {profile.banner_url ? (
                <img
                  src={profile.banner_url}
                  alt="Banner"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-500">
                  <Upload size={24} className="mb-1" />
                  <span className="text-xs">Sube una imagen de portada</span>
                </div>
              )}
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                {uploadingField === 'banner' ? (
                  <Loader2 className="animate-spin text-white" size={24} />
                ) : (
                  <span className="text-white text-sm font-medium flex items-center gap-1">
                    <Upload size={16} /> Cambiar
                  </span>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(file, 'banner');
                  }}
                  disabled={uploadingField !== null}
                />
              </label>
            </div>
          </div>

          {/* Logo */}
          <div>
            <label className="text-sm text-slate-300 font-medium mb-2 block">Logo</label>
            <div className="flex items-center gap-4">
              <div className="relative group w-20 h-20 rounded-xl overflow-hidden border border-white/10 bg-white/5 shrink-0">
                {profile.logo_url ? (
                  <img
                    src={profile.logo_url}
                    alt="Logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500">
                    <Store size={24} />
                  </div>
                )}
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  {uploadingField === 'logo' ? (
                    <Loader2 className="animate-spin text-white" size={18} />
                  ) : (
                    <Upload size={16} className="text-white" />
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadImage(file, 'logo');
                    }}
                    disabled={uploadingField !== null}
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500">JPG, PNG o WebP. Máx 2MB.</p>
            </div>
          </div>
        </div>

        {/* Información */}
        <div className="glass-panel p-5 space-y-4">
          <h2 className="text-lg font-bold text-white">Información del Negocio</h2>

          <div>
            <label htmlFor="settings-name" className="text-sm text-slate-300 font-medium mb-1 block">
              Nombre del Negocio <span className="text-red-400">*</span>
            </label>
            <input
              id="settings-name"
              name="name"
              type="text"
              value={profile.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Ej: Taquería El Fogón"
              className="glass-input w-full"
              maxLength={80}
            />
          </div>

          <div>
            <label htmlFor="settings-description" className="text-sm text-slate-300 font-medium mb-1 block">
              Descripción
            </label>
            <textarea
              id="settings-description"
              name="description"
              value={profile.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Cuéntale a tus clientes qué hace especial tu negocio..."
              className="glass-input w-full resize-none h-20"
              maxLength={250}
            />
            <p className="text-xs text-slate-600 mt-1">{profile.description.length}/250</p>
          </div>

          <div>
            <label htmlFor="settings-address" className="text-sm text-slate-300 font-medium mb-1 block">
              <MapPin size={14} className="inline mr-1 text-orange-400" />
              Dirección
            </label>
            <div className="relative">
              <input
                id="settings-address"
                name="address"
                type="text"
                value={profile.address}
                onChange={(e) => handleAddressChange(e.target.value)}
                placeholder="Ej: Av. Reforma 123, Col. Centro, Ciudad de México"
                className="glass-input w-full pr-10"
                maxLength={200}
              />
              {isGeocoding && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 size={16} className="animate-spin text-orange-400" />
                </div>
              )}
            </div>
            {profile.latitude && profile.longitude && (
              <p className="text-xs text-emerald-400/80 mt-1 flex items-center gap-1">
                <CheckCircle2 size={12} />
                Ubicación detectada ({profile.latitude.toFixed(4)}, {profile.longitude.toFixed(4)})
              </p>
            )}
            {!profile.latitude && !profile.longitude && profile.address && profile.address.trim().length >= 5 && !isGeocoding && (
              <button
                type="button"
                onClick={handleManualGeocode}
                className="mt-2 text-xs text-orange-400 hover:text-orange-300 underline underline-offset-2 flex items-center gap-1 transition-colors"
              >
                <Search size={12} />
                Buscar ubicación manualmente
              </button>
            )}
            <AddressMapPreview
              latitude={profile.latitude}
              longitude={profile.longitude}
              onPositionChange={handleMapPositionChange}
            />
          </div>

          <div>
            <label className="text-sm text-slate-300 font-medium mb-1 block">
              Teléfono de Contacto
            </label>
            <PhoneInput
              value={profile.phone}
              onChange={(e164) => handleChange('phone', e164)}
              placeholder="Teléfono del negocio"
            />
          </div>

          {/* Cantidad de Mesas */}
          <div>
            <label className="text-sm text-slate-300 font-medium mb-1 block">
              Cantidad de Mesas
            </label>
            <p className="text-xs text-slate-500 mb-2">Configura cuántas mesas tiene tu local. Aparecerán en el POS como lista desplegable.</p>
            <input
              type="number"
              min="0"
              max="50"
              value={profile.table_count}
              onChange={(e) => handleChange('table_count', Math.max(0, Math.min(50, parseInt(e.target.value) || 0)))}
              className="glass-input w-32 py-2 text-center text-lg font-bold"
              placeholder="0"
            />
            <p className="text-xs text-slate-500 mt-1">{profile.table_count === 0 ? 'Sin mesas (solo pedidos para llevar)' : `${profile.table_count} mesa${profile.table_count > 1 ? 's' : ''} disponible${profile.table_count > 1 ? 's' : ''}`}</p>
          </div>
        </div>

        {/* Meseros */}
        <WaitersSection waiters={profile.waiters} onChange={(w) => handleChange('waiters', w)} />

        {/* Categorías */}
        <div className="glass-panel p-5 space-y-3">
          <h2 className="text-lg font-bold text-white">Categorías</h2>
          <p className="text-xs text-slate-400">Selecciona las que mejor describan tu negocio (para que los clientes te encuentren fácilmente).</p>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_CATEGORIES.map(cat => {
              const isSelected = profile.categories.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 ${
                    isSelected
                      ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20'
                      : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {isSelected && <span className="mr-1">✓</span>}
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Guardar */}
        <div className="flex items-center gap-3 pb-10">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary flex items-center gap-2 px-6 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
          </button>

          {saveStatus === 'success' && (
            <span className="flex items-center gap-1 text-emerald-400 text-sm font-medium animate-fade-in">
              <CheckCircle2 size={16} /> ¡Guardado correctamente!
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1 text-red-400 text-sm font-medium">
              <AlertCircle size={16} /> Error al guardar. Intenta de nuevo.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
