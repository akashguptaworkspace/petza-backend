import { petAttributeRepository } from '../../repositories/shared/petAttribute.repository.js';
import { BadRequestError } from '../../shared/errors/AppError.js';

/** The sentinel the apps use for a picked "Other". Mirrors OTHER_VALUE in both add-pet forms. */
const OTHER_VALUE = '__other__';
const CHOICE_INPUT_TYPES = new Set(['SELECT', 'MULTI_SELECT']);

/**
 * Checks a listing's answers against the option registry, and rewrites each
 * choice to the exact value the registry holds.
 *
 * Two jobs, both of which the system was missing:
 *
 * **Rejection.** Nothing used to validate a choice, so anything a client
 * sent was stored. That is not hypothetical — a listing reached production
 * with breed `labrador`, a value in no option list, simply because the
 * caller typed it. A breed nobody can filter by is invisible in a browse
 * grid that filters on exact values, and no admin screen can fix what it
 * cannot enumerate.
 *
 * **Canonicalisation.** Matching is case-insensitive but the *stored* value
 * is always the registry's own spelling, so "Grey" is written as "grey".
 * Without this the same colour rendered two ways on two cards and counted
 * as two facets in any future filter.
 *
 * Only SELECT / MULTI_SELECT answers are touched. Free text, numbers, dates
 * and media have no registry to check against, and an attribute marked
 * `allowsOther` still accepts the `__other__` sentinel — that is what the
 * paired free-text field exists for.
 */
export async function canonicaliseAnswers(answers) {
  return (await resolveAnswers(answers)).answers;
}

/**
 * The same pass, but keeping what it resolved: the option row behind every
 * choice, so the caller can write the normalised rows without looking any
 * of them up a second time.
 *
 * Returns `{ answers, choices }` where `choices` is one entry per chosen
 * option — a multi-select contributes several — carrying the attribute and
 * option ids the join tables are keyed on.
 */
export async function resolveAnswers(answers) {
  const petType = answers?.petType ?? null;
  const attributes = await petAttributeRepository.findSchemaForValidation(petType);

  const canonical = { ...answers };
  const choices = [];

  for (const attribute of attributes) {
    if (!CHOICE_INPUT_TYPES.has(attribute.inputType)) continue;

    const submitted = canonical[attribute.key];
    if (submitted === undefined || submitted === null || submitted === '') continue;

    // Keyed by lower-case so a client's casing never has to match, and by id
    // so a client that already speaks ids can send one instead of a value.
    const byLowerValue = new Map((attribute.options ?? []).map((option) => [option.value.toLowerCase(), option]));
    const byId = new Map((attribute.options ?? []).map((option) => [option.id, option]));

    const record = (option) => {
      if (option) choices.push({ attributeId: attribute.id, attributeKey: attribute.key, option });
    };

    if (attribute.inputType === 'MULTI_SELECT') {
      const values = Array.isArray(submitted) ? submitted : [submitted];
      const resolved = values.map((value) => resolveOne(attribute, value, byLowerValue, byId));
      resolved.forEach((entry) => record(entry.option));
      canonical[attribute.key] = resolved.map((entry) => entry.value);
      continue;
    }

    const resolved = resolveOne(attribute, submitted, byLowerValue, byId);
    record(resolved.option);
    canonical[attribute.key] = resolved.value;
  }

  return { answers: canonical, choices };
}

/** `{ value, option }` — `option` is null only for the `__other__` sentinel, which references nothing by design. */
function resolveOne(attribute, value, byLowerValue, byId) {
  const raw = String(value).trim();
  if (attribute.allowsOther && raw === OTHER_VALUE) return { value: OTHER_VALUE, option: null };

  // An id wins over a value: a client sending one is being explicit, and it
  // survives the option being renamed underneath it.
  const match = byId.get(raw) ?? byLowerValue.get(raw.toLowerCase());
  if (match) return { value: match.value, option: match };

  // Named field and value, because this is the message a client developer
  // and an admin both have to act on.
  throw new BadRequestError(
    `"${raw}" is not a valid choice for ${attribute.label}. Pick one of the listed options${
      attribute.allowsOther ? ' or choose Other' : ''
    }.`
  );
}
