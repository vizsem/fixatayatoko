// src/components/cart/CheckoutForms.tsx
import { useState } from 'react';
import {
  MapPin, Truck, Store, CreditCard, Banknote, Clock,
  Wallet, ShieldCheck, ExternalLink, Package, Check,
  Sparkles, ArrowRight
} from 'lucide-react';
import {
  ATAYATOKO_WAREHOUSE,
  DEFAULT_DELIVERY_METHODS,
  DeliveryMethodConfig,
  calculateDeliveryCost
} from '@/lib/shipping';

interface FormProps {
  customer: {
    name: string;
    phone: string;
    address: string;
  };
  setCustomer: (data: any) => void;
  deliveryMethod: 'pickup' | 'delivery';
  setDeliveryMethod: (m: 'pickup' | 'delivery') => void;
  selectedDeliveryId: string;
  setSelectedDeliveryId: (id: string) => void;
  subtotal: number;
  paymentMethod: 'cash' | 'transfer' | 'qris_bri' | 'wallet' | 'tempo';
  setPaymentMethod: (p: any) => void;
  tempoDueDate: string;
  setTempoDueDate: (d: string) => void;
  profileAddresses: any[];
  selectedAddressIndex: number;
  setSelectedAddressIndex: (i: number) => void;
  useProfileAddress: boolean;
  setUseProfileAddress: (v: boolean) => void;
  userData: any;
  customDeliveryMethods?: DeliveryMethodConfig[];
}

const idr = (n: number) => `Rp${Math.abs(n).toLocaleString('id-ID')}`;

export function CheckoutForms({
  customer, setCustomer, deliveryMethod, setDeliveryMethod,
  selectedDeliveryId, setSelectedDeliveryId, subtotal,
  paymentMethod, setPaymentMethod, tempoDueDate, setTempoDueDate,
  profileAddresses, selectedAddressIndex, setSelectedAddressIndex,
  useProfileAddress, setUseProfileAddress, userData,
  customDeliveryMethods
}: FormProps) {
  const deliveryList = customDeliveryMethods && customDeliveryMethods.length > 0
    ? customDeliveryMethods.filter(d => d.enabled)
    : DEFAULT_DELIVERY_METHODS.filter(d => d.enabled);

  const deliveryOnlyList = deliveryList.filter(d => d.type !== 'PICKUP');

  return (
    <div className="space-y-8">
      {/* 1. Address & Delivery Section */}
      <section className="bg-white rounded-3xl md:rounded-[2.5rem] p-5 sm:p-8 shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2.5">
            <MapPin size={18} className="text-rose-500" /> Metode & Alamat Pengiriman
          </h3>
          <span className="text-[11px] font-bold text-slate-500 hidden sm:inline">
            Gudang: {ATAYATOKO_WAREHOUSE.city}
          </span>
        </div>

        <div className="space-y-6">
          {/* Main Delivery Mode: Pickup vs Courier Delivery */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setDeliveryMethod('pickup');
                setSelectedDeliveryId('PICKUP');
              }}
              className={`flex-1 p-5 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 ${
                deliveryMethod === 'pickup'
                  ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                  : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <div className={`p-3 rounded-2xl ${deliveryMethod === 'pickup' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-400'}`}>
                <Store size={22} />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-slate-900">Ambil di Gudang</span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-full">
                100% GRATIS
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDeliveryMethod('delivery');
                if (selectedDeliveryId === 'PICKUP' || !selectedDeliveryId) {
                  setSelectedDeliveryId('KURIR_RING1');
                }
              }}
              className={`flex-1 p-5 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 ${
                deliveryMethod === 'delivery'
                  ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
                  : 'border-slate-100 bg-slate-50 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <div className={`p-3 rounded-2xl ${deliveryMethod === 'delivery' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-400'}`}>
                <Truck size={22} />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-slate-900">Kirim ke Alamat</span>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded-full">
                Kurir Toko / Ekspedisi
              </span>
            </button>
          </div>

          {/* Pickup Details Card */}
          {deliveryMethod === 'pickup' && (
            <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200 animate-in fade-in space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Store size={15} className="text-emerald-600" />
                    {ATAYATOKO_WAREHOUSE.name}
                  </h4>
                  <p className="text-xs text-slate-600 font-medium mt-1">
                    {ATAYATOKO_WAREHOUSE.address}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    Titik Presisi: ({ATAYATOKO_WAREHOUSE.latitude}, {ATAYATOKO_WAREHOUSE.longitude})
                  </p>
                </div>
                <a
                  href={ATAYATOKO_WAREHOUSE.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:border-emerald-500 text-emerald-700 rounded-xl text-[10px] font-black flex items-center gap-1.5 transition-all flex-shrink-0"
                >
                  <span>Google Maps</span>
                  <ExternalLink size={11} />
                </a>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-2xl text-[11px] font-bold">
                💡 Pesanan akan disiapkan oleh staf gudang dan siap diambil 1 jam setelah konfirmasi pembayaran.
              </div>
            </div>
          )}

          {/* Delivery Details & Option Selection */}
          {deliveryMethod === 'delivery' && (
            <div className="space-y-5 animate-in slide-in-from-top-3 duration-300">
              {/* Recipient Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 ml-2 mb-1.5 block">
                    Nama Penerima <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customer.name}
                    onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    placeholder="Contoh: Bpk. Ahmad"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 ml-2 mb-1.5 block">
                    No. WhatsApp / HP <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={customer.phone}
                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 ml-2 mb-1.5 block">
                  Alamat Lengkap Pengiriman <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  value={customer.address}
                  onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all h-24 resize-none leading-relaxed"
                  placeholder="Nama jalan, nomor rumah, RT/RW, kelurahan, kecamatan, dan patokan..."
                />
              </div>

              {/* Courier & Zone Selector */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <Truck size={15} className="text-emerald-600" />
                    Pilih Layanan Kurir & Radius Pengantaran
                  </label>
                  <span className="text-[11px] font-bold text-slate-500">
                    Dari Gudang Tamanan
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {deliveryOnlyList.map((method) => {
                    const isSelected = selectedDeliveryId === method.id;
                    const rate = calculateDeliveryCost(method, subtotal);

                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setSelectedDeliveryId(method.id)}
                        className={`p-4 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-500/20'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black text-slate-900">{method.name}</span>
                            </div>
                            {isSelected && <Check size={16} className="text-emerald-600 flex-shrink-0" />}
                          </div>

                          <p className="text-[10px] text-slate-500 font-medium line-clamp-2 leading-relaxed mb-2">
                            {method.description}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between mt-1">
                          <span className="text-[10px] font-bold text-slate-400">
                            ⏱️ {method.estimatedTime}
                          </span>

                          <div className="text-right">
                            {rate.isFree ? (
                              <div className="flex items-center gap-1 text-xs font-black text-emerald-600">
                                <Sparkles size={12} />
                                <span>GRATIS</span>
                              </div>
                            ) : (
                              <span className="text-xs font-black text-slate-800">
                                {idr(rate.finalCost)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Remaining amount banner for free delivery */}
                        {!rate.isFree && rate.remainingForFree > 0 && (
                          <div className="mt-2 text-[9px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                            Belanja {idr(rate.remainingForFree)} lagi untuk Gratis Ongkir
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 2. Payment Method Section */}
      <section className="bg-white rounded-3xl md:rounded-[2.5rem] p-5 sm:p-8 shadow-sm border border-slate-100">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-6 flex items-center gap-2.5">
          <Banknote size={18} className="text-emerald-600" /> Metode Pembayaran
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <PaymentOption active={paymentMethod === 'cash'} onClick={() => setPaymentMethod('cash')} icon={Banknote} label="Tunai / COD" />
          <PaymentOption active={paymentMethod === 'transfer'} onClick={() => setPaymentMethod('transfer')} icon={CreditCard} label="Transfer Bank" />
          <PaymentOption active={paymentMethod === 'qris_bri'} onClick={() => setPaymentMethod('qris_bri')} icon={Store} label="QRIS Instant" />
          <PaymentOption active={paymentMethod === 'wallet'} onClick={() => setPaymentMethod('wallet')} icon={Wallet} label="Saldo Ataya" />
          {userData?.canTempo && (
            <PaymentOption active={paymentMethod === 'tempo'} onClick={() => setPaymentMethod('tempo')} icon={Clock} label="Tempo Grosir" />
          )}
        </div>

        {paymentMethod === 'tempo' && (
          <div className="mt-6 animate-in zoom-in-95">
            <label className="text-xs font-bold text-slate-700 ml-2 mb-2 block">Jatuh Tempo</label>
            <input
              type="date"
              value={tempoDueDate}
              onChange={(e) => setTempoDueDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        )}
      </section>
    </div>
  );
}

function PaymentOption({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-3.5 sm:p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 group ${
        active
          ? 'border-emerald-600 bg-emerald-50/50 shadow-sm'
          : 'border-slate-200/80 bg-slate-50/60 hover:bg-white hover:border-slate-300'
      }`}
    >
      <Icon size={20} className={active ? 'text-emerald-700' : 'text-slate-400 group-hover:text-slate-600'} />
      <span className={`text-[11px] font-bold uppercase tracking-tight text-center ${active ? 'text-emerald-900' : 'text-slate-500'}`}>
        {label}
      </span>
    </button>
  );
}
