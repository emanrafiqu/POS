import { createContext, useContext, useMemo, useReducer, useCallback } from 'react';
import { useSettings } from './SettingsContext';

/**
 * Billing cart state. Kept in a reducer so every mutation
 * (scan, +/-, coupon, hold/resume) flows through one place.
 */
const CartContext = createContext(null);

const initialState = {
  items: [],          // { productId, sku, name, size, color, unitPrice, purchasePrice, quantity, maxStock, image }
  customer: null,     // { id, name, phone, ... } or null (walk-in)
  coupon: null,       // { code, amount, description }
  manualDiscount: 0,  // flat amount entered by cashier
  notes: '',
};

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_PRODUCT': {
      const p = action.product;
      const existing = state.items.find((i) => i.productId === p.id);
      if (existing) {
        // Duplicate scan → bump quantity instead of adding a new row
        return {
          ...state,
          items: state.items.map((i) =>
            i.productId === p.id
              ? { ...i, quantity: Math.min(i.quantity + 1, i.maxStock) }
              : i
          ),
        };
      }
      return {
        ...state,
        items: [
          ...state.items,
          {
            productId: p.id,
            sku: p.sku,
            name: p.name,
            size: p.size || '',
            color: p.color || '',
            unitPrice: p.discountPrice || p.sellingPrice,
            purchasePrice: p.purchasePrice || 0,
            quantity: 1,
            maxStock: Number(p.stockQuantity) || 0,
            image: p.images?.[0] || null,
          },
        ],
      };
    }
    case 'SET_QUANTITY':
      return {
        ...state,
        items: state.items
          .map((i) =>
            i.productId === action.productId
              ? { ...i, quantity: Math.max(0, Math.min(action.quantity, i.maxStock)) }
              : i
          )
          .filter((i) => i.quantity > 0),
      };
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter((i) => i.productId !== action.productId) };
    case 'SET_CUSTOMER':
      return { ...state, customer: action.customer };
    case 'SET_COUPON':
      return { ...state, coupon: action.coupon, manualDiscount: action.coupon ? 0 : state.manualDiscount };
    case 'SET_MANUAL_DISCOUNT':
      return { ...state, manualDiscount: Math.max(0, Number(action.amount) || 0), coupon: null };
    case 'SET_NOTES':
      return { ...state, notes: action.notes };
    case 'RESTORE':
      return { ...initialState, ...action.state };
    case 'CLEAR':
      return initialState;
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { settings } = useSettings();

  const addProduct = useCallback((product) => dispatch({ type: 'ADD_PRODUCT', product }), []);
  const setQuantity = useCallback((productId, quantity) => dispatch({ type: 'SET_QUANTITY', productId, quantity }), []);
  const removeItem = useCallback((productId) => dispatch({ type: 'REMOVE_ITEM', productId }), []);
  const setCustomer = useCallback((customer) => dispatch({ type: 'SET_CUSTOMER', customer }), []);
  const setCoupon = useCallback((coupon) => dispatch({ type: 'SET_COUPON', coupon }), []);
  const setManualDiscount = useCallback((amount) => dispatch({ type: 'SET_MANUAL_DISCOUNT', amount }), []);
  const setNotes = useCallback((notes) => dispatch({ type: 'SET_NOTES', notes }), []);
  const restoreCart = useCallback((saved) => dispatch({ type: 'RESTORE', state: saved }), []);
  const clearCart = useCallback(() => dispatch({ type: 'CLEAR' }), []);

  const totals = useMemo(() => {
    const subtotal = state.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const discount = state.coupon ? state.coupon.amount : Math.min(state.manualDiscount, subtotal);
    const taxRate = Number(settings.taxRate) || 0;
    const taxAmount = Math.round(((subtotal - discount) * taxRate) / 100);
    const grandTotal = Math.max(0, subtotal - discount + taxAmount);
    const itemCount = state.items.reduce((s, i) => s + i.quantity, 0);
    return { subtotal, discount, taxRate, taxAmount, grandTotal, itemCount };
  }, [state.items, state.coupon, state.manualDiscount, settings.taxRate]);

  return (
    <CartContext.Provider
      value={{
        ...state, totals,
        addProduct, setQuantity, removeItem, setCustomer, setCoupon,
        setManualDiscount, setNotes, restoreCart, clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
