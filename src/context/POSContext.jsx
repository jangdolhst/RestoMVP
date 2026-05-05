import { createContext, useContext, useState, useMemo, useEffect } from 'react';
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

  // --- Cargar datos iniciales ---
  useEffect(() => {
    const fetchData = async () => {
      if (!currentTenantId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      
      const [catsRes, prodsRes, extrasRes, ordsRes] = await Promise.all([
        supabase.from('categories').select('*').eq('tenant_id', currentTenantId).order('created_at', { ascending: true }),
        supabase.from('products').select('*').eq('tenant_id', currentTenantId).order('created_at', { ascending: true }),
        supabase.from('extras').select('*').eq('tenant_id', currentTenantId).order('created_at', { ascending: true }),
        supabase.from('orders').select(`*, items:order_items(*)`).eq('tenant_id', currentTenantId).order('created_at', { ascending: false })
      ]);

      if (catsRes.data) {
        // Mapear image_url a image para compatibilidad con UI
        setCategories(catsRes.data.map(c => ({ ...c, image: c.image_url })));
      }
      if (prodsRes.data) {
        setProducts(prodsRes.data.map(p => ({ ...p, image: p.image_url, categoryId: p.category_id })));
      }
      if (extrasRes.data) {
        setExtras(extrasRes.data);
      }
      if (ordsRes.data) {
        setOrders(ordsRes.data.map(o => ({
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

    // --- Suscripción a Realtime para órdenes ---
    if (!currentTenantId) return;

    const ordersSubscription = supabase
      .channel('public:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${currentTenantId}` }, async () => {
        // Al haber cambios, recargamos las órdenes
        const { data } = await supabase
          .from('orders')
          .select(`*, items:order_items(*)`)
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
  }, [currentTenantId]);

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
    
    const orderIsOnline = overrideIsOnline !== null ? overrideIsOnline : isOnline;

    let finalTableName = tableName || 'Sin Mesa';
    if (tableName && !tableName.toLowerCase().includes('mesa')) {
      finalTableName = `Mesa ${tableName}`;
    }

    const newOrderData = {
      tenant_id: currentTenantId,
      client_name: clientName || 'Sin Nombre',
      table_name: finalTableName,
      phone: phone || null,
      type: orderIsOnline ? 'online' : 'local',
      total: cartTotal,
      status: 'pendiente_cocina'
    };

    // Insertar orden
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert(newOrderData)
      .select()
      .single();

    if (orderError || !orderData) {
      console.error('Error creando orden:', orderError);
      return false;
    }

    // Insertar items
    const orderItemsData = cartItems.map(item => ({
      order_id: orderData.id,
      product_name: item.name,
      quantity: item.quantity,
      price: item.price,
      ingredients: item.ingredients,
      modifications: item.modifications
    }));

    await supabase.from('order_items').insert(orderItemsData);

    // Actualización local rápida
    const newOrderFull = { 
      ...orderData, 
      orderNumber: orderData.order_number,
      clientName: orderData.client_name,
      tableName: orderData.table_name,
      createdAt: orderData.created_at,
      items: orderItemsData 
    };
    setOrders(prev => [newOrderFull, ...prev]);

    clearCart();
    return true;
  };

  const updateOrderStatus = async (orderId, newStatus) => {
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
    deleteProduct
  };

  return <POSContext.Provider value={value}>{children}</POSContext.Provider>;
};
