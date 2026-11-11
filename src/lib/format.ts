/**
 * Helper untuk memformat nama produk menjadi Title Case yang rapi & profesional.
 * Jika nama produk diinput huruf kapital semua (ALL CAPS), diubah menjadi Title Case.
 * Contoh:
 * "TEPUNG BERAS PUTIH MAWAR 500GR - 500GR" -> "Tepung Beras Putih Mawar 500gr - 500gr"
 * "MINYAK GORENG SANIA 2L POUCH" -> "Minyak Goreng Sania 2l Pouch"
 */
export function formatProductName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (!trimmed) return '';

  // Cek apakah dominan uppercase
  const letters = trimmed.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 3) return trimmed;
  const upperCount = (letters.match(/[A-Z]/g) || []).length;
  // Jika huruf kapital > 60%, anggap ALL CAPS dan perlu dinormalkan
  const isAllUpper = upperCount / letters.length > 0.6;
  if (!isAllUpper) return trimmed;

  // Singkatan khusus yang dipertahankan tetap UPPERCASE
  const keepUpper = new Set([
    'SKU', 'PO', 'ID', 'BTP', 'PPN', 'PPH', 'BCA', 'BRI', 'BNI', 'QRIS', 'COD',
    'BPOM', 'SNI', 'PIRT', 'MUI', 'HALAL', 'EXP', 'MFG', 'HACCP', 'ISO', 'GMP',
    'XL', 'XXL', 'XXXL'
  ]);

  // Pisahkan berdasarkan spasi
  const words = trimmed.toLowerCase().split(' ');

  const formattedWords = words.map((w) => {
    if (!w) return '';

    // Handle kata dengan kurung atau tanda baca di awal/akhir
    let prefix = '';
    let suffix = '';
    let core = w;

    if (core.startsWith('(') || core.startsWith('[') || core.startsWith('{') || core.startsWith('"') || core.startsWith("'")) {
      prefix = core[0];
      core = core.slice(1);
    }
    if (core.endsWith(')') || core.endsWith(']') || core.endsWith('}') || core.endsWith('"') || core.endsWith("'") || core.endsWith(',') || core.endsWith('.')) {
      suffix = core.slice(-1);
      core = core.slice(0, -1);
    }

    if (!core) return `${prefix}${suffix}`;

    // Cek keepUpper
    const cleanCore = core.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (keepUpper.has(cleanCore)) {
      return `${prefix}${core.toUpperCase()}${suffix}`;
    }

    // Jika mengandung tanda strip "-" seperti "500gr-500gr"
    if (core.includes('-')) {
      const parts = core.split('-');
      const formattedParts = parts.map((p) => {
        if (!p) return '';
        const pClean = p.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (keepUpper.has(pClean)) return p.toUpperCase();
        return p.charAt(0).toUpperCase() + p.slice(1);
      });
      return `${prefix}${formattedParts.join('-')}${suffix}`;
    }

    // Jika mengandung slash "/" seperti "dus/40pcs"
    if (core.includes('/')) {
      const parts = core.split('/');
      const formattedParts = parts.map((p) => {
        if (!p) return '';
        const pClean = p.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        if (keepUpper.has(pClean)) return p.toUpperCase();
        return p.charAt(0).toUpperCase() + p.slice(1);
      });
      return `${prefix}${formattedParts.join('/')}${suffix}`;
    }

    // Pola angka + satuan: 500gr, 1kg, 250ml, 2l, 10x24g, 40pcs, dll.
    const unitMatch = core.match(/^(\d+(?:[xX]\d+)?)(kg|gr|g|ml|l|pcs|pack|ctn|btl|sachet|sak|box|lembar|butir)$/i);
    if (unitMatch) {
      return `${prefix}${unitMatch[1]}${unitMatch[2].toLowerCase()}${suffix}`;
    }

    // Title case standar: huruf pertama besar
    return `${prefix}${core.charAt(0).toUpperCase() + core.slice(1)}${suffix}`;
  });

  return formattedWords.join(' ');
}

