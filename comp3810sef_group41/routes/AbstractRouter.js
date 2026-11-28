/**
 * Abstract base class for application routers.
 *
 * Subclasses implement `register()` and declare endpoints with the protected
 * helpers (`get`, `post`, `put`, `delete`, `use`). `build()` is a template
 * method that registers the routes once and returns the underlying Express
 * router. Express 5 forwards rejected async handlers to the global error
 * handler, so individual routes do not need try/catch blocks.
 */

const express = require('express');

class AbstractRouter {
  /** @type {import('express').Router} */
  #router;

  /**
   * @param {string} name Router name used in diagnostics.
   */
  constructor(name) {
    if (new.target === AbstractRouter) {
      throw new Error('AbstractRouter cannot be instantiated directly.');
    }
    this.name = name;
    this.#router = express.Router();
    this.registered = false;
  }

  /**
   * Declares the routes owned by this router.
   * @abstract
   * @returns {void}
   */
  register() {
    throw new Error(`${this.constructor.name} must implement register().`);
  }

  /**
   * Template method: registers the routes once and returns the Express router.
   * @returns {import('express').Router} Ready-to-mount router.
   */
  build() {
    if (!this.registered) {
      this.register();
      this.registered = true;
    }
    return this.#router;
  }

  /**
   * Registers a GET endpoint.
   * @param {string|RegExp|Array<string|RegExp>} path Route path.
   * @param {...import('express').RequestHandler} handlers Route handlers.
   * @returns {void}
   */
  get(path, ...handlers) {
    this.#router.get(path, ...handlers);
  }

  /**
   * Registers a POST endpoint.
   * @param {string|RegExp|Array<string|RegExp>} path Route path.
   * @param {...import('express').RequestHandler} handlers Route handlers.
   * @returns {void}
   */
  post(path, ...handlers) {
    this.#router.post(path, ...handlers);
  }

  /**
   * Registers a PUT endpoint.
   * @param {string|RegExp|Array<string|RegExp>} path Route path.
   * @param {...import('express').RequestHandler} handlers Route handlers.
   * @returns {void}
   */
  put(path, ...handlers) {
    this.#router.put(path, ...handlers);
  }

  /**
   * Registers a DELETE endpoint.
   * @param {string|RegExp|Array<string|RegExp>} path Route path.
   * @param {...import('express').RequestHandler} handlers Route handlers.
   * @returns {void}
   */
  delete(path, ...handlers) {
    this.#router.delete(path, ...handlers);
  }

  /**
   * Registers middleware or a nested router.
   * @param {string|import('express').RequestHandler} pathOrHandler Path or handler.
   * @param {...import('express').RequestHandler} handlers Additional handlers.
   * @returns {void}
   */
  use(pathOrHandler, ...handlers) {
    this.#router.use(pathOrHandler, ...handlers);
  }
}

module.exports = AbstractRouter;
