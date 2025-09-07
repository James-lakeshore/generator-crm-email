const mongoose = require('mongoose');

const LeadSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  address: String,
  generatorType: String,
  budget: String,
  status: { type: String, default: 'New' },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('Lead', LeadSchema);
