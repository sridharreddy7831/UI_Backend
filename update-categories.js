const mongoose = require('mongoose');
const Category = require('./models/Category');
require('dotenv').config();

async function update() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected');
  
  const allowed = ['wedding-invitations', 'engagement-invitations', 'housewarming-invitations'];
  
  await Category.updateMany(
    { slug: { $nin: allowed } },
    { $set: { comingSoon: true } }
  );
  
  await Category.updateMany(
    { slug: { $in: allowed } },
    { $set: { comingSoon: false } }
  );

  console.log('Categories updated!');
  process.exit(0);
}

update();
