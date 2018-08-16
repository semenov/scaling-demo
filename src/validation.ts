import * as Ajv from 'ajv';

class ValidationError extends Error {
  errors: any;

  constructor(errorsText, errors) {
    super(errorsText);
    this.errors = errors;
  }
}

export function validateSchema(schema: object, object: object): void {
  const ajv = new Ajv();
  const validationResult = ajv.validate(schema, object) as boolean;

  if (!validationResult) {
    throw new ValidationError(ajv.errorsText(), ajv.errors);
  }
}
