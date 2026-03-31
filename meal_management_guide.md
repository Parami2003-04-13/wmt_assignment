# Meal Management Implementation Guide

Welcome! Your objective is to build the **Meal Management** system for Stall Owners. This involves creating the backend model, CRUD routes, and the frontend UI in the Expo app.

## 🛠️ Step 1: Backend (Node.js/Express/MongoDB)

### 1.1 Create the Meal Model
Create `backend/models/Meal.js`:
```javascript
const mongoose = require('mongoose');

const MealSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  category: { type: String, enum: ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Drinks'], required: true },
  imageUrl: { type: String },
  isAvailable: { type: Boolean, default: true },
  stall: { type: mongoose.Schema.Types.ObjectId, ref: 'Stall', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Meal', MealSchema);
```

### 1.2 Create Meal Routes
Create `backend/routes/meals.js` for CRUD operations:
- `POST /api/meals` - Add a new meal.
- `GET /api/meals/stall/:stallId` - Fetch all meals for a specific stall.
- `PUT /api/meals/:id` - Update meal details.
- `DELETE /api/meals/:id` - Delete a meal.

### 1.3 Register in `server.js`
Import and use the new routes in the main server file.

---

## 📱 Step 2: Frontend (React Native/Expo)

### 2.1 Display Meals for the Owner
In `src/app/owner/owner_dashboard.tsx`, add a section or a button to "Manage Menu".
- Fetch meals using `axios.get(`${API_URL}/api/meals/stall/${stallId}`)`.
- Display them in a `FlatList` with `name`, `price`, and `isAvailable` status.

### 2.2 Add Meal Modal/Screen
Create a form to add a meal:
- `TextInput` for Name, Price, and Description.
- `Picker` or `Select` for Category.
- `Button` to pick an image (use `expo-image-picker`).
- Submit to `POST /api/meals`.

---

## 🚀 Step 3: Integration & Testing
1. Use **Postman** to test your APIs first.
2. Ensure the `stallId` is passed correctly from the frontend (you can get this from the owner's profile after they login).
3. Test the "Availability" toggle so owners can mark items as "Sold Out".
