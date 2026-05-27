(() => {
  'use strict';

  const errorEl = document.getElementById('ticket-error');
  const contentEl = document.getElementById('ticket-content');
  const printBtn = document.getElementById('ticket-print-btn');

  const translations = {
    es: {
      documentTitle: 'Ticket de Pedido',
      printTicket: 'Imprimir Ticket',
      noItems: 'Sin articulos',
      itemFallback: 'Articulo',
      folio: 'Folio:',
      client: 'Cliente:',
      date: 'Fecha:',
      time: 'Hora:',
      waiter: 'Mesero:',
      qty: 'Cant',
      item: 'Articulo',
      subtotal: 'Subtotal',
      total: 'TOTAL',
      tax: 'Impuesto',
      taxIncluded: '* Impuesto incluido en el precio',
      takeout: 'PARA LLEVAR',
      online: 'EN LINEA',
      unnamed: 'Sin nombre',
      missingOrder: 'No se encontraron datos del pedido. Cierra esta ventana e intenta de nuevo.',
      renderError: 'Error al renderizar',
      unknown: 'desconocido',
      footerThanks: 'Gracias por tu preferencia',
      footerReturn: 'Te esperamos pronto',
    },
    en: {
      documentTitle: 'Order Ticket',
      printTicket: 'Print Ticket',
      noItems: 'No items',
      itemFallback: 'Item',
      folio: 'Folio:',
      client: 'Customer:',
      date: 'Date:',
      time: 'Time:',
      waiter: 'Waiter:',
      qty: 'Qty',
      item: 'Item',
      subtotal: 'Subtotal',
      total: 'TOTAL',
      tax: 'Tax',
      taxIncluded: '* Tax included in the price',
      takeout: 'TAKEOUT',
      online: 'ONLINE',
      unnamed: 'Unnamed',
      missingOrder: 'No order data was found. Close this window and try again.',
      renderError: 'Render error',
      unknown: 'unknown',
      footerThanks: 'Thank you for your preference',
      footerReturn: 'See you soon',
    },
  };

  const getLanguage = () => {
    try {
      return String(localStorage.getItem('i18nextLng') || '').toLowerCase().startsWith('en') ? 'en' : 'es';
    } catch {
      return 'es';
    }
  };

  const lang = getLanguage();
  const t = translations[lang];
  document.documentElement.lang = lang;
  document.title = t.documentTitle;

  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };

  setText('ticket-print-btn', t.printTicket);
  setText('tk-label-folio', t.folio);
  setText('tk-label-client', t.client);
  setText('tk-label-date', t.date);
  setText('tk-label-time', t.time);
  setText('tk-label-waiter', t.waiter);
  setText('tk-head-qty', t.qty);
  setText('tk-head-item', t.item);
  setText('tk-head-subtotal', t.subtotal);
  setText('tk-label-subtotal', t.subtotal);
  setText('tk-label-total', t.total);
  setText('tk-tax-note', t.taxIncluded);
  setText('tk-footer-thanks', t.footerThanks);
  setText('tk-footer-return', t.footerReturn);

  if (printBtn) {
    printBtn.addEventListener('click', () => window.print());
  }

  const showError = (message) => {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    contentEl.style.display = 'none';
  };

  const parseJson = (raw) => {
    if (typeof raw !== 'string' || raw.length === 0) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const isSafeTicketId = (value) => /^[a-zA-Z0-9_-]{1,80}$/.test(value);

  const getOrderFromTicketStorage = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const ticketId = urlParams.get('ticket');

    if (!ticketId || !isSafeTicketId(ticketId)) {
      return null;
    }

    const storageKey = `jf_print_order_${ticketId}`;
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    const parsed = parseJson(raw);
    localStorage.removeItem(storageKey);
    return parsed;
  };

  const normalizeItems = (items) => {
    const parsedItems = typeof items === 'string' ? parseJson(items) : items;
    if (!Array.isArray(parsedItems)) {
      return [];
    }

    return parsedItems;
  };

  const normalizeMods = (mods) => {
    const parsedMods = typeof mods === 'string' ? parseJson(mods) : mods;
    if (!Array.isArray(parsedMods)) {
      return [];
    }

    return parsedMods;
  };

  const formatDateParts = (rawDate) => {
    if (!rawDate) {
      return { dateText: '-', timeText: '-' };
    }

    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) {
      return { dateText: '-', timeText: '-' };
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const dateText = `${day}/${month}/${year}`;
    const timeText = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    return { dateText, timeText };
  };

  const renderItems = (items, tbody) => {
    if (items.length === 0) {
      const tr = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 3;
      emptyCell.style.textAlign = 'center';
      emptyCell.style.padding = '8px';
      emptyCell.style.color = '#999';
      emptyCell.textContent = t.noItems;
      tr.appendChild(emptyCell);
      tbody.appendChild(tr);
      return;
    }

    for (const item of items) {
      const qty = Number(item?.quantity) || 1;
      const name = item?.product_name || item?.name || t.itemFallback;
      const unitPrice = Number(item?.price) || 0;
      const modifications = normalizeMods(item?.modifications);

      const extrasTotal = modifications
        .filter((mod) => mod && mod.type === 'extra')
        .reduce((sum, mod) => sum + (Number(mod.price) || 0), 0);

      const subtotal = (unitPrice + extrasTotal) * qty;

      const tr = document.createElement('tr');

      const qtyCell = document.createElement('td');
      qtyCell.className = 'col-qty';
      qtyCell.textContent = `${qty}x`;

      const nameCell = document.createElement('td');
      nameCell.className = 'col-name';
      nameCell.append(document.createTextNode(String(name)));

      for (const mod of modifications) {
        if (!mod || !mod.name) continue;
        const sign = mod.type === 'extra' ? '+' : '-';
        const amount = mod.type === 'extra' && Number(mod.price) > 0
          ? ` ($${Number(mod.price).toFixed(2)})`
          : '';

        const modLine = document.createElement('div');
        modLine.className = 'mod-line';
        modLine.textContent = `${sign} ${mod.name}${amount}`;
        nameCell.appendChild(modLine);
      }

      const priceCell = document.createElement('td');
      priceCell.className = 'col-price';
      priceCell.textContent = `$${subtotal.toFixed(2)}`;

      tr.appendChild(qtyCell);
      tr.appendChild(nameCell);
      tr.appendChild(priceCell);
      tbody.appendChild(tr);
    }
  };

  /**
   * Renderizar encabezado del negocio (logo, nombre, RFC, dirección, teléfono).
   */
  const renderBusinessHeader = (profile) => {
    if (!profile) return;

    // Logo
    if (profile.logo_url) {
      const logoEl = document.getElementById('tk-logo');
      logoEl.src = profile.logo_url;
      logoEl.style.display = 'block';
    }

    // Nombre del negocio
    if (profile.name) {
      document.getElementById('tk-biz').textContent = profile.name.toUpperCase();
    }

    // Número Fiscal (RFC/NIT/RUC)
    if (profile.fiscal_number) {
      const fiscalEl = document.getElementById('tk-fiscal');
      fiscalEl.textContent = `RFC: ${profile.fiscal_number}`;
      fiscalEl.style.display = 'block';
    }

    // Dirección
    if (profile.address) {
      const addressEl = document.getElementById('tk-address');
      addressEl.textContent = profile.address;
      addressEl.style.display = 'block';
    }

    // Teléfono del negocio
    if (profile.phone) {
      const phoneEl = document.getElementById('tk-phone-biz');
      phoneEl.textContent = `Tel: ${profile.phone}`;
      phoneEl.style.display = 'block';
    }
  };

  /**
   * Renderizar desglose de impuestos (cálculo inverso: precio ya incluye impuesto).
   */
  const renderTaxBreakdown = (total, profile) => {
    if (!profile || !profile.tax_included || !profile.tax_rate || profile.tax_rate <= 0) {
      return;
    }

    const rate = Number(profile.tax_rate) / 100;
    const subtotal = total / (1 + rate);
    const tax = total - subtotal;

    // Mostrar Subtotal
    const subtotalRow = document.getElementById('tk-subtotal-row');
    document.getElementById('tk-subtotal').textContent = `$${subtotal.toFixed(2)}`;
    subtotalRow.style.display = 'flex';

    // Mostrar Impuesto
    const taxRow = document.getElementById('tk-tax-row');
    document.getElementById('tk-tax-label').textContent = `${t.tax} (${profile.tax_rate}%)`;
    document.getElementById('tk-tax-amount').textContent = `$${tax.toFixed(2)}`;
    taxRow.style.display = 'flex';

    // Nota legal
    document.getElementById('tk-tax-note').style.display = 'block';
  };

  const renderTicket = (order) => {
    // Renderizar datos del negocio
    renderBusinessHeader(order.restaurantProfile);

    const orderNum = order.orderNumber || order.order_number || '0';
    const tableName = order.tableName || order.table_name || '';
    const clientName = order.clientName || order.client_name || t.unnamed;

    // Folio formateado: TKT-000045
    const folioText = `TKT-${String(orderNum).padStart(6, '0')}`;

    let typeText = t.takeout;
    if (order.type === 'online') {
      typeText = t.online;
    } else if (tableName) {
      typeText = String(tableName).toUpperCase();
    }

    document.getElementById('tk-number').textContent = `#${orderNum}`;
    document.getElementById('tk-type').textContent = typeText;
    document.getElementById('tk-folio').textContent = folioText;
    document.getElementById('tk-client').textContent = clientName;

    const { dateText, timeText } = formatDateParts(order.createdAt || order.created_at);
    document.getElementById('tk-date').textContent = dateText;
    document.getElementById('tk-time').textContent = timeText;

    const waiter = order.waiterName || order.waiter_name || '';
    if (waiter) {
      document.getElementById('tk-waiter').textContent = waiter;
      document.getElementById('tk-waiter-row').style.display = 'flex';
    }

    const itemsBody = document.getElementById('tk-items');
    itemsBody.textContent = '';
    renderItems(normalizeItems(order.items), itemsBody);

    const total = Number(order.total) || 0;
    document.getElementById('tk-total').textContent = `$${total.toFixed(2)}`;

    // Desglose de impuestos
    renderTaxBreakdown(total, order.restaurantProfile);

    document.title = `${t.documentTitle} #${orderNum} - ${clientName}`;
    contentEl.style.display = 'block';

    setTimeout(() => {
      window.print();
    }, 300);
  };

  try {
    const order = getOrderFromTicketStorage();
    if (!order) {
      showError(t.missingOrder);
      return;
    }

    renderTicket(order);
  } catch (error) {
    showError(`${t.renderError}: ${error?.message || t.unknown}`);
    console.error('Ticket render error:', error);
  }
})();
