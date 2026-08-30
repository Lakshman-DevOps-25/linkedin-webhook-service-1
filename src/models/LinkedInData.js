const mongoose = require("mongoose");

const linkedinDataSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["organization", "post", "comment"],
      required: true
    },

    linkedinId: {
      type: String,
      required: true,
      unique: true
    },

    organizationId: {
      type: String,
      default: null
    },

    organizationUrn: {
      type: String,
      default: null
    },

    organizationName: {
      type: String,
      default: null
    },

    postId: {
      type: String,
      default: null
    },

    author: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },

    text: {
      type: String,
      default: ""
    },

    createdAtLinkedIn: {
      type: Date,
      default: null
    },

    rawData: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "LinkedInData",
  linkedinDataSchema
);