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

export const generateESCReceipt = (order: any): string => {
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
  receipt += `Tgl: ${new Date().toLocaleString('id-ID')}\n`;
  receipt += `No : #${(order.id || '').slice(-6).toUpperCase()}\n`;
  receipt += `Plg: ${order.customerName || 'Umum'}\n`;
  receipt += '--------------------------------\n';
  
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
    if (origPrice > currPrice) {
      const itemSave = (origPrice - currPrice) * Number(i.quantity || 1);
      receipt += `${i.quantity} x ${currPrice.toLocaleString('id-ID')} (Hemat ${itemSave.toLocaleString('id-ID')})   ${(currPrice * i.quantity).toLocaleString('id-ID')}\n`;
    } else {
      receipt += `${i.quantity} x ${currPrice.toLocaleString('id-ID')}   ${(currPrice * i.quantity).toLocaleString('id-ID')}\n`;
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
  
  // Footer
  receipt += '\n' + ALIGN_CENTER;
  receipt += 'Terima Kasih atas Kunjungan Anda\n';
  receipt += 'Barang yang sudah dibeli tidak\n';
  receipt += 'dapat ditukar/dikembalikan\n\n\n\n';
  
  receipt += CUT_PAPER;
  
  return receipt;
};
