import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Alert } from 'react-native';

export interface CartItem {
  meal: any;
  quantity: number;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (meal: any, quantity?: number) => void;
  removeFromCart: (mealId: string) => void;
  clearCart: () => void;
  cartTotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const addToCart = (meal: any, quantity: number = 1) => {
    setCartItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.meal._id === meal._id);
      if (existingItem) {
        return prevItems.map((item) =>
          item.meal._id === meal._id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prevItems, { meal, quantity }];
    });
  };

  const removeFromCart = (mealId: string) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.meal._id !== mealId));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const cartTotal = cartItems.reduce(
    (total, item) => total + (item.meal.price * item.quantity),
    0
  );

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, clearCart, cartTotal }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
