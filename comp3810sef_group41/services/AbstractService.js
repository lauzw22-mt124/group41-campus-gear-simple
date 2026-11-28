/**
 * Template-method base class for Mongoose-backed services.
 *
 * The public CRUD methods below own the shared flow: normalise input through
 * {@link AbstractService#validatePayload}, translate missing records into 404,
 * run update validators and keep deletes transactional. Subclasses implement
 * the resource-specific hooks. The class cannot be instantiated directly.
 */

const mongoose = require('mongoose');
const { fail } = require('../helpers');

class AbstractService {
  /**
   * @param {import('mongoose').Model} Model Mongoose model managed by the service.
   * @param {{name: string, defaultSort?: Record<string, 1 | -1>}} options
   *   Display name in error messages and the default sort order.
   */
  constructor(Model, { name, defaultSort = { _id: 1 } }) {
    if (new.target === AbstractService) {
      throw new Error('AbstractService cannot be instantiated directly.');
    }
    this.Model = Model;
    this.name = name;
    this.defaultSort = defaultSort;
  }

  /**
   * Normalises a writable payload and rejects unknown fields.
   * @abstract
   * @param {Record<string, unknown>} data Raw request body.
   * @returns {Record<string, unknown>} Sanitised fields for MongoDB.
   */
  validatePayload(data) {
    throw new Error(`${this.constructor.name} must implement validatePayload().`);
  }

  /**
   * Builds a Mongo filter from a record ID or a natural key.
   * @abstract
   * @param {string|Record<string, string>} key Record ID or `{ assetCode }` style key.
   * @returns {Record<string, unknown>} MongoDB filter.
   */
  buildFilter(key) {
    throw new Error(`${this.constructor.name} must implement buildFilter().`);
  }

  /**
   * Builds the Mongoose query used by {@link AbstractService#list}. Returning
   * a Query lets subclasses add search filters, sorting or population.
   * @abstract
   * @param {Record<string, unknown>} query Express query object.
   * @returns {import('mongoose').Query} Ready-to-run query.
   */
  buildQuery(query) {
    throw new Error(`${this.constructor.name} must implement buildQuery().`);
  }

  /**
   * Mongo condition used for the final delete. Subclasses may add guards
   * (such as a status check) to keep the delete atomic.
   * @param {{_id: unknown}} item Loaded document.
   * @returns {Record<string, unknown>} Delete condition.
   */
  deleteCondition(item) {
    return { _id: item._id };
  }

  /**
   * Hook that may refuse a deletion by throwing through `fail()`.
   * @param {Record<string, unknown>} item Loaded document.
   * @param {import('mongoose').ClientSession} session Active transaction.
   * @returns {Promise<void>}
   */
  async assertDeletable(item, session) {}

  /**
   * Lists records matching the query.
   * @param {Record<string, unknown>} [query] Express query object.
   * @returns {Promise<Record<string, unknown>[]>} Plain documents.
   */
  async list(query = {}) {
    return this.buildQuery(query).lean();
  }

  /**
   * Loads one record or throws 404.
   * @param {string|Record<string, string>} key Record ID or natural key.
   * @returns {Promise<Record<string, unknown>>} Plain document.
   */
  async get(key) {
    const item = await this.Model.findOne(this.buildFilter(key)).lean();
    if (!item) fail(404, 'NOT_FOUND', `${this.name} not found.`);
    return item;
  }

  /**
   * Creates a record from a validated payload.
   * @param {Record<string, unknown>} data Raw request body.
   * @returns {Promise<Record<string, unknown>>} Created document.
   */
  async create(data) {
    return this.Model.create(this.validatePayload(data));
  }

  /**
   * Replaces the writable fields of one record or throws 404.
   * @param {string|Record<string, string>} key Record ID or natural key.
   * @param {Record<string, unknown>} data Raw request body.
   * @returns {Promise<Record<string, unknown>>} Updated document.
   */
  async update(key, data) {
    const item = await this.Model.findOneAndUpdate(
      this.buildFilter(key),
      { $set: this.validatePayload(data) },
      { new: true, runValidators: true },
    );
    if (!item) fail(404, 'NOT_FOUND', `${this.name} not found.`);
    return item;
  }

  /**
   * Deletes one record inside a transaction after `assertDeletable()` passes.
   * @param {string|Record<string, string>} key Record ID or natural key.
   * @returns {Promise<void>}
   */
  async remove(key) {
    const filter = this.buildFilter(key);
    await mongoose.connection.transaction(async (session) => {
      const item = await this.Model.findOne(filter).session(session);
      if (!item) fail(404, 'NOT_FOUND', `${this.name} not found.`);
      await this.assertDeletable(item, session);
      await this.Model.deleteOne(this.deleteCondition(item)).session(session);
    });
  }
}

module.exports = AbstractService;
