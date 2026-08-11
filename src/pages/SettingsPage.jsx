import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, Upload, Image, Store, Loader2, CheckCircle2, AlertCircle, X, MapPin, Search, Plus, UserRound, Clock, Receipt, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import PhoneInput from '../components/ui/PhoneInput';
import AddressMapPreview from '../components/ui/AddressMapPreview';
import FeatureGate from '../components/billing/FeatureGate';
import { PREMIUM_FEATURES, hasFeature } from '../lib/features';
import {
  DEFAULT_BUSINESS_TIMEZONE,
  deriveBusinessTimeZone,
  normalizeBusinessTimeZone,
} from '../lib/businessTimezone';

const WEEK_DAYS = [
  { id: 'monday', label: 'L' },
  { id: 'tuesday', label: 'M' },
  { id: 'wednesday', label: 'M' },
  { id: 'thursday', label: 'J' },
  { id: 'friday', label: 'V' },
  { id: 'saturday', label: 'S' },
  { id: 'sunday', label: 'D' }
];

const AVAILABLE_CATEGORIES = [
  { key: 'pizza', value: 'Pizza' },
  { key: 'burgers', value: 'Hamburguesas' },
  { key: 'sushi', value: 'Sushi' },
  { key: 'tacos', value: 'Tacos' },
  { key: 'seafood', value: 'Mariscos' },
  { key: 'italian', value: 'Italiana' },
  { key: 'chinese', value: 'China' },
  { key: 'desserts', value: 'Postres' },
  { key: 'coffee', value: 'Café' },
  { key: 'healthy', value: 'Saludable' },
  { key: 'bbq', value: 'BBQ' },
  { key: 'chicken', value: 'Pollo' },
  { key: 'mexican', value: 'Mexicana' },
  { key: 'japanese', value: 'Japonesa' },
  { key: 'arabic', value: 'Árabe' },
];

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

const toNullableNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * WaitersSection — Subcomponente para gestionar lista de meseros.
 */
const WaitersSection = ({ waiters = [], onChange }) => {
  const { t } = useTranslation();
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
          <h2 className="text-lg font-bold text-white">{t('settings.waiters')}</h2>
          <p className="text-xs text-slate-400">{t('settings.waitersHelp')}</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-all"
          >
            <Plus size={14} />
            {t('settings.add')}
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
            placeholder={t('settings.waiterName')}
            maxLength={30}
            autoFocus
          />
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-400 disabled:bg-white/5 disabled:text-slate-600 transition-all"
          >
            {t('common.actions.save')}
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
                title={t('settings.removeWaiter', { name })}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500 italic">{t('settings.noWaiters')}</p>
      )}
    </div>
  );
};

const SettingsPage = () => {
  const { user, subscriptionData } = useAuth();
  const { t } = useTranslation();
  const canUseFiscalData = hasFeature(subscriptionData, PREMIUM_FEATURES.fiscalData);
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
    fiscal_number: '',
    tax_included: false,
    tax_rate: 0,
    accepts_usd: false,
    usd_exchange_rate: '',
    business_timezone: DEFAULT_BUSINESS_TIMEZONE,
    delivery_service_mode: 'pickup_only',
    delivery_fee_mode: 'manual',
    delivery_fixed_fee_mxn: 0,
    delivery_base_fee_mxn: 0,
    delivery_fee_per_km_mxn: 0,
    delivery_max_distance_km: '',
    delivery_min_order_mxn: '',
    delivery_eta_min_minutes: '',
    delivery_eta_max_minutes: '',
    business_hours: { open: '09:00', close: '22:00', is_manually_closed: false },
  });

  // Cargar perfil existente
  useEffect(() => {
    if (!user?.id) return;

    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('restaurant_profiles')
          .select('name, description, logo_url, banner_url, address, phone, categories, is_active, latitude, longitude, table_count, waiters, fiscal_number, tax_included, tax_rate, accepts_usd, usd_exchange_rate, business_timezone, business_hours, delivery_service_mode, delivery_fee_mode, delivery_fixed_fee_mxn, delivery_base_fee_mxn, delivery_fee_per_km_mxn, delivery_max_distance_km, delivery_min_order_mxn, delivery_eta_min_minutes, delivery_eta_max_minutes')
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
            fiscal_number: data.fiscal_number || '',
            tax_included: data.tax_included || false,
            tax_rate: data.tax_rate || 0,
            accepts_usd: data.accepts_usd || false,
            usd_exchange_rate: data.usd_exchange_rate || '',
            business_timezone: normalizeBusinessTimeZone(data.business_timezone),
            delivery_service_mode: data.delivery_service_mode || 'pickup_only',
            delivery_fee_mode: data.delivery_fee_mode || 'manual',
            delivery_fixed_fee_mxn: data.delivery_fixed_fee_mxn ?? 0,
            delivery_base_fee_mxn: data.delivery_base_fee_mxn ?? 0,
            delivery_fee_per_km_mxn: data.delivery_fee_per_km_mxn ?? 0,
            delivery_max_distance_km: data.delivery_max_distance_km ?? '',
            delivery_min_order_mxn: data.delivery_min_order_mxn ?? '',
            delivery_eta_min_minutes: data.delivery_eta_min_minutes ?? '',
            delivery_eta_max_minutes: data.delivery_eta_max_minutes ?? '',
            business_hours: data.business_hours || { open: '09:00', close: '22:00', is_manually_closed: false },
          });
        }
      } catch (err) {
        console.error('Error cargando perfil:', err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user?.id, t]);

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
          business_timezone: deriveBusinessTimeZone(result.lat, result.lng, prev.business_timezone),
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
            business_timezone: deriveBusinessTimeZone(result.lat, result.lng, prev.business_timezone),
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
        business_timezone: deriveBusinessTimeZone(result.lat, result.lng, prev.business_timezone),
      }));
    } else {
      alert(t('settings.locationNotFound'));
    }
    setIsGeocoding(false);
  };

  /**
   * Obtener ubicación del dispositivo mediante GPS.
   */
  const handleGetDeviceLocation = () => {
    if (!navigator.geolocation) {
      alert(t('settings.gpsUnsupported'));
      return;
    }
    setIsGeocoding(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setProfile(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          business_timezone: deriveBusinessTimeZone(position.coords.latitude, position.coords.longitude, prev.business_timezone),
        }));
        setIsGeocoding(false);
      },
      (error) => {
        console.error("Error obteniendo ubicación:", error);
        alert(t('settings.gpsError'));
        setIsGeocoding(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleMapPositionChange = (lat, lng) => {
    setProfile(prev => ({
      ...prev,
      latitude: lat,
      longitude: lng,
      business_timezone: deriveBusinessTimeZone(lat, lng, prev.business_timezone),
    }));
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
      alert(t('settings.imageSize'));
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert(t('settings.imageType'));
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
      alert(t('settings.uploadError', { message: err.message }));
    } finally {
      setUploadingField(null);
    }
  }, [user?.id, t]);

  const handleSave = async () => {
    if (!user?.id) return;

    if (!profile.name.trim()) {
      alert(t('settings.nameRequired'));
      return;
    }

    if (profile.accepts_usd && Number(profile.usd_exchange_rate) <= 0) {
      alert(t('settings.paymentSettings.exchangeRateRequired'));
      return;
    }

    if (
      profile.delivery_fee_mode === 'per_km'
      && (!profile.latitude || !profile.longitude)
    ) {
      alert(t('settings.delivery.coordinatesRequired'));
      return;
    }

    if (profile.delivery_fee_mode === 'per_km' && Number(profile.delivery_fee_per_km_mxn) <= 0) {
      alert(t('settings.delivery.perKmRequired'));
      return;
    }

    if (Number(profile.delivery_fixed_fee_mxn) < 0
      || Number(profile.delivery_base_fee_mxn) < 0
      || Number(profile.delivery_fee_per_km_mxn) < 0
      || (profile.delivery_max_distance_km !== '' && Number(profile.delivery_max_distance_km) < 0)
      || (profile.delivery_min_order_mxn !== '' && Number(profile.delivery_min_order_mxn) < 0)
      || (profile.delivery_eta_min_minutes !== '' && Number(profile.delivery_eta_min_minutes) < 0)
      || (profile.delivery_eta_max_minutes !== '' && Number(profile.delivery_eta_max_minutes) < 0)
    ) {
      alert(t('settings.delivery.nonNegativeRequired'));
      return;
    }

    if (
      profile.delivery_eta_min_minutes !== ''
      && profile.delivery_eta_max_minutes !== ''
      && Number(profile.delivery_eta_max_minutes) < Number(profile.delivery_eta_min_minutes)
    ) {
      alert(t('settings.delivery.etaRangeInvalid'));
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      const profilePayload = {
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
        business_hours: profile.business_hours,
        business_timezone: normalizeBusinessTimeZone(profile.business_timezone),
        delivery_service_mode: profile.delivery_service_mode,
        delivery_fee_mode: profile.delivery_fee_mode,
        delivery_fixed_fee_mxn: Number(profile.delivery_fixed_fee_mxn) || 0,
        delivery_base_fee_mxn: Number(profile.delivery_base_fee_mxn) || 0,
        delivery_fee_per_km_mxn: Number(profile.delivery_fee_per_km_mxn) || 0,
        delivery_max_distance_km: toNullableNumber(profile.delivery_max_distance_km),
        delivery_min_order_mxn: toNullableNumber(profile.delivery_min_order_mxn),
        delivery_eta_min_minutes: toNullableNumber(profile.delivery_eta_min_minutes),
        delivery_eta_max_minutes: toNullableNumber(profile.delivery_eta_max_minutes),
        updated_at: new Date().toISOString(),
      };

      const { data: updatedProfile, error } = await supabase
        .from('restaurant_profiles')
        .update(profilePayload)
        .eq('id', user.id)
        .select('id')
        .maybeSingle();

      if (error) throw error;

      if (!updatedProfile) {
        const { error: insertError } = await supabase
          .from('restaurant_profiles')
          .insert({ id: user.id });

        if (insertError && insertError.code !== '23505') throw insertError;

        const { error: retryUpdateError } = await supabase
          .from('restaurant_profiles')
          .update(profilePayload)
          .eq('id', user.id);

        if (retryUpdateError) throw retryUpdateError;
      }

      const { error: paymentSettingsError } = await supabase
        .from('restaurant_profiles')
        .update({
          accepts_usd: profile.accepts_usd,
          usd_exchange_rate: profile.accepts_usd ? Number(profile.usd_exchange_rate) : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (paymentSettingsError) throw paymentSettingsError;

      if (canUseFiscalData) {
        const fiscalPayload = {
          p_fiscal_number: profile.fiscal_number.trim(),
          p_tax_included: profile.tax_included,
          p_tax_rate: profile.tax_rate,
        };
        const { error: fiscalError } = await supabase.rpc('update_restaurant_fiscal_settings', fiscalPayload);

        if (fiscalError) {
          const isMissingRpc = fiscalError.code === 'PGRST202'
            || /function|schema cache|Could not find/i.test(fiscalError.message || '');

          if (!isMissingRpc) throw fiscalError;

          // Backward-compatible fallback while the DB hardening migration is pending.
          const { error: fallbackError } = await supabase
            .from('restaurant_profiles')
            .update({
              fiscal_number: fiscalPayload.p_fiscal_number,
              tax_included: fiscalPayload.p_tax_included,
              tax_rate: fiscalPayload.p_tax_rate,
            })
            .eq('id', user.id);

          if (fallbackError) throw fallbackError;
        }
      }

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
              {t('navigation.myBusiness')}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {t('settings.subtitle')}
            </p>
          </div>
        </div>

        {/* Toggle Visibilidad */}
        <div className="glass-panel p-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">{t('settings.directoryVisible')}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {profile.is_active
                ? t('settings.directoryVisibleOn')
                : t('settings.hidden')}
            </p>
          </div>
          <button
            onClick={() => handleChange('is_active', !profile.is_active)}
            className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
              profile.is_active ? 'bg-emerald-500' : 'bg-white/10'
            }`}
            aria-label={t('settings.toggleVisibility')}
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
            {t('settings.images')}
          </h2>

          {/* Banner */}
          <div>
            <label className="text-sm text-slate-300 font-medium mb-2 block">{t('settings.banner')}</label>
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
                  <span className="text-xs">{t('settings.uploadBanner')}</span>
                </div>
              )}
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                {uploadingField === 'banner' ? (
                  <Loader2 className="animate-spin text-white" size={24} />
                ) : (
                  <span className="text-white text-sm font-medium flex items-center gap-1">
                    <Upload size={16} /> {t('modals.change')}
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
            <label className="text-sm text-slate-300 font-medium mb-2 block">{t('settings.logo')}</label>
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
              <p className="text-xs text-slate-500">{t('settings.imageHelp')}</p>
            </div>
          </div>
        </div>

        {/* Información */}
        <div className="glass-panel p-5 space-y-4">
          <h2 className="text-lg font-bold text-white">{t('settings.info')}</h2>

          <div>
            <label htmlFor="settings-name" className="text-sm text-slate-300 font-medium mb-1 block">
              {t('settings.businessName')} <span className="text-red-400">*</span>
            </label>
            <input
              id="settings-name"
              name="name"
              type="text"
              value={profile.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder={t('settings.businessNamePlaceholder')}
              className="glass-input w-full"
              maxLength={80}
            />
          </div>

          <div>
            <label htmlFor="settings-description" className="text-sm text-slate-300 font-medium mb-1 block">
              {t('settings.description')}
            </label>
            <textarea
              id="settings-description"
              name="description"
              value={profile.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder={t('settings.descriptionPlaceholder')}
              className="glass-input w-full resize-none h-20"
              maxLength={250}
            />
            <p className="text-xs text-slate-600 mt-1">{profile.description.length}/250</p>
          </div>

          <div>
            <label htmlFor="settings-address" className="text-sm text-slate-300 font-medium mb-1 block">
              <MapPin size={14} className="inline mr-1 text-orange-400" />
              {t('settings.address')}
            </label>
            <div className="relative">
              <input
                id="settings-address"
                name="address"
                type="text"
                value={profile.address}
                onChange={(e) => handleAddressChange(e.target.value)}
                placeholder={t('settings.addressPlaceholder')}
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
              <div className="mt-1 space-y-1">
                <p className="text-xs text-emerald-400/80 flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  {t('settings.detectLocation', { lat: profile.latitude.toFixed(4), lng: profile.longitude.toFixed(4) })}
                </p>
                <p className="text-xs text-slate-500">
                  {t('settings.businessTimezone')}: <span className="text-slate-300">{normalizeBusinessTimeZone(profile.business_timezone)}</span>
                </p>
                <p className="text-[11px] text-slate-600">
                  {t('settings.businessTimezoneHelp')}
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-3 mt-2">
              {!profile.latitude && !profile.longitude && profile.address && profile.address.trim().length >= 5 && !isGeocoding && (
                <button
                  type="button"
                  onClick={handleManualGeocode}
                  className="text-xs text-orange-400 hover:text-orange-300 underline underline-offset-2 flex items-center gap-1 transition-colors"
                >
                  <Search size={12} />
                  {t('settings.searchAddress')}
                </button>
              )}
              <button
                type="button"
                onClick={handleGetDeviceLocation}
                disabled={isGeocoding}
                className="text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2 flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                <MapPin size={12} />
                {t('settings.useGps')}
              </button>
            </div>
            <AddressMapPreview
              latitude={profile.latitude}
              longitude={profile.longitude}
              onPositionChange={handleMapPositionChange}
            />
          </div>

          <div>
            <label className="text-sm text-slate-300 font-medium mb-1 block">
              {t('settings.contactPhone')}
            </label>
            <PhoneInput
              value={profile.phone}
              onChange={(e164) => handleChange('phone', e164)}
              placeholder={t('settings.contactPhonePlaceholder')}
            />
          </div>

          {/* Cantidad de Mesas */}
          <div>
            <label className="text-sm text-slate-300 font-medium mb-1 block">
              {t('settings.tableCount')}
            </label>
            <p className="text-xs text-slate-500 mb-2">{t('settings.tableHelp')}</p>
            <input
              type="number"
              min="0"
              max="50"
              value={profile.table_count}
              onChange={(e) => handleChange('table_count', Math.max(0, Math.min(50, parseInt(e.target.value) || 0)))}
              className="glass-input w-32 py-2 text-center text-lg font-bold"
              placeholder="0"
            />
            <p className="text-xs text-slate-500 mt-1">
              {profile.table_count === 0
                ? t('settings.noTables')
                : t('settings.tableAvailable', { count: profile.table_count })}
            </p>
          </div>
        </div>

        {/* Configuración de Pagos */}
        <div className="glass-panel p-5 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Receipt size={20} className="text-emerald-400" />
            {t('settings.paymentSettings.title')}
          </h2>
          <p className="text-xs text-slate-400">{t('settings.paymentSettings.help')}</p>

          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
            <div>
              <h3 className="text-sm font-semibold text-white">{t('settings.paymentSettings.acceptUsd')}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{t('settings.paymentSettings.acceptUsdHelp')}</p>
            </div>
            <button
              onClick={() => handleChange('accepts_usd', !profile.accepts_usd)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
                profile.accepts_usd ? 'bg-emerald-500' : 'bg-white/10'
              }`}
              aria-label={t('settings.paymentSettings.toggleUsd')}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
                  profile.accepts_usd ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {profile.accepts_usd && (
            <div className="animate-fade-in">
              <label htmlFor="settings-usd-rate" className="text-sm text-slate-300 font-medium mb-1 block">
                {t('settings.paymentSettings.exchangeRate')}
              </label>
              <input
                id="settings-usd-rate"
                type="number"
                min="0.01"
                step="0.01"
                value={profile.usd_exchange_rate}
                onChange={(e) => handleChange('usd_exchange_rate', e.target.value)}
                className="glass-input w-40 py-2 text-center text-lg font-bold"
                placeholder="18.50"
              />
              <p className="text-xs text-slate-500 mt-1">
                {t('settings.paymentSettings.exchangeRateHelp')}
              </p>
            </div>
          )}
        </div>

        {/* Entrega a domicilio */}
        <div className="glass-panel p-5 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Truck size={20} className="text-sky-400" />
            {t('settings.delivery.title')}
          </h2>
          <p className="text-xs text-slate-400">{t('settings.delivery.help')}</p>

          <div>
            <label htmlFor="settings-delivery-service-mode" className="text-sm text-slate-300 font-medium mb-1 block">
              {t('settings.delivery.serviceMode')}
            </label>
            <select
              id="settings-delivery-service-mode"
              value={profile.delivery_service_mode}
              onChange={(e) => handleChange('delivery_service_mode', e.target.value)}
              className="glass-input w-full"
            >
              <option value="pickup_only">{t('settings.delivery.pickupOnly')}</option>
              <option value="delivery_only">{t('settings.delivery.deliveryOnly')}</option>
              <option value="pickup_and_delivery">{t('settings.delivery.pickupAndDelivery')}</option>
            </select>
          </div>

          {profile.delivery_service_mode !== 'pickup_only' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label htmlFor="settings-delivery-fee-mode" className="text-sm text-slate-300 font-medium mb-1 block">
                  {t('settings.delivery.feeMode')}
                </label>
                <select
                  id="settings-delivery-fee-mode"
                  value={profile.delivery_fee_mode}
                  onChange={(e) => handleChange('delivery_fee_mode', e.target.value)}
                  className="glass-input w-full"
                >
                  <option value="free">{t('settings.delivery.free')}</option>
                  <option value="fixed">{t('settings.delivery.fixed')}</option>
                  <option value="per_km">{t('settings.delivery.perKm')}</option>
                  <option value="manual">{t('settings.delivery.manual')}</option>
                </select>
              </div>

              {profile.delivery_fee_mode === 'fixed' && (
                <div>
                  <label htmlFor="settings-delivery-fixed-fee" className="text-sm text-slate-300 font-medium mb-1 block">
                    {t('settings.delivery.fixedFee')}
                  </label>
                  <input
                    id="settings-delivery-fixed-fee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={profile.delivery_fixed_fee_mxn}
                    onChange={(e) => handleChange('delivery_fixed_fee_mxn', e.target.value)}
                    className="glass-input w-40 py-2 text-center text-lg font-bold"
                  />
                </div>
              )}

              {profile.delivery_fee_mode === 'per_km' && (
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="settings-delivery-base-fee" className="text-sm text-slate-300 font-medium mb-1 block">
                      {t('settings.delivery.baseFee')}
                    </label>
                    <input
                      id="settings-delivery-base-fee"
                      type="number"
                      min="0"
                      step="0.01"
                      value={profile.delivery_base_fee_mxn}
                      onChange={(e) => handleChange('delivery_base_fee_mxn', e.target.value)}
                      className="glass-input w-full py-2 text-center font-bold"
                    />
                  </div>
                  <div>
                    <label htmlFor="settings-delivery-per-km-fee" className="text-sm text-slate-300 font-medium mb-1 block">
                      {t('settings.delivery.feePerKm')}
                    </label>
                    <input
                      id="settings-delivery-per-km-fee"
                      type="number"
                      min="0"
                      step="0.01"
                      value={profile.delivery_fee_per_km_mxn}
                      onChange={(e) => handleChange('delivery_fee_per_km_mxn', e.target.value)}
                      className="glass-input w-full py-2 text-center font-bold"
                    />
                  </div>
                  <div>
                    <label htmlFor="settings-delivery-radius" className="text-sm text-slate-300 font-medium mb-1 block">
                      {t('settings.delivery.maxRadius')}
                    </label>
                    <input
                      id="settings-delivery-radius"
                      type="number"
                      min="0"
                      step="0.1"
                      value={profile.delivery_max_distance_km}
                      onChange={(e) => handleChange('delivery_max_distance_km', e.target.value)}
                      className="glass-input w-full py-2 text-center font-bold"
                      placeholder="10"
                    />
                  </div>
                </div>
              )}

              {profile.delivery_fee_mode === 'manual' && (
                <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                  {t('settings.delivery.manualHelp')}
                </p>
              )}

              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="settings-delivery-min-order" className="text-sm text-slate-300 font-medium mb-1 block">
                    {t('settings.delivery.minOrder')}
                  </label>
                  <input
                    id="settings-delivery-min-order"
                    type="number"
                    min="0"
                    step="0.01"
                    value={profile.delivery_min_order_mxn}
                    onChange={(e) => handleChange('delivery_min_order_mxn', e.target.value)}
                    className="glass-input w-full py-2 text-center font-bold"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label htmlFor="settings-delivery-eta-min" className="text-sm text-slate-300 font-medium mb-1 block">
                    {t('settings.delivery.etaMin')}
                  </label>
                  <input
                    id="settings-delivery-eta-min"
                    type="number"
                    min="0"
                    step="1"
                    value={profile.delivery_eta_min_minutes}
                    onChange={(e) => handleChange('delivery_eta_min_minutes', e.target.value)}
                    className="glass-input w-full py-2 text-center font-bold"
                    placeholder="25"
                  />
                </div>
                <div>
                  <label htmlFor="settings-delivery-eta-max" className="text-sm text-slate-300 font-medium mb-1 block">
                    {t('settings.delivery.etaMax')}
                  </label>
                  <input
                    id="settings-delivery-eta-max"
                    type="number"
                    min="0"
                    step="1"
                    value={profile.delivery_eta_max_minutes}
                    onChange={(e) => handleChange('delivery_eta_max_minutes', e.target.value)}
                    className="glass-input w-full py-2 text-center font-bold"
                    placeholder="45"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Meseros */}
        <WaitersSection waiters={profile.waiters} onChange={(w) => handleChange('waiters', w)} />

        <FeatureGate
          feature={PREMIUM_FEATURES.fiscalData}
          title={t('premium.features.fiscalData.title')}
          description={t('premium.features.fiscalData.description')}
        >
          {/* Datos Fiscales */}
          <div className="glass-panel p-5 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Receipt size={20} className="text-orange-400" />
              {t('settings.fiscalData')}
            </h2>
            <p className="text-xs text-slate-400">{t('settings.fiscalHelp')}</p>

            <div>
              <label htmlFor="settings-fiscal" className="text-sm text-slate-300 font-medium mb-1 block">
                {t('settings.fiscalNumber')}
              </label>
              <input
                id="settings-fiscal"
                type="text"
                value={profile.fiscal_number}
                onChange={(e) => handleChange('fiscal_number', e.target.value.toUpperCase())}
                placeholder={t('settings.fiscalPlaceholder')}
                className="glass-input w-full"
                maxLength={20}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
              <div>
                <h3 className="text-sm font-semibold text-white">{t('settings.taxBreakdown')}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{t('settings.taxHelp')}</p>
              </div>
              <button
                onClick={() => handleChange('tax_included', !profile.tax_included)}
                className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${
                  profile.tax_included ? 'bg-emerald-500' : 'bg-white/10'
                }`}
                aria-label={t('settings.toggleTaxes')}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${
                    profile.tax_included ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {profile.tax_included && (
              <div className="animate-fade-in">
                <label htmlFor="settings-tax-rate" className="text-sm text-slate-300 font-medium mb-1 block">
                  {t('settings.taxPercent')}
                </label>
                <input
                  id="settings-tax-rate"
                  type="number"
                  min="0"
                  max="30"
                  step="0.5"
                  value={profile.tax_rate}
                  onChange={(e) => handleChange('tax_rate', Math.max(0, Math.min(30, parseFloat(e.target.value) || 0)))}
                  className="glass-input w-32 py-2 text-center text-lg font-bold"
                  placeholder="16"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {profile.tax_rate > 0
                    ? t('settings.taxIncluded', { rate: profile.tax_rate })
                    : t('settings.taxPrompt')}
                </p>
              </div>
            )}
          </div>
        </FeatureGate>

        {/* Horario de Operación */}
        <div className="glass-panel p-5 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock size={20} className="text-orange-400" />
            {t('settings.businessHours')}
          </h2>
          <p className="text-xs text-slate-400">
            {t('settings.businessHoursHelp')}
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="settings-open" className="text-sm text-slate-300 font-medium mb-1 block">
                {t('settings.openTime')}
              </label>
              <input
                id="settings-open"
                type="time"
                value={profile.business_hours?.open || '09:00'}
                onChange={(e) => handleChange('business_hours', { ...profile.business_hours, open: e.target.value })}
                className="glass-input w-full py-2.5 text-center text-lg font-bold"
              />
            </div>
            <div>
              <label htmlFor="settings-close" className="text-sm text-slate-300 font-medium mb-1 block">
                {t('settings.closeTime')}
              </label>
              <input
                id="settings-close"
                type="time"
                value={profile.business_hours?.close || '22:00'}
                onChange={(e) => handleChange('business_hours', { ...profile.business_hours, close: e.target.value })}
                className="glass-input w-full py-2.5 text-center text-lg font-bold"
              />
            </div>
          </div>

          {/* Selector de Días Hábiles */}
          <div className="mt-4">
            <label className="text-sm text-slate-300 font-medium mb-2 block">
              {t('settings.openDays')}
            </label>
            <div className="flex items-center gap-1.5 sm:gap-2 justify-between bg-black/20 p-2 rounded-xl border border-white/5">
              {WEEK_DAYS.map((day) => {
                const currentDays = profile.business_hours?.days || {
                  monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: true, sunday: true
                };
                const isActive = currentDays[day.id] !== false; // true por defecto
                
                return (
                  <button
                    key={day.id}
                    onClick={() => {
                      const newDays = { ...currentDays, [day.id]: !isActive };
                      handleChange('business_hours', { ...profile.business_hours, days: newDays });
                    }}
                    className={`flex-1 aspect-square max-w-[40px] rounded-lg flex items-center justify-center font-bold text-sm sm:text-base transition-all duration-300 ${
                      isActive 
                        ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                        : 'bg-white/5 text-slate-500 hover:bg-white/10 hover:text-slate-300'
                    }`}
                  >
                    {t(`settings.weekDaysShort.${day.id}`, { defaultValue: day.label })}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            {t('settings.currentHours')} <span className="text-white font-medium">{profile.business_hours?.open || '09:00'}</span> - <span className="text-white font-medium">{profile.business_hours?.close || '22:00'}</span>
          </p>

          {/* Botón de cierre manual */}
          <button
            onClick={() => handleChange('business_hours', {
              ...profile.business_hours,
              is_manually_closed: !profile.business_hours?.is_manually_closed,
            })}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold border transition-all duration-300 ${
              profile.business_hours?.is_manually_closed
                ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
                : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
            }`}
          >
            {profile.business_hours?.is_manually_closed ? (
              <>
                <X size={16} />
                {t('settings.manualClosed')}
              </>
            ) : (
              <>
                <Clock size={16} />
                {t('settings.pauseService')}
              </>
            )}
          </button>
          {profile.business_hours?.is_manually_closed && (
            <p className="text-xs text-red-400/80 text-center animate-fade-in">
              {t('settings.manualClosedWarning')}
            </p>
          )}
        </div>

        {/* Categorías */}
        <div className="glass-panel p-5 space-y-3">
          <h2 className="text-lg font-bold text-white">{t('settings.categories')}</h2>
          <p className="text-xs text-slate-400">{t('settings.categoriesHelp')}</p>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_CATEGORIES.map(cat => {
              const isSelected = profile.categories.includes(cat.value);
              return (
                <button
                  key={cat.value}
                  onClick={() => toggleCategory(cat.value)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 ${
                    isSelected
                      ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/20'
                      : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {isSelected && <span className="mr-1">✓</span>}
                  {t(`marketplace.categories.${cat.key}`)}
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
            {isSaving ? t('settings.saving') : t('settings.saveChanges')}
          </button>

          {saveStatus === 'success' && (
            <span className="flex items-center gap-1 text-emerald-400 text-sm font-medium animate-fade-in">
              <CheckCircle2 size={16} /> {t('settings.saved')}
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-1 text-red-400 text-sm font-medium">
              <AlertCircle size={16} /> {t('settings.saveError')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
