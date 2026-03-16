require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');
const AdminUser = require('./models/AdminUser');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB...\n');

    const adminEmail = process.env.ADMIN_EMAIL || await askQuestion('Enter admin email: ');
    const adminPassword = process.env.ADMIN_PASSWORD || await askQuestion('Enter admin password (min 8 chars): ');
    const adminName = process.env.ADMIN_NAME || await askQuestion('Enter admin name: ');

    if (!adminEmail || !adminPassword) {
      console.error('❌ Email and password are required');
      process.exit(1);
    }

    if (adminPassword.length < 8) {
      console.error('❌ Password must be at least 8 characters');
      process.exit(1);
    }

    // Check if admin already exists
    const exists = await AdminUser.findOne({ email: adminEmail.toLowerCase().trim() });
    if (exists) {
      console.log(`ℹ️ Admin ${adminEmail} already exists.`);
      process.exit(0);
    }

    // Create admin
    const admin = await AdminUser.create({
      email: adminEmail.toLowerCase().trim(),
      password: adminPassword,
      name: adminName || 'Administrator'
    });

    console.log(`\n✅ Admin account created successfully:`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Name: ${admin.name}`);
    console.log(`   Created at: ${admin.createdAt}`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding admin:', err.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

seed();
