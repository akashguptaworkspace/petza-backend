import { DataTypes, Model } from 'sequelize';

import { KycDocStatus, KycDocType } from '../config/constants.js';

/**
 * One uploaded proof per row (licence, registration certificate, owner ID
 * …). `fileUrl` currently holds whatever URI the app hands us — the
 * presigned-upload/`media` pipeline is a later phase, and this table points
 * at a `media_id` instead once that exists.
 *
 * This is the spec's `partner_documents` (PRODUCT_CONTEXT.md §5). It
 * already existed under this name with the same shape, so it was extended
 * with the doc type and the reviewer trail rather than duplicated under a
 * second name.
 */
export default (sequelize) => {
  class StoreKycDocument extends Model {
    static associate(db) {
      StoreKycDocument.belongsTo(db.Store, { as: 'store', foreignKey: 'storeId' });
      StoreKycDocument.belongsTo(db.User, { as: 'reviewer', foreignKey: 'reviewedBy' });
    }
  }

  StoreKycDocument.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      storeId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      fileUrl: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      /** What this upload is meant to prove — drives which slot it fills on the KYC screen. */
      docType: {
        type: DataTypes.ENUM(...Object.values(KycDocType)),
        allowNull: false,
        defaultValue: KycDocType.OTHER,
      },
      /** Reviewed per document, not per store: one rejected licence shouldn't invalidate an approved ID. */
      status: {
        type: DataTypes.ENUM(...Object.values(KycDocStatus)),
        allowNull: false,
        defaultValue: KycDocStatus.PENDING,
      },
      /** Shown to the partner verbatim so they know what to re-upload. */
      rejectionReason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      reviewedBy: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      reviewedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'StoreKycDocument',
      tableName: 'store_kyc_documents',
    }
  );

  return StoreKycDocument;
};
