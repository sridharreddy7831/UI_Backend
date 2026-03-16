require('dotenv').config();
const mongoose = require('mongoose');
const AdminUser = require('./models/AdminUser');

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB...');

        const users = [
            { name: 'Sridhar', email: 'sridhar@uthsav.com', password: 'Majeeda@2121' },
            { name: 'Nikkitha', email: 'nikkitha@uthsav.com', password: 'Majeeda@2121' }
        ];

        for (const u of users) {
            const exists = await AdminUser.findOne({ email: u.email });
            if (!exists) {
                await AdminUser.create(u);
                console.log(`✅ Created user: ${u.name} (${u.email})`);
            } else {
                console.log(`ℹ️ User ${u.name} already exists.`);
            }
        }

        process.exit(0);
    } catch (err) {
        console.error('Error seeding users:', err);
        process.exit(1);
    }
}

seed();
