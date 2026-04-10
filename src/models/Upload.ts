import mongoose, { Document, Schema } from 'mongoose';

export interface IUpload extends Document {
  userId: mongoose.Types.ObjectId;
  filename: string;
  originalName: string;
  rowCount: number;
  columnNames: string[];
}

const uploadSchema = new Schema<IUpload>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    rowCount: {
      type: Number,
      default: 0,
    },
    columnNames: [String],
  },
  { timestamps: true }
);

export default mongoose.model<IUpload>('Upload', uploadSchema);
