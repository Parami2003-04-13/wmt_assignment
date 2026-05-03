const Meal = require('../models/Meal');
const { authUserFromRequest, stallCanManageMeals } = require('../utils/authRequest');

// Create Meal
exports.createMeal = async (req, res) => {
  const { name, description, price, quantity, category, image, stallId } = req.body;

  if (!name || !description || price === undefined || quantity === undefined || !stallId) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  if (!image || !String(image).trim()) {
    return res.status(400).json({ message: 'Meal photo is required.' });
  }

  try {
    const auth = await authUserFromRequest(req);
    if (auth) {
      const { ok } = await stallCanManageMeals(stallId, auth._id.toString(), auth.role, auth.staffStallId);
      if (!ok) {
        return res.status(403).json({ message: 'You cannot add meals to this stall.' });
      }
    }

    const newMeal = new Meal({
      name,
      description,
      price,
      quantity,
      category,
      image: String(image).trim(),
      stall: stallId,
    });
    
    await newMeal.save();
    res.status(201).json(newMeal);
  } catch (err) {
    console.error('Meal creation error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get meals by Stall
exports.getMealsByStall = async (req, res) => {
  try {
    const meals = await Meal.find({ stall: req.params.stallId });
    res.json(meals);
  } catch (err) {
    console.error('Fetch meals error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get a single meal by ID
exports.getMealById = async (req, res) => {
  try {
    const meal = await Meal.findById(req.params.id);
    if (!meal) return res.status(404).json({ message: 'Meal not found' });
    res.json(meal);
  } catch (err) {
    console.error('Fetch meal error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update Meal
exports.updateMeal = async (req, res) => {
  try {
    const existing = await Meal.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Meal not found' });

    const auth = await authUserFromRequest(req);
    if (auth) {
      const stallId = existing.stall.toString();
      const { ok } = await stallCanManageMeals(stallId, auth._id.toString(), auth.role, auth.staffStallId);
      if (!ok) {
        return res.status(403).json({ message: 'You cannot edit this meal.' });
      }
    }

    const { name, description, price, quantity, category, image } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (price !== undefined) update.price = price;
    if (quantity !== undefined) update.quantity = quantity;
    if (category !== undefined) update.category = category;
    if (image !== undefined) update.image = image;

    const nextImage =
      update.image !== undefined ? String(update.image).trim() : String(existing.image || '').trim();
    if (!nextImage) {
      return res.status(400).json({ message: 'Meal photo is required.' });
    }
    if (update.image !== undefined) {
      update.image = nextImage;
    }

    const updatedMeal = await Meal.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    res.json(updatedMeal);
  } catch (err) {
    console.error('Update meal error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete Meal
exports.deleteMeal = async (req, res) => {
  try {
    const candidate = await Meal.findById(req.params.id);
    if (!candidate) return res.status(404).json({ message: 'Meal not found' });

    const auth = await authUserFromRequest(req);
    if (auth) {
      const stallId = candidate.stall.toString();
      const { ok } = await stallCanManageMeals(stallId, auth._id.toString(), auth.role, auth.staffStallId);
      if (!ok) {
        return res.status(403).json({ message: 'You cannot remove this meal.' });
      }
    }

    const deletedMeal = await Meal.findByIdAndDelete(req.params.id);
    if (!deletedMeal) return res.status(404).json({ message: 'Meal not found' });
    res.json({ message: 'Meal deleted successfully' });
  } catch (err) {
    console.error('Delete meal error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all meals (for Explore/Discovery)
exports.getAllMeals = async (req, res) => {
  try {
    const meals = await Meal.find().populate('stall', 'name');
    res.json(meals);
  } catch (err) {
    console.error('Fetch all meals error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
