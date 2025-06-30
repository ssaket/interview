require('dotenv').config();
const AppController = require('./app-controller');

// bootstrap the new controller (comment-out the old call once migrated)
new AppController().start();
