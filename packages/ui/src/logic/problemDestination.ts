import type {ProjectProblemDestination} from '@openisd/design';

/** The desktop field corresponding to a project problem. */
export function desktopProblemField(destination: ProjectProblemDestination, portCount: number): string | null {
  const ids: Record<string, string> = {
    'box.volume': 'og-box-volume', 'box.frontVolume': 'og-front-volume',
    'box.rearTuning': 'og-rear-tuning', 'enclosure.count': 'og-pr-count',
    'enclosure.tuning': 'og-pr-fp', 'enclosure.addedMass': 'og-pr-madd',
    'driver.project.nDrivers': 'og-ndrivers', 'signal.power': 'og-signal-power',
    'signal.voltage': 'og-signal-voltage', 'signal.resistance': 'og-signal-resistance',
    'advanced.temperature': 'og-air-temperature', 'advanced.humidity': 'og-air-humidity',
    'advanced.pressure': 'og-air-pressure', 'advanced.soundSpeed': 'og-air-sound-speed',
    'advanced.airDensity': 'og-air-density',
  };
  const direct = ids[`${destination.area}.${destination.field}`];
  if (direct) return direct;
  if (destination.area === 'box' && destination.field.startsWith('losses.')) {
    const [, chamber, loss] = destination.field.split('.');
    return chamber && loss ? `og-losses-${chamber}-${loss.toLowerCase()}` : null;
  }
  if (destination.area !== 'enclosure') return null;
  const [port, field] = destination.field.split('.');
  if (!port || !field || !['Vent', 'Rear', 'Front', 'Intra'].includes(port)) return null;
  const suffix = port.toLowerCase();
  if (field === 'tuning') return portCount === 1 ? 'og-vent-fb-target' : `og-vent-tuning-${suffix}`;
  if (field === 'length_m') return portCount === 1 ? 'og-vent-length' : `og-vent-length-${suffix}`;
  if (field === 'count') return portCount === 1 ? 'vent-count' : `og-vent-count-${suffix}`;
  const dimensions: Record<string, string> = {diameter_m: 'diameter', width_m: 'width', height_m: 'height'};
  return dimensions[field] ? `og-vent-${dimensions[field]}-${suffix}` : null;
}

/** The phone field corresponding to a project problem. */
export function mobileProblemField(destination: ProjectProblemDestination): string | null {
  const ids: Record<string, string> = {
    'box.volume': 'mob-box-volume', 'box.frontVolume': 'mob-front-volume', 'box.rearTuning': 'mob-vent-rear-tuning',
    'enclosure.count': 'mob-pr-count', 'enclosure.tuning': 'mob-pr-fp', 'enclosure.addedMass': 'mob-pr-madd', 'driver.project.nDrivers': 'mob-n-drivers',
    'signal.power': 'mob-signal-power', 'signal.voltage': 'mob-signal-voltage',
    'signal.resistance': 'mob-signal-resistance', 'advanced.temperature': 'mob-air-temperature',
    'advanced.humidity': 'mob-air-humidity', 'advanced.pressure': 'mob-air-pressure',
    'advanced.soundSpeed': 'mob-air-sound-speed', 'advanced.airDensity': 'mob-air-air-density',
  };
  const direct = ids[`${destination.area}.${destination.field}`];
  if (direct) return direct;
  if (destination.area === 'box' && destination.field.startsWith('losses.')) {
    const [, chamber, loss] = destination.field.split('.');
    return chamber && loss ? `mob-losses-${chamber}-${loss.toLowerCase()}` : null;
  }
  if (destination.area !== 'enclosure') return null;
  const [port, field] = destination.field.split('.');
  if (!port || !field || !['Vent', 'Rear', 'Front', 'Intra'].includes(port)) return null;
  return `mob-vent-${port.toLowerCase()}-${field}`;
}
