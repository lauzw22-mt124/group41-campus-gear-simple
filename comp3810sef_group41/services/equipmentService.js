/**
 * Equipment CRUD service.
 *
 * Extends {@link AbstractService} with asset-code normalisation, search
 * filters, maintenance transitions and the deletion guard that protects loan
 * history. Both the web routes and the JSON API call this single instance.
 */

const AbstractService = require('./AbstractService');
const Equipment = require('../models/Equipment');
const Loan = require('../models/Loan');
const v = require('../helpers');
const { fail } = require('../helpers');

const categories = Equipment.schema.path('category').enumValues;
const statuses = ['available', 'borrowed', 'maintenance'];

class EquipmentService extends AbstractService {
  constructor() {
    super(Equipment, { name: 'Equipment', defaultSort: { assetCode: 1 } });
  }

  /**
   * Uppercases an asset code and checks the allowed character set.
   * @param {unknown} value Raw asset code.
   * @returns {string} Normalised asset code.
   */
  normalizeAssetCode(value) {
    const assetCode = v.text(value, 'Asset code', { max: 32 }).toUpperCase();
    if (!/^[A-Z0-9-]+$/.test(assetCode)) {
      fail(400, 'INVALID_INPUT', 'Asset codes must contain only letters, digits and hyphens.');
    }
    return assetCode;
  }

  /**
   * Accepts a database ID or a `{ assetCode }` key used by the by-code routes.
   * @param {string|{assetCode: string}} key Record ID or asset-code key.
   * @returns {Record<string, unknown>} MongoDB filter.
   */
  buildFilter(key) {
    if (typeof key === 'object' && key?.assetCode !== undefined) {
      return { assetCode: this.normalizeAssetCode(key.assetCode) };
    }
    return { _id: v.id(key) };
  }

  /** @inheritdoc */
  validatePayload(data) {
    v.allowed(data, ['assetCode', 'name', 'category', 'location', 'description']);
    return {
      assetCode: this.normalizeAssetCode(data.assetCode),
      name: v.text(data.name, 'Name'),
      category: v.choice(data.category, categories, 'Category'),
      location: v.text(data.location, 'Location'),
      description: v.text(data.description, 'Notes', { required: false, max: 1000 }),
    };
  }

  /** @inheritdoc */
  buildQuery(query = {}) {
    v.filters(query, ['q', 'category', 'status']);
    const filter = {};
    const q = v.text(query.q, 'Keyword', { required: false, max: 80 });
    if (q) {
      const pattern = new RegExp(v.literal(q), 'i');
      filter.$or = [{ name: pattern }, { assetCode: pattern }];
    }
    if (query.category) filter.category = v.choice(query.category, categories, 'Category');
    if (query.status) filter.status = v.choice(query.status, statuses, 'Status');
    return Equipment.find(filter).sort(this.defaultSort);
  }

  /** @inheritdoc */
  deleteCondition(item) {
    return { _id: item._id, status: 'available' };
  }

  /**
   * Only available equipment without any loan history may be deleted.
   * @inheritdoc
   */
  async assertDeletable(item, session) {
    if (item.status !== 'available') {
      fail(409, 'NOT_AVAILABLE', 'Only available equipment can be deleted.');
    }
    if (await Loan.exists({ equipmentId: item._id }).session(session)) {
      fail(409, 'HAS_LOAN_HISTORY', 'Equipment with loan history cannot be deleted.');
    }
  }

  /**
   * Moves equipment between `available` and `maintenance`.
   * @param {string} value Equipment database ID.
   * @param {'available'|'maintenance'} target Target status.
   * @returns {Promise<Record<string, unknown>>} Updated document.
   */
  async setMaintenance(value, target) {
    v.id(value);
    v.choice(target, ['available', 'maintenance'], 'Maintenance state');
    const from = target === 'maintenance' ? 'available' : 'maintenance';
    const item = await Equipment.findOneAndUpdate(
      { _id: value, status: from },
      { $set: { status: target } },
      { new: true },
    );
    if (!item) {
      await this.get(value);
      fail(409, 'INVALID_TRANSITION', 'The current equipment state does not allow this operation.');
    }
    return item;
  }
}

module.exports = new EquipmentService();
