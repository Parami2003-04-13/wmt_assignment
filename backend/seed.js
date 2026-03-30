const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const mongoUri = process.env.MONGO_URI;

if (!mongoUri || mongoUri.includes('<username>')) {
  console.error('Error: Please update your MONGO_URI in backend/.env with your actual MongoDB Atlas credentials.');
  process.exit(1);
}

const seedDatabase = async () => {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB for seeding...');

    // Clear existing users? Optional.
    // await User.deleteMany({});

    const users = [
      {
        email: 'user@campusbites.com',
        password: 'password123',
        role: 'user',
        name: 'Regular Student'
      },
      {
        email: 'admin@campusbites.com',
        password: 'admin123',
        role: 'admin',
        name: 'Stall Manager'
      }
    ];

    for (const u of users) {
      const exists = await User.findOne({ email: u.email });
      if (!exists) {
        const newUser = new User(u);
        await newUser.save();
        console.log(`Created ${u.role}: ${u.email}`);
      } else {
        console.log(`${u.role} already exists: ${u.email}`);
      }
    }

    console.log('Seeding completed!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seedDatabase();
