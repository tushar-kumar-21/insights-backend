import mongoose, { Document, Schema } from 'mongoose';

export interface IAnalysis extends Document {
  userId: mongoose.Types.ObjectId;
  uploadId?: mongoose.Types.ObjectId;
  formId?: string;
  source: 'upload' | 'google_form';
  summary: string;
  detailedReport?: string;
  responsesTable?: string;
  markdownReport?: string;
}

const analysisSchema = new Schema<IAnalysis>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    uploadId: {
      type: Schema.Types.ObjectId,
      ref: 'Upload',
      required: false,
    },
    formId: {
      type: String,
      required: false,
    },
    source: {
      type: String,
      enum: ['upload', 'google_form'],
      default: 'upload',
    },
    summary: {
      type: String,
      required: true,
    },
    detailedReport: {
      type: String,
    },
    responsesTable: {
      type: String,
    },
    markdownReport: {
      type: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model<IAnalysis>('Analysis', analysisSchema);
