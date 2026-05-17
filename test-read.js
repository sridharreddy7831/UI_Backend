require('dotenv').config();
const mongoose = require('mongoose');
const ContactMessage = require('./models/ContactMessage');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected');
  const message = await ContactMessage.create({
    name: 'Test',
    phone: '1234567890',
    email: 'test@test.com',
    eventType: 'Wedding',
    eventDate: '2026-05-17',
    message: 'Test message',
  });
  console.log('Created ID:', message._id);

  const updated = await ContactMessage.findByIdAndUpdate(message._id, { read: true }, { new: true });
  console.log('Updated object JSON:', JSON.stringify(updated));
  
  await ContactMessage.findByIdAndDelete(message._id);
  console.log('Cleaned up');
  process.exit(0);
}

test();
