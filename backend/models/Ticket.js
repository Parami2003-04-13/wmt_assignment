const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  stall: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stall',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true,
    minlength: 10
  },
  screenshot: {
    type: String,
    default: ''
  },
  reply: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['Pending', 'Solved'],
    default: 'Pending'
  },
  repliedAt: {
    type: Date,
    default: null
  },
  replyEditedAt: {
    type: Date,
    default: null
  },
  userEditedAt: {
    type: Date,
    default: null
  },
  userHasSeenReply: {
    type: Boolean,
    default: true
  },
  staffHasSeenTicket: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);
