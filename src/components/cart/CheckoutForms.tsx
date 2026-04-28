import { MapPin, Truck, Store, CreditCard, Banknote, Clock, Wallet } from 'lucide-react';

interface FormProps {
  customer: {
    name: string;
    phone: string;
    address: string;
  };
  setCustomer: (data: any) => void;
  deliveryMethod: 'pickup' | 'delivery';
  setDeliveryMethod: (m: 'pickup' | 'delivery') => void;
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
}

export function CheckoutForms({ 
  customer, setCustomer, deliveryMethod, setDeliveryMethod, 
  paymentMethod, setPaymentMethod, tempoDueDate, setTempoDueDate,
  profileAddresses, selectedAddressIndex, setSelectedAddressIndex,
  useProfileAddress, setUseProfileAddress, userData
}: FormProps) {
  return (
    <div className="space-y-8">
      {/* 1. Address Section */}
      <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
         <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-8 flex items-center gap-3">
           <MapPin size={18} className="text-rose-500" /> Delivery Information
         </h3>
         
         <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-300 ml-4 mb-2 block">Full Name</label>
                  <input 
                    type="text" 
                    value={customer.name} 
                    onChange={e => setCustomer({...customer, name: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                    placeholder="Recipient Name"
                  />
               </div>
               <div>
                  <label className="text-[10px] font-black uppercase text-slate-300 ml-4 mb-2 block">WhatsApp Number</label>
                  <input 
                    type="text" 
                    value={customer.phone} 
                    onChange={e => setCustomer({...customer, phone: e.target.value})}
                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                    placeholder="08xxxx"
                  />
               </div>
            </div>

            <div className="flex gap-4">
               <button 
                 onClick={() => setDeliveryMethod('pickup')}
                 className={`flex-1 p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 ${deliveryMethod === 'pickup' ? 'border-green-600 bg-green-50/30' : 'border-slate-50 bg-slate-50 text-slate-400'}`}
               >
                 <Store size={24} />
                 <span className="text-[10px] font-black uppercase tracking-widest">Self Pickup</span>
               </button>
               <button 
                 onClick={() => setDeliveryMethod('delivery')}
                 className={`flex-1 p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 ${deliveryMethod === 'delivery' ? 'border-green-600 bg-green-50/30' : 'border-slate-50 bg-slate-50 text-slate-400'}`}
               >
                 <Truck size={24} />
                 <span className="text-[10px] font-black uppercase tracking-widest">Courier Delivery</span>
               </button>
            </div>

            {deliveryMethod === 'delivery' && (
              <div className="animate-in slide-in-from-top-4 duration-300">
                 {profileAddresses.length > 0 && (
                   <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-blue-50 rounded-2xl text-blue-700">
                      <input 
                        type="checkbox" 
                        checked={useProfileAddress} 
                        onChange={e => setUseProfileAddress(e.target.checked)} 
                        className="w-4 h-4 rounded accent-blue-600"
                      />
                      <span className="text-[10px] font-black uppercase">Use Saved Address</span>
                   </div>
                 )}
                 
                 <textarea 
                   value={customer.address}
                   onChange={e => setCustomer({...customer, address: e.target.value})}
                   className="w-full bg-slate-50 border-none rounded-3xl px-6 py-6 text-xs font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all h-32 resize-none"
                   placeholder="Enter detailed delivery address..."
                 />
              </div>
            )}
         </div>
      </section>

      {/* 2. Payment Section */}
      <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
         <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-8 flex items-center gap-3">
           <Banknote size={18} className="text-emerald-500" /> Payment Method
         </h3>

         <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <PaymentOption active={paymentMethod === 'cash'} onClick={() => setPaymentMethod('cash')} icon={Banknote} label="Cash / COD" />
            <PaymentOption active={paymentMethod === 'transfer'} onClick={() => setPaymentMethod('transfer')} icon={CreditCard} label="Bank Transfer" />
            <PaymentOption active={paymentMethod === 'qris_bri'} onClick={() => setPaymentMethod('qris_bri')} icon={Store} label="QRIS / BRI" />
            <PaymentOption active={paymentMethod === 'wallet'} onClick={() => setPaymentMethod('wallet')} icon={Wallet} label="Store Wallet" />
            {userData?.canTempo && (
              <PaymentOption active={paymentMethod === 'tempo'} onClick={() => setPaymentMethod('tempo')} icon={Clock} label="Payment Tempo" />
            )}
         </div>

         {paymentMethod === 'tempo' && (
            <div className="mt-6 animate-in zoom-in-95">
               <label className="text-[10px] font-black uppercase text-slate-300 ml-4 mb-2 block">Due Date</label>
               <input 
                 type="date" 
                 value={tempoDueDate} 
                 onChange={e => setTempoDueDate(e.target.value)}
                 className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-xs font-bold outline-none" 
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
      onClick={onClick}
      className={`p-5 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-2 group ${active ? 'border-green-600 bg-green-50/30' : 'border-slate-50 bg-slate-50 hover:bg-white hover:border-slate-200'}`}
    >
       <Icon size={20} className={active ? 'text-green-700' : 'text-slate-400 group-hover:text-slate-600'} />
       <span className={`text-[10px] font-black uppercase tracking-tight text-center ${active ? 'text-green-900' : 'text-slate-400'}`}>{label}</span>
    </button>
  );
}
