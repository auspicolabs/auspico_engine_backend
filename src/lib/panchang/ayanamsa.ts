import { setSiderealMode, SiderealMode } from '@swisseph/node';

const AYANAMSA_BY_ID: Record<string, SiderealMode> = {
  lahiri: SiderealMode.Lahiri,
  faganbradley: SiderealMode.FaganBradley,
  fagan: SiderealMode.FaganBradley,
  deluce: SiderealMode.DeLuce,
  ramani: SiderealMode.Raman,
  raman: SiderealMode.Raman,
  ushashashi: SiderealMode.Ushashashi,
  krishnamurti: SiderealMode.Krishnamurti,
  kp: SiderealMode.Krishnamurti,
  djwhalkhul: SiderealMode.DjwhalKhul,
  yukteshwar: SiderealMode.Yukteshwar,
  jnbhasin: SiderealMode.JNBhasin,
  suryasiddhanta: SiderealMode.SuryaSiddhanta,
  truecitra: SiderealMode.TrueCitra,
  truerevati: SiderealMode.TrueRevati,
};

/** Maps the API's `ayanamsa` query param to a Swiss Ephemeris sidereal mode; unknown ids fall back to Lahiri. */
export function setSiderealModeFromQuery(id: string): void {
  const key = id
    .toLowerCase()
    .trim()
    .replace(/[\s_-]/g, '');
  setSiderealMode(AYANAMSA_BY_ID[key] ?? SiderealMode.Lahiri);
}
