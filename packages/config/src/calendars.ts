/** Market sessions (D-289): each calendar is its feed's own Pyth schedule; ids are `MarketCalendar` ids on chain. */

export type CalendarId = 0 | 1 | 2 | 3;

export interface CalendarSpec {
  name: string;
  /**
   * The feed's own Pyth schedule (`America/New_York;Mon,…,Sun;MMDD/day,…`): the price moves only while it publishes,
   * so this is the session. Dated entries cover about a year ahead; refresh from Hermes before the last one passes.
   */
  schedule: string;
}

/** Calendar ids are `MarketCalendar` ids on chain; 0 is never configured there (always open). */
export const CALENDARS: Readonly<Record<CalendarId, CalendarSpec>> = {
  0: { name: "Always open", schedule: "America/New_York;O,O,O,O,O,O,O;" },
  1: {
    name: "US stocks",
    schedule:
      "America/New_York;0930-1600,0930-1600,0930-1600,0930-1600,0930-1600,C,C;0907/C,1126/C,1127/0930-1300,1224/0930-1300,1225/C,0101/C,0118/C,0215/C,0326/C,0531/C,0618/C,0705/C",
  },
  2: {
    name: "Metals",
    schedule:
      "America/New_York;0000-1700&1800-2400,0000-1700&1800-2400,0000-1700&1800-2400,0000-1700&1800-2400,0000-1700,C,1800-2400;0907/0000-1430&1800-2400,1126/0000-1430&1800-2400,1127/0000-1445,1224/0000-1345,1225/C,1231/0000-1700,0101/C,0118/0000-1430&1800-2400,0215/0000-1430&1800-2400,0325/0000-1700,0326/C,0531/0000-1430&1800-2400,0618/0000-1300,0705/0000-1430&1800-2400",
  },
  3: { name: "Currencies", schedule: "America/New_York;O,O,O,O,0000-1700,C,1700-2400;1224/0000-1700,1231/0000-1700" },
};
