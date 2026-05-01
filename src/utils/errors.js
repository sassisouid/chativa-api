'use strict';

/**
 * Base application error class.
 * All operational errors should extend this class.
 */
class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} statusCode
   */
  constructor(message, statusCode) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = true;
    // Capture stack trace, excluding the constructor call from it
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Validation error — returned when request input fails validation.
 * HTTP 422 Unprocessable Entity.
 */
class ValidationError extends AppError {
  /**
   * @param {string} message
   * @param {string[]} [fields=[]] — list of field names that failed validation
   */
  constructor(message, fields = []) {
    super(message, 422);
    this.fields = fields;
  }
}

/**
 * Authentication error — returned when a request is not authenticated.
 * HTTP 401 Unauthorized.
 */
class AuthError extends AppError {
  /**
   * @param {string} [message='Authentication required']
   */
  constructor(message = 'Authentication required') {
    super(message, 401);
  }
}

/**
 * Not found error — returned when a requested resource does not exist.
 * HTTP 404 Not Found.
 */
class NotFoundError extends AppError {
  /**
   * @param {string} [resource='Resource']
   */
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
  }
}

/**
 * Conflict error — returned when a request conflicts with existing state.
 * HTTP 409 Conflict.
 */
class ConflictError extends AppError {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message, 409);
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthError,
  NotFoundError,
  ConflictError,
};
