export const printToThermal = async (dataInput: string | Uint8Array) => {
  const nav = navigator as any;
  if (!nav.bluetooth) {
    throw new Error('Web Bluetooth API tidak didukung di browser ini.');
  }

  try {
    const device = await nav.bluetooth.requestDevice({
      filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }], // Typical thermal printer service
      optionalServices: ['e7810a71-73ae-499d-8c15-faa9aef0c3f2'] // Add other known services if needed
    });

    if (!device.gatt) throw new Error('GATT not available');

    const server = await device.gatt.connect();
    // Connect to the primary service
    const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
    // Assuming characteristic for writing is 00002af1-0000-1000-8000-00805f9b34fb
    const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

    let data: Uint8Array;
    if (typeof dataInput === 'string') {
      const encoder = new TextEncoder();
      data = encoder.encode(dataInput);
    } else {
      data = dataInput;
    }
    
    // Write in chunks of 512 bytes (common limit for BLE)
    const CHUNK_SIZE = 512;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      await characteristic.writeValue(chunk);
    }

    device.gatt.disconnect();
    return true;
  } catch (error) {
    console.error('Print Error:', error);
    throw error;
  }
};

export const generateESCReceipt = (order: any, options?: ReceiptOptions): string => {
  const ESC = '\x1B';
  const GS = '\x1D';
  const INIT = ESC + '@'; // Initialize printer
  const ALIGN_CENTER = ESC + 'a' + '\x01';
  const ALIGN_LEFT = ESC + 'a' + '\x00';
  const BOLD_ON = ESC + 'E' + '\x01';
  const BOLD_OFF = ESC + 'E' + '\x00';
  const CUT_PAPER = GS + 'V' + '\x00'; // Full cut
  
  let receipt = INIT;
  
  // Header
  receipt += ALIGN_CENTER + BOLD_ON + 'ATAYATOKO\n' + BOLD_OFF;
  receipt += 'Pusat Grosir & Eceran\nKediri - 085853161174\n';
  receipt += '--------------------------------\n';
  
  // Info
  receipt += ALIGN_LEFT;
  const is80mm = options?.paperWidth === '80mm';
  const divider = is80mm ? '------------------------------------------------\n' : '--------------------------------\n';
  const tglStr = order.createdAt 
    ? (order.createdAt instanceof Date ? order.createdAt.toLocaleString('id-ID') : new Date(order.createdAt).toLocaleString('id-ID'))
    : new Date().toLocaleString('id-ID');
  const noStruk = order.receiptNo || (order.dailySeq ? `#${String(order.dailySeq).padStart(4, '0')}` : `#${(order.id || '').slice(-6).toUpperCase()}`);
  receipt += `Tgl: ${tglStr}\n`;
  receipt += `No : ${noStruk}\n`;
  receipt += `Plg: ${order.customerName || 'Umum'}\n`;
  if (order.customerPhone) receipt += `HP : ${order.customerPhone}\n`;
  receipt += divider;
  
  let totalSavings = 0;
  order.items?.forEach((i: any) => {
    const origPrice = Number(i.originalPrice || i.price || 0);
    const currPrice = Number(i.price || 0);
    if (origPrice > currPrice) {
      totalSavings += (origPrice - currPrice) * Number(i.quantity || 1);
    }
  });

  // Items
  order.items?.forEach((i: any) => {
    receipt += `${i.name}\n`;
    const origPrice = Number(i.originalPrice || i.price || 0);
    const currPrice = Number(i.price || 0);
    const qty = Number(i.quantity || 1);
    const lineTotal = currPrice * qty;
    if (origPrice > currPrice) {
      const itemSave = (origPrice - currPrice) * qty;
      const qtyStr = Number.isInteger(qty) ? String(qty) : qty.toLocaleString('id-ID', { maximumFractionDigits: 3 });
      receipt += `${qtyStr} ${i.unit || 'PCS'} x ${currPrice.toLocaleString('id-ID')} [Normal ${origPrice.toLocaleString('id-ID')}]   ${lineTotal.toLocaleString('id-ID')}\n`;
      receipt += `  *Hemat: Rp ${itemSave.toLocaleString('id-ID')}\n`;
    } else {
      const qtyStr = Number.isInteger(qty) ? String(qty) : qty.toLocaleString('id-ID', { maximumFractionDigits: 3 });
      receipt += `${qtyStr} ${i.unit || 'PCS'} x ${currPrice.toLocaleString('id-ID')}   ${lineTotal.toLocaleString('id-ID')}\n`;
    }
  });
  
  receipt += '--------------------------------\n';
  if (totalSavings > 0) {
    const normalSubtotal = (order.subtotal || 0) + totalSavings;
    receipt += `Subtotal Normal  ${normalSubtotal.toLocaleString('id-ID')}\n`;
    receipt += `Hemat Grosir    -${totalSavings.toLocaleString('id-ID')}\n`;
  }
  receipt += `Subtotal         ${order.subtotal?.toLocaleString('id-ID')}\n`;
  if (order.shippingCost > 0) {
    receipt += `Ongkir           ${order.shippingCost.toLocaleString('id-ID')}\n`;
  }
  receipt += BOLD_ON + `TOTAL            ${order.total?.toLocaleString('id-ID')}\n` + BOLD_OFF;
  receipt += '--------------------------------\n';
  receipt += `Bayar (${order.paymentMethod})    ${order.payAmount?.toLocaleString('id-ID')}\n`;
  receipt += `Kembali          ${order.changeAmount?.toLocaleString('id-ID')}\n`;
  if (totalSavings > 0) {
    receipt += '--------------------------------\n';
    receipt += ALIGN_CENTER + BOLD_ON + `ANDA HEMAT: Rp ${totalSavings.toLocaleString('id-ID')}!\n` + BOLD_OFF + ALIGN_LEFT;
  }
  
  // Tempo info jika transaksi tempo
  if (String(order.paymentMethod || '').toUpperCase() === 'TEMPO') {
    receipt += divider;
    receipt += ALIGN_CENTER + BOLD_ON + 'NOTA BON GANTUNG (TEMPO)\n' + BOLD_OFF + ALIGN_LEFT;
    if (order.dueDate) {
      const dueStr = new Date(order.dueDate).toLocaleDateString('id-ID');
      receipt += `Jatuh Tempo: ${dueStr}\n`;
    }
    receipt += 'Tanda Tangan Pelanggan:\n\n\n';
    receipt += '(___________________________)\n';
  }

  // Footer promo jika ada
  if (options?.footerPromo) {
    receipt += divider;
    receipt += ALIGN_CENTER + `${options.footerPromo}\n` + ALIGN_LEFT;
  }

  // Footer & Eco Mode
  receipt += '\n' + ALIGN_CENTER;
  receipt += 'Terima Kasih atas Kunjungan Anda\n';
  receipt += 'Barang yang sudah dibeli tidak\n';
  receipt += 'dapat ditukar/dikembalikan\n';
  
  if (options?.ecoMode) {
    receipt += '\n\n';
  } else {
    receipt += '\n\n\n\n';
  }
  
  receipt += CUT_PAPER;
  
  return receipt;
};
export interface ReceiptOptions {
  paperWidth?: '58mm' | '80mm';
  ecoMode?: boolean;
  footerPromo?: string;
}

export const formatWhatsAppReceipt = (order: any, options?: ReceiptOptions): string => {
  const tglStr = order.createdAt 
    ? (order.createdAt instanceof Date ? order.createdAt.toLocaleString('id-ID') : new Date(order.createdAt).toLocaleString('id-ID'))
    : new Date().toLocaleString('id-ID');
  const noStruk = order.receiptNo || (order.dailySeq ? `#${String(order.dailySeq).padStart(4, '0')}` : `#${(order.id || '').slice(-6).toUpperCase()}`);
  
  let totalSavings = 0;
  (order.items || []).forEach((i: any) => {
    const origPrice = Number(i.originalPrice || i.price || 0);
    const currPrice = Number(i.price || 0);
    const qty = Number(i.quantity || 1);
    if (origPrice > currPrice) {
      totalSavings += (origPrice - currPrice) * qty;
    }
  });

  const payAmount = Number(order.payAmount || order.total || 0);
  const changeAmount = Number(order.changeAmount || 0);
  const isTempo = String(order.paymentMethod || '').toUpperCase() === 'TEMPO';

  let msg = `*ATAYATOKO - Pusat Grosir & Eceran*\n`;
  msg += `Kediri - WhatsApp: 085853161174\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `No. Struk : *${noStruk}*\n`;
  msg += `Tanggal   : ${tglStr}\n`;
  msg += `Pelanggan : ${order.customerName || 'Umum'}\n`;
  if (order.customerPhone) msg += `No. HP    : ${order.customerPhone}\n`;
  msg += `Pembayaran: *${order.paymentMethod || 'CASH'}*\n`;
  if (isTempo && order.dueDate) {
    const dueStr = new Date(order.dueDate).toLocaleDateString('id-ID');
    msg += `Jatuh Tempo : *${dueStr}* (BELUM LUNAS)\n`;
  }
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `*Rincian Belanja:*\n`;

  (order.items || []).forEach((i: any) => {
    const origPrice = Number(i.originalPrice || i.price || 0);
    const currPrice = Number(i.price || 0);
    const qty = Number(i.quantity || 1);
    const lineTotal = currPrice * qty;
    const itemSave = origPrice > currPrice ? (origPrice - currPrice) * qty : 0;
    const qtyStr = Number.isInteger(qty) ? String(qty) : qty.toLocaleString('id-ID', { maximumFractionDigits: 3 });

    msg += `• *${i.name}*\n`;
    if (itemSave > 0) {
      msg += `  ${qtyStr} ${i.unit || 'PCS'} x Rp${currPrice.toLocaleString('id-ID')} ~Rp${origPrice.toLocaleString('id-ID')}~ = *Rp${lineTotal.toLocaleString('id-ID')}*\n`;
      msg += `  _(Hemat Rp${itemSave.toLocaleString('id-ID')})_\n`;
    } else {
      msg += `  ${qtyStr} ${i.unit || 'PCS'} x Rp${currPrice.toLocaleString('id-ID')} = *Rp${lineTotal.toLocaleString('id-ID')}*\n`;
    }
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  if (totalSavings > 0) {
    const normalSub = (Number(order.subtotal || 0) + totalSavings);
    msg += `Subtotal Normal : Rp${normalSub.toLocaleString('id-ID')}\n`;
    msg += `Hemat Grosir    : -Rp${totalSavings.toLocaleString('id-ID')}\n`;
  }
  msg += `Subtotal        : Rp${Number(order.subtotal || 0).toLocaleString('id-ID')}\n`;
  if (Number(order.shippingCost || 0) > 0) {
    msg += `Ongkir          : Rp${Number(order.shippingCost).toLocaleString('id-ID')}\n`;
  }
  msg += `*TOTAL          : Rp${Number(order.total || 0).toLocaleString('id-ID')}*\n`;
  msg += `Bayar           : Rp${payAmount.toLocaleString('id-ID')}\n`;
  msg += `Kembali         : Rp${changeAmount.toLocaleString('id-ID')}\n`;

  if (totalSavings > 0) {
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🎉 *TOTAL PENGHEMATAN: Rp${totalSavings.toLocaleString('id-ID')}!*\n`;
  }

  if (options?.footerPromo) {
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📢 ${options.footerPromo}\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `Terima Kasih atas Kunjungan Anda!\n`;
  msg += `_Barang yang sudah dibeli tidak dapat ditukar/dikembalikan._`;

  return msg;
};
