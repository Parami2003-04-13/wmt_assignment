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
  updateQuantity: (mealId: string, quantity: number) => void;
  cartTotal: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// CartContext Provider
// Logic: Manages the global state of the user's shopping cart across the frontend application.
export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Add Item to Cart Logic
  // Validation: Ensures a user cannot add items from different stalls into the same cart.
  const addToCart = (meal: any, quantity: number = 1) => {
    if (cartItems.length > 0) {
      const existingStallId = cartItems[0].meal.stall?._id || cartItems[0].meal.stall;
      const newStallId = meal.stall?._id || meal.stall;

      if (existingStallId && newStallId && String(existingStallId) !== String(newStallId)) {
        Alert.alert(
          'Different Stall',
          'Your cart already contains items from another stall. Do you want to clear your cart and add this item instead?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Clear Cart & Add',
              style: 'destructive',
              onPress: () => setCartItems([{ meal, quantity }]),
            },
          ]
        );
        return;
      }
    }

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

  // Clear Cart Logic
  const clearCart = () => {
    setCartItems([]);
  };

  // Update Item Quantity Logic
  // Validation: If quantity drops to 0 or below, it removes the item entirely.
  const updateQuantity = (mealId: string, quantity: number) => {
    setCartItems((prevItems) => {
      if (quantity <= 0) {
        return prevItems.filter((item) => item.meal._id !== mealId);
      }
      return prevItems.map((item) =>
        item.meal._id === mealId ? { ...item, quantity } : item
      );
    });
  };

  // Calculate Cart Total Logic
  // Computes the total price of all items currently in the cart by iterating over the items.
  const cartTotal = cartItems.reduce(
    (total, item) => total + (item.meal.price * item.quantity),
    0
  );

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, clearCart, updateQuantity, cartTotal }}>
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
