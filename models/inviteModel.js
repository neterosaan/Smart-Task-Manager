const mongoose= require('mongoose')

const inviteSchema = new mongoose.Schema(

    {
        team: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Team',
          required: true,
        },
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        status: {
          type: String,
          enum: ['pending', 'accepted', 'declined'],
          default: 'pending',
        },
        invitedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User', 
          required: true,
        },
      },
      { timestamps: true }
    );  


    
        const Invite = mongoose.model('Invite', inviteSchema);
        module.exports = Invite;