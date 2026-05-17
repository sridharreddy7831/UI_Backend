const http = require('http');
const mongoose = require('mongoose');
const ContactMessage = require('./models/ContactMessage');
const AdminUser = require('./models/AdminUser');
require('dotenv').config();
const jwt = require('jsonwebtoken');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const admin = await AdminUser.findOne();
  const token = jwt.sign(
    { id: admin._id, email: admin.email, name: admin.name, iat: Math.floor(Date.now() / 1000) },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  const message = await ContactMessage.create({
    name: 'HTTP Test',
    phone: '1234567890',
    email: 'test@test.com',
  });

  const req = http.request({
    hostname: 'localhost',
    port: process.env.PORT || 4000,
    path: `/api/messages/${message._id}/read`,
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', async () => {
      console.log('HTTP Response:', data);
      await ContactMessage.findByIdAndDelete(message._id);
      process.exit(0);
    });
  });

  req.end();
}

test();
