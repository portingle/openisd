import type {Complex, Filter, FilterIssue} from '../types.js';
import {cx} from '../complex.js';
import {
  FILTER_BW_LIMITS, FILTER_FC_LIMITS, FILTER_GAIN_LIMITS, FILTER_ORDER_LIMITS, FILTER_Q_LIMITS,
  FILTER_T_LIMITS, PEAK_HIGHPASS_GAIN_LIMITS, type FieldLimits,
} from '../../fields/filterLimits.js';
import {LinkwitzRileyFamily} from './passFamilies/LinkwitzRileyFamily.js';
import {RAISED_COSINE_POSITIVE_FLOOR} from './RaisedCosineFilterModel.js';

// Leave headroom for the cascade and the sweep, which multiplies the squared magnitude by VA.
const MAX_RESPONSE_COMPONENT = Math.sqrt(Math.sqrt(Number.MAX_VALUE));
// Group delay squares the pressure response when taking its phase ratio. Treat extreme
// attenuation as silence before the ratio underflows or the force-flat inverse overflows.
const MIN_RESPONSE_COMPONENT = 1e-140;
// Bound the polynomial loops independently of the typing limit. Bessel needs (2n)! to fit.
const MAX_POLYNOMIAL_ORDER = 64;

type FilterProblem = {text: string; action: 'bypass' | 'check-response' | 'note'};

function isOutside(value: number, range: FieldLimits): boolean {
  return !(value >= range.min && value <= range.max);
}

function outsideRangeText(label: string, value: number, unit: string, range: FieldLimits): string {
  return `${label} ${value}${unit} is outside the usual range (${range.min} to ${range.max}${unit}).`;
}

/** Describe the stated numbers and identify filters whose response cannot be evaluated safely. */
function filterProblems(filter: Filter): FilterProblem[] {
  const problems: FilterProblem[] = [];
  const note = (text: string) => problems.push({text, action: 'note'});
  const bypass = (text: string) => problems.push({text, action: 'bypass'});
  const check = (label: string, value: number, unit: string, range: FieldLimits, minimum: 'positive' | 'nonnegative' | 'any') => {
    if (!Number.isFinite(value)) bypass(`${label} ${value}${unit} must be finite.`);
    else if (minimum === 'positive' && value <= 0) bypass(`${label} ${value}${unit} must be positive.`);
    else if (minimum === 'nonnegative' && value < 0) bypass(`${label} ${value}${unit} must be zero or positive.`);
    else if (isOutside(value, range)) {
      problems.push({text: outsideRangeText(label, value, unit, range), action: 'check-response'});
    }
  };
  const frequency = (label: string, value: number) => check(label, value, ' Hz', FILTER_FC_LIMITS, 'positive');
  const damping = (label: string, value: number) => check(label, value, '', FILTER_Q_LIMITS, 'positive');
  const unusedQ = (value: number) => {
    if (isOutside(value, FILTER_Q_LIMITS)) {
      note(`${outsideRangeText('Q', value, '', FILTER_Q_LIMITS)} This response does not use Q.`);
    }
  };
  const gain = (label: string, value: number, range: FieldLimits) => check(label, value, ' dB', range, 'any');
  const polynomialOrder = (order: number) => {
    if (!Number.isInteger(order)) bypass(`Order ${order} must be a whole number.`);
    else if (order < 1 || order > MAX_POLYNOMIAL_ORDER) {
      bypass(`Order ${order} is outside the calculation range (1 to ${MAX_POLYNOMIAL_ORDER}).`);
    } else check('Order', order, '', FILTER_ORDER_LIMITS, 'positive');
  };
  const raisedCosineParameter = (label: string, value: number, unit: string, range: FieldLimits) => {
    if (value <= 0) note(`${label} ${value}${unit} must be positive. The response uses ${RAISED_COSINE_POSITIVE_FLOOR}${unit}.`);
    else check(label, value, unit, range, 'positive');
  };

  switch (filter.type) {
    case 'lowpass':
    case 'highpass': {
      frequency('Cutoff frequency', filter.fc);
      if (filter.family !== 'sos') unusedQ(filter.Q);
      if (filter.family === 'linkwitzRiley') {
        const order = LinkwitzRileyFamily.evenOrder(filter.order);
        if (order !== filter.order) note(`Order ${filter.order} is stored. Linkwitz–Riley calculates at order ${order}.`);
      } else if (filter.family === 'sos') {
        if (filter.order !== 2) note(`Order ${filter.order} is stored. User SOS always calculates at order 2.`);
        damping('Q', filter.Q);
      } else {
        polynomialOrder(filter.order);
      }
      break;
    }
    case 'allpass':
      polynomialOrder(filter.order);
      check('Delay', filter.t, ' s', FILTER_T_LIMITS, 'nonnegative');
      if (filter.order === 2) damping('Q', filter.Q);
      else unusedQ(filter.Q);
      break;
    case 'linkwitz':
      frequency('Original frequency', filter.f0);
      damping('Q0', filter.Q0);
      frequency('Target frequency', filter.fp);
      damping('Qp', filter.Qp);
      break;
    case 'peaking':
    case 'lowshelf':
    case 'highshelf':
      frequency('Centre frequency', filter.fc);
      damping('Q', filter.Q);
      gain('Gain', filter.gain, FILTER_GAIN_LIMITS);
      break;
    case 'peakHighpass':
      frequency('Peak frequency', filter.fpk);
      // The model owns the existing explanation and bypass for a negative peak gain.
      if (filter.gainPk >= 0 || !Number.isFinite(filter.gainPk)) gain('Peak gain', filter.gainPk, PEAK_HIGHPASS_GAIN_LIMITS);
      break;
    case 'staticGain':
      gain('Gain', filter.gain, FILTER_GAIN_LIMITS);
      break;
    case 'raisedCosine':
      raisedCosineParameter('Centre frequency', filter.fc, ' Hz', FILTER_FC_LIMITS);
      raisedCosineParameter('Bandwidth', filter.bwOct, ' oct', FILTER_BW_LIMITS);
      gain('Gain', filter.gain, FILTER_GAIN_LIMITS);
      break;
  }
  return problems;
}

export function filterParameterIssue(filter: Filter): FilterIssue | null {
  const problems = filterProblems(filter);
  if (problems.length === 0) return null;
  const sentences = problems.map(problem => problem.text);
  if (problems.some(problem => problem.action === 'bypass')) {
    sentences.push('The chart uses unity gain (0 dB, no phase shift) for this filter.');
  } else if (problems.some(problem => problem.action === 'check-response')) {
    sentences.push('At numerical limits, the chart treats extreme attenuation as silence and uses unity gain (0 dB, no phase shift) for an unusable response.');
  }
  return {text: sentences.join(' ')};
}

/** Bypass only in the calculation, so an unusable section leaves the rest of the chain audible. */
export function safeFilterResponse(filter: Filter, response: () => Complex): Complex {
  if (filterProblems(filter).some(problem => problem.action === 'bypass')) return cx(1, 0);
  const result = response();
  const component = Math.max(Math.abs(result.re), Math.abs(result.im));
  if (!(component <= MAX_RESPONSE_COMPONENT)) return cx(1, 0);
  return component < MIN_RESPONSE_COMPONENT ? cx(0, 0) : result;
}
