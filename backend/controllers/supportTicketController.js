const SupportTicket = require('../models/SupportTicket');
const { authUserFromRequest } = require('../utils/authRequest');

exports.createTicket = async (req, res) => {
  const { stallId, title, description, screenshot } = req.body;
  if (!stallId || !title || !description || description.length < 10) {
    return res.status(400).json({ message: 'Title and description (min 10 chars) are required.' });
  }
  try {
    const auth = await authUserFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    const newSupportTicket = new SupportTicket({
      stall: stallId,
      user: auth._id,
      title,
      description,
      screenshot: screenshot || '',
      staffHasSeenSupportTicket: false,
      userHasSeenReply: true
    });
    await newSupportTicket.save();
    res.status(201).json(newSupportTicket);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getUserTickets = async (req, res) => {
  try {
    const auth = await authUserFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    const supportTickets = await SupportTicket.find({ stall: req.params.stallId, user: auth._id })
      .populate('repliedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(supportTickets);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateTicket = async (req, res) => {
  try {
    const auth = await authUserFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    const supportTicket = await SupportTicket.findById(req.params.id);
    if (!supportTicket) return res.status(404).json({ message: 'Support ticket not found' });
    if (supportTicket.user.toString() !== auth._id.toString()) return res.status(403).json({ message: 'Not your support ticket' });
    if (supportTicket.reply) return res.status(400).json({ message: 'Cannot update a support ticket that has a reply' });

    const { title, description, screenshot } = req.body;
    let edited = false;
    if (title && title !== supportTicket.title) { supportTicket.title = title; edited = true; }
    if (description && description.length >= 10 && description !== supportTicket.description) { supportTicket.description = description; edited = true; }
    if (screenshot !== undefined && screenshot !== supportTicket.screenshot) { supportTicket.screenshot = screenshot; edited = true; }
    
    if (edited) {
      supportTicket.userEditedAt = new Date();
      supportTicket.staffHasSeenSupportTicket = false;
    }

    await supportTicket.save();
    res.json(supportTicket);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteTicket = async (req, res) => {
  try {
    const auth = await authUserFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    const supportTicket = await SupportTicket.findById(req.params.id);
    if (!supportTicket) return res.status(404).json({ message: 'Support ticket not found' });
    if (supportTicket.user.toString() !== auth._id.toString()) return res.status(403).json({ message: 'Not your support ticket' });
    if (supportTicket.reply) return res.status(400).json({ message: 'Cannot delete a support ticket that has a reply' });

    await SupportTicket.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getStallTickets = async (req, res) => {
  try {
    const auth = await authUserFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    const { date } = req.query;
    let query = { stall: req.params.stallId };

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: start, $lte: end };
    }

    const supportTickets = await SupportTicket.find(query)
      .populate('user', 'name email')
      .populate('repliedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(supportTickets);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.replyToTicket = async (req, res) => {
  try {
    const { reply } = req.body;
    const auth = await authUserFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    const supportTicket = await SupportTicket.findById(req.params.id);
    if (!supportTicket) return res.status(404).json({ message: 'Support ticket not found' });

    const isEditing = supportTicket.reply && supportTicket.reply !== reply;
    supportTicket.reply = reply;
    supportTicket.status = reply ? 'Solved' : 'Pending';
    
    if (!reply) {
      supportTicket.repliedBy = null;
      supportTicket.repliedAt = null;
      supportTicket.replyEditedAt = null;
      supportTicket.userHasSeenReply = true;
    } else if (isEditing) {
      supportTicket.replyEditedAt = new Date();
      supportTicket.userHasSeenReply = false;
    } else if (!supportTicket.repliedAt) {
      supportTicket.repliedAt = new Date();
      supportTicket.userHasSeenReply = false;
    }

    if (reply) {
      supportTicket.repliedBy = auth._id;
    }

    await supportTicket.save();
    res.json(supportTicket);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.markSeenByUser = async (req, res) => {
  try {
    const auth = await authUserFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    await SupportTicket.updateMany(
      { stall: req.params.stallId, user: auth._id, userHasSeenReply: false },
      { $set: { userHasSeenReply: true } }
    );
    res.json({ message: 'Marked as seen' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.markSeenByStaff = async (req, res) => {
  try {
    const auth = await authUserFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    await SupportTicket.updateMany(
      { stall: req.params.stallId, staffHasSeenSupportTicket: false },
      { $set: { staffHasSeenSupportTicket: true } }
    );
    res.json({ message: 'Marked as seen' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getUnreadCountByUser = async (req, res) => {
  try {
    const auth = await authUserFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    const count = await SupportTicket.countDocuments({ 
      stall: req.params.stallId, 
      user: auth._id, 
      userHasSeenReply: false 
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getUnreadCountByStaff = async (req, res) => {
  try {
    const auth = await authUserFromRequest(req);
    if (!auth) return res.status(401).json({ message: 'Unauthorized' });

    const count = await SupportTicket.countDocuments({ 
      stall: req.params.stallId, 
      staffHasSeenSupportTicket: false 
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
