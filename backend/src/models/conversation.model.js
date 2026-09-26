// Mongoose model for a chat conversation with an inventory LLM agent.
// `user` references the User model BY ObjectId via `ref: 'User'` — the model
// is not imported/required here, so mongoose builds the model regardless of
// whether `User` exists yet.
import mongoose from 'mongoose';

const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    role: { type: String, required: true },
    content: { type: String, required: true },
    toolCalls: { type: Array, default: undefined },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const conversationSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: { type: String, default: '' },
    messages: { type: [messageSchema], default: [] },
    mode: {
      type: String,
      enum: ['SAFE', 'REVIEW', 'AGENT'],
      default: 'SAFE',
    },
    status: { type: String, default: 'active' },
  },
  { timestamps: true }
);

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;