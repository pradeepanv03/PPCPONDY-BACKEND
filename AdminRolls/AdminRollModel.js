// models/RolePermission.js
const mongoose = require('mongoose');

const RolePermissionSchema = new mongoose.Schema({
  role: { type: String, required: true, unique: true },
  viewedFiles: [String]
});

module.exports = mongoose.model('RolePermission', RolePermissionSchema);
