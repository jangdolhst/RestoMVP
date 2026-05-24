import { createContext, useContext, useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const POSContext = createContext();

export const usePOS = () => {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error('usePOS debe ser usado dentro de un POSProvider');
  }
  return context;
};

export const POSProvider = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  
  // Extraer tenantId de la URL (para modo cliente)
  const isClientMenu = location.pathname.startsWith('/menu/');
  const urlTenantId = isClientMenu ? location.pathname.split('/')[2] : null;
  
  // El tenant activo es el de la URL (cliente) o el del dueño logueado
  const currentTenantId = urlTenantId || user?.id;

  // Estado desde Supabase
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [extras, setExtras] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estado del Carrito y UI
  const [cartItems, setCartItems] = useState([]);
  const [clientName, setClientName] = useState('');
  const [tableName, setTableName] = useState('');
  const [phone, setPhone] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [currentCategoryId, setCurrentCategoryId] = useState(null);
  const [tableCount, setTableCount] = useState(0);
  const [waiters, setWaiters] = useState([]);
  const [waiterName, setWaiterName] = useState('');
  const [restaurantProfile, setRestaurantProfile] = useState(null);
  const lastOrderTimeRef = useRef(0);
  const ORDER_THROTTLE_MS = 15000; // 15 segundos entre pedidos

  // Auto-fill desde perfil guardado (solo en modo cliente)
  useEffect(() => {
    if (!isClientMenu) return;
    try {
      const profile = JSON.parse(localStorage.getItem('resto_user_profile') || '{}');
      if (profile.name && !clientName) setClientName(profile.name);
      if (profile.phone && !phone) setPhone(profile.phone);
    } catch {
      // silenciar
    }
  }, [isClientMenu]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resetear categoría al entrar/salir de una tienda
  useEffect(() => {
    setCurrentCategoryId(null);
  }, [urlTenantId]);

  // --- Cargar datos iniciales ---
  useEffect(() => {
    const fetchData = async () => {
      if (!currentTenantId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      
      // Queries base (necesarias para todos: dueño y cliente)
      const baseQueries = [
        supabase.from('categories').select('id, tenant_id, name, image_url, created_at').eq('tenant_id', currentTenantId).order('created_at', { ascending: true }),
        supabase.from('products').select('id, tenant_id, category_id, name, price, ingredients, image_url, created_at').eq('tenant_id', currentTenantId).order('created_at', { ascending: true }),
        supabase.from('extras').select('id, tenant_id, name, price, created_at').eq('tenant_id', currentTenantId).order('created_at', { ascending: true }),
      ];

      // Cargar perfil del restaurante (para dueño)
      if (!isClientMenu) {
        supabase.from('restaurant_profiles').select('name, logo_url, address, phone, table_count, waiters, fiscal_number, tax_included, tax_rate').eq('id', currentTenantId).maybeSingle()
          .then(({ data }) => {
            if (data?.table_count != null) setTableCount(data.table_count);
            if (data?.waiters) setWaiters(data.waiters);
            if (data) setRestaurantProfile(data);
          });
      }

      // Solo el dueño necesita las órdenes (RLS bloquea al anon de todas formas)
      if (!isClientMenu) {
        baseQueries.push(
          supabase.from('orders').select('id, tenant_id, order_number, client_name, table_name, phone, type, total, status, created_at, items:order_items(id, product_name, quantity, price, ingredients, modifications)').eq('tenant_id', currentTenantId).order('created_at', { ascending: false })
        );
      }

      const results = await Promise.all(baseQueries);

      const [catsRes, prodsRes, extrasRes] = results;

      if (catsRes.data) {
        setCategories(catsRes.data.map(c => ({ ...c, image: c.image_url })));
      }
      if (prodsRes.data) {
        setProducts(prodsRes.data.map(p => ({ ...p, image: p.image_url, categoryId: p.category_id })));
      }
      if (extrasRes.data) {
        setExtras(extrasRes.data);
      }

      // Orders solo si el dueño las cargó
      if (!isClientMenu && results[3]?.data) {
        setOrders(results[3].data.map(o => ({
          ...o,
          orderNumber: o.order_number,
          clientName: o.client_name,
          tableName: o.table_name,
          createdAt: o.created_at
        })));
      }
      
      setIsLoading(false);
    };

    fetchData();

    // --- Suscripción a Realtime para órdenes (solo dueño, no cliente) ---
    if (!currentTenantId || isClientMenu) return;

    const ordersSubscription = supabase
      .channel('public:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${currentTenantId}` }, async () => {
        const { data } = await supabase
          .from('orders')
          .select('id, tenant_id, order_number, client_name, table_name, phone, type, total, status, created_at, items:order_items(id, product_name, quantity, price, ingredients, modifications)')
          .eq('tenant_id', currentTenantId)
          .order('created_at', { ascending: false });
        
        if (data) {
          setOrders(data.map(o => ({
            ...o,
            orderNumber: o.order_number,
            clientName: o.client_name,
            tableName: o.table_name,
            createdAt: o.created_at
          })));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersSubscription);
    };
  }, [currentTenantId, isClientMenu]);

  const cartTotal = useMemo(() => {
    return cartItems.reduce((total, item) => {
      const extraCost = item.modifications ? item.modifications.reduce((sum, mod) => sum + (Number(mod.price) || 0), 0) : 0;
      return total + ((item.price + extraCost) * item.quantity);
    }, 0);
  }, [cartItems]);

  const visibleItems = useMemo(() => {
    if (currentCategoryId) {
      return products.filter(p => p.categoryId === currentCategoryId);
    }
    const rootProducts = products.filter(p => p.categoryId === null);
    return [...categories, ...rootProducts];
  }, [currentCategoryId, categories, products]);

  // Acciones del Carrito (locales)
  const addToCart = (product, modifications = []) => {
    const newItem = {
      cartId: crypto.randomUUID(), 
      ...product,
      quantity: 1,
      modifications, 
    };
    setCartItems(prev => [...prev, newItem]);
  };

  const removeFromCart = (cartId) => {
    setCartItems(prev => prev.filter(item => item.cartId !== cartId));
  };

  const clearCart = () => {
    setCartItems([]);
    setClientName('');
    setTableName('');
    setPhone('');
    setIsOnline(false);
  };

  // Acciones de Órdenes (Supabase)
  const placeOrder = async (overrideIsOnline = null) => {
    if (cartItems.length === 0) return false;

    // Throttle: prevenir spam de pedidos (mínimo 15s entre cada uno)
    const now = Date.now();
    if (now - lastOrderTimeRef.current < ORDER_THROTTLE_MS) {
      return { success: false, error: 'Espera unos segundos antes de enviar otro pedido.' };
    }
    
    const orderIsOnline = overrideIsOnline !== null ? overrideIsOnline : isOnline;

    let finalTableName = tableName || 'Sin Mesa';
    if (tableName && !tableName.toLowerCase().includes('mesa')) {
      finalTableName = `Mesa ${tableName}`;
    }

    // Generar token secreto para seguimiento del cliente
    const orderToken = crypto.randomUUID();

    // Generar código de confirmación de 4 caracteres (sin chars ambiguos)
    const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const confirmationCode = Array.from({ length: 4 }, () =>
      CHARS[Math.floor(Math.random() * CHARS.length)]
    ).join('');

    // Status: online de cliente → pendiente_confirmacion, resto → pendiente_cocina
    const isOnlineClientOrder = isClientMenu && orderIsOnline;
    const initialStatus = isOnlineClientOrder ? 'pendiente_confirmacion' : 'pendiente_cocina';

    const newOrderData = {
      tenant_id: currentTenantId,
      client_name: clientName || 'Sin Nombre',
      table_name: finalTableName,
      waiter_name: waiterName || null,
      phone: phone || null,
      type: orderIsOnline ? 'online' : 'local',
      total: cartTotal,
      status: initialStatus,
      confirmation_code: isOnlineClientOrder ? confirmationCode : null,
      order_token: orderToken,
    };

    try {
      // INSERT sin .select() — el RLS de SELECT no aplica para anon
      const { error: orderError } = await supabase
        .from('orders')
        .insert(newOrderData);

      if (orderError) {
        console.error('Error creando orden:', orderError);
        return false;
      }

      // Para insertar order_items necesitamos el order_id.
      // Usamos el token para obtenerlo via RPC.
      const { data: createdOrders } = await supabase
        .rpc('get_orders_by_tokens', { tokens: [orderToken] });

      const createdOrder = createdOrders?.[0];
      if (!createdOrder) {
        console.error('No se pudo recuperar la orden creada');
        return false;
      }

      // Insertar items de la orden
      const orderItemsData = cartItems.map(item => ({
        order_id: createdOrder.id,
        product_name: item.name,
        quantity: item.quantity,
        price: item.price,
        ingredients: item.ingredients,
        modifications: item.modifications,
      }));

      await supabase.from('order_items').insert(orderItemsData);

      // Guardar token en localStorage para seguimiento
      if (isClientMenu) {
        try {
          const stored = JSON.parse(localStorage.getItem('resto_order_tokens') || '[]');
          stored.push({
            token: orderToken,
            timestamp: Date.now(),
            restaurantName: '',
          });
          // Mantener solo los últimos 20 tokens (limpieza automática)
          const trimmed = stored.slice(-20);
          localStorage.setItem('resto_order_tokens', JSON.stringify(trimmed));
        } catch {
          // localStorage no disponible — silenciar
        }
      }

      // Obtener teléfono del restaurante para WhatsApp (solo para órdenes online de cliente)
      let restaurantPhone = '';
      if (isOnlineClientOrder) {
        try {
          const { data: profile } = await supabase
            .from('restaurant_profiles')
            .select('phone, name')
            .eq('id', currentTenantId)
            .maybeSingle();
          restaurantPhone = profile?.phone || '';
        } catch {
          // silenciar
        }
      }

      // Actualización local (solo para dueño, no cliente)
      if (!isClientMenu) {
        const newOrderFull = { 
          ...newOrderData,
          id: createdOrder.id,
          orderNumber: createdOrder.order_number,
          clientName: newOrderData.client_name,
          tableName: newOrderData.table_name,
          createdAt: createdOrder.created_at,
          items: orderItemsData,
        };
        setOrders(prev => [newOrderFull, ...prev]);
      }

      // Guardar items para el modal de confirmación antes de limpiar
      const savedItems = [...cartItems];
      const savedTotal = cartTotal;
      clearCart();
      lastOrderTimeRef.current = Date.now();

      return {
        success: true,
        orderToken,
        confirmationCode: isOnlineClientOrder ? confirmationCode : null,
        orderNumber: createdOrder.order_number,
        restaurantPhone,
        items: savedItems,
        total: savedTotal,
      };
    } catch (err) {
      console.error('Error en placeOrder:', err);
      return false;
    }
  };

  const VALID_ORDER_STATUSES = ['pendiente_confirmacion', 'pendiente_cocina', 'listo', 'pagado', 'cancelado'];

  const updateOrderStatus = async (orderId, newStatus) => {
    if (!VALID_ORDER_STATUSES.includes(newStatus)) return;
    setOrders(prev => prev.map(order => 
      order.id === orderId ? { ...order, status: newStatus } : order
    ));
    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
  };

  // Acciones de Inventario (Supabase)
  const addCategory = async (data) => {
    if (!currentTenantId) return;
    const { data: newCat } = await supabase
      .from('categories')
      .insert({ tenant_id: currentTenantId, name: data.name, image_url: data.image })
      .select()
      .single();
    
    if (newCat) setCategories(prev => [...prev, { ...newCat, image: newCat.image_url }]);
  };

  const addProduct = async (data) => {
    if (!currentTenantId) return;
    const { data: newProd } = await supabase
      .from('products')
      .insert({
        tenant_id: currentTenantId,
        category_id: data.categoryId,
        name: data.name,
        price: data.price,
        ingredients: data.ingredients,
        image_url: data.image
      })
      .select()
      .single();
    
    if (newProd) setProducts(prev => [...prev, { ...newProd, image: newProd.image_url, categoryId: newProd.category_id }]);
  };

  const addExtras = async (extrasArray) => {
    if (!currentTenantId || !extrasArray.length) return;
    const insertData = extrasArray.map(extra => ({
      tenant_id: currentTenantId,
      name: extra.name,
      price: extra.price
    }));

    const { data: newExtras } = await supabase
      .from('extras')
      .insert(insertData)
      .select();

    if (newExtras) {
      setExtras(prev => [...prev, ...newExtras]);
    }
  };

  const updateExtra = async (id, newPrice) => {
    const { error } = await supabase
      .from('extras')
      .update({ price: newPrice })
      .eq('id', id);

    if (!error) {
      setExtras(prev => prev.map(ex => ex.id === id ? { ...ex, price: newPrice } : ex));
    }
  };

  const deleteExtra = async (id) => {
    const { error } = await supabase
      .from('extras')
      .delete()
      .eq('id', id);

    if (!error) {
      setExtras(prev => prev.filter(ex => ex.id !== id));
    }
  };

  const deleteCategory = async (id) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    setProducts(prev => prev.filter(p => p.categoryId !== id));
    await supabase.from('categories').delete().eq('id', id);
  };

  const deleteProduct = async (id) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    await supabase.from('products').delete().eq('id', id);
  };

  const value = {
    categories,
    products,
    extras,
    cartItems,
    clientName,
    setClientName,
    tableName,
    setTableName,
    phone,
    setPhone,
    isOnline,
    setIsOnline,
    cartTotal,
    currentCategoryId,
    setCurrentCategoryId,
    visibleItems,
    orders,
    isLoading,
    tableCount,
    waiters,
    waiterName,
    setWaiterName,
    addToCart,
    removeFromCart,
    clearCart,
    placeOrder,
    updateOrderStatus,
    addCategory,
    addProduct,
    addExtras,
    updateExtra,
    deleteExtra,
    deleteCategory,
    deleteProduct,
    restaurantProfile
  };

  return <POSContext.Provider value={value}>{children}</POSContext.Provider>;
};
