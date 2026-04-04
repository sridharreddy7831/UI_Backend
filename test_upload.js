const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testUpload() {
  try {
    const token = jwt.sign({ id: 'test', email: 'admin@test.com' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const formData = new FormData();
    
    // We create a dummy image file locally to test success upload.
    fs.writeFileSync('dummy.jpg', 'fake image content');
    const file = new Blob([fs.readFileSync('dummy.jpg')], { type: 'image/jpeg' });
    formData.append('image', file, 'dummy.jpg');

    const res = await fetch('http://localhost:4000/api/uploads/image', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    
    console.log('Status:', res.status);
    console.log('Body:', await res.text());
  } catch(e) {
    console.error('Fetch error:', e);
  }
}
testUpload();
