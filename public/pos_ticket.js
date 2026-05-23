(() => {
  'use strict';

  const errorEl = document.getElementById('ticket-error');
  const contentEl = document.getElementById('ticket-content');
  const printBtn = document.getElementById('ticket-print-btn');

  if (printBtn) {
    printBtn.addEventListener('click', () => window.print());
  }

  const showError = (message) => {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    contentEl.style.display = 'none';
  };

  const escapeHtml = (value) => {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
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

  const getOrderFromOpener = () => {
    try {
      if (window.opener && window.opener.__jfPrintData) {
        return window.opener.__jfPrintData;
      }
    } catch {
      // Ignore cross-origin opener restrictions.
    }

    try {
      if (window.__jfPrintData) {
        return window.__jfPrintData;
      }
    } catch {
      // Ignore access errors.
    }

    return null;
  };

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

    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const dateText = `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    const timeText = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    return { dateText, timeText };
  };

  const renderItems = (items, tbody) => {
    if (items.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center;padding:8px;color:#999;">Sin articulos</td>';
      tbody.appendChild(tr);
      return;
    }

    for (const item of items) {
      const qty = Number(item?.quantity) || 1;
      const name = item?.product_name || item?.name || 'Articulo';
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
      let nameHtml = escapeHtml(name);

      for (const mod of modifications) {
        if (!mod || !mod.name) continue;
        const sign = mod.type === 'extra' ? '+' : '-';
        const amount = mod.type === 'extra' && Number(mod.price) > 0
          ? ` ($${Number(mod.price).toFixed(2)})`
          : '';

        nameHtml += `<div class="mod-line">${sign} ${escapeHtml(mod.name)}${amount}</div>`;
      }

      nameCell.innerHTML = nameHtml;

      const priceCell = document.createElement('td');
      priceCell.className = 'col-price';
      priceCell.textContent = `$${subtotal.toFixed(2)}`;

      tr.appendChild(qtyCell);
      tr.appendChild(nameCell);
      tr.appendChild(priceCell);
      tbody.appendChild(tr);
    }
  };

  const renderTicket = (order) => {
    const orderNum = order.orderNumber || order.order_number || '0';
    const tableName = order.tableName || order.table_name || '';
    const clientName = order.clientName || order.client_name || 'Sin nombre';

    let typeText = 'PARA LLEVAR';
    if (order.type === 'online') {
      typeText = 'EN LINEA';
    } else if (tableName) {
      typeText = String(tableName).toUpperCase();
    }

    document.getElementById('tk-number').textContent = `#${orderNum}`;
    document.getElementById('tk-type').textContent = typeText;
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

    document.title = `Ticket #${orderNum} - ${clientName}`;
    contentEl.style.display = 'block';

    setTimeout(() => {
      window.print();
    }, 300);
  };

  try {
    const order = getOrderFromOpener() || getOrderFromTicketStorage();
    if (!order) {
      showError('No se encontraron datos del pedido. Cierra esta ventana e intenta de nuevo.');
      return;
    }

    renderTicket(order);
  } catch (error) {
    showError(`Error al renderizar: ${error?.message || 'desconocido'}`);
    // Leave a detailed trace for debugging in browser console only.
    console.error('Ticket render error:', error);
  }
})();
