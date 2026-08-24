/** Parses `req[source]` against a Zod schema, replacing it with the parsed (typed, defaulted) value. Throws ZodError -> handled by errorHandler. */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    req[source] = schema.parse(req[source]);
    next();
  };
}
