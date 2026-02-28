const express = require('express');
const app = express();

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

app.use(express.static('public'));
app.use('/node_modules', express.static('node_modules'));

app.listen(3000, () => console.log('http://localhost:3000'));
