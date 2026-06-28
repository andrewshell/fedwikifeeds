const dayjs = require('../lib/day');

describe('day', () => {
  it('exports a callable dayjs factory', () => {
    expect(typeof dayjs).toBe('function');
    expect(dayjs().isValid()).toBe(true);
  });

  it('has the utc plugin extended', () => {
    expect(typeof dayjs.utc).toBe('function');
    // A known instant formatted as UTC should not depend on the local timezone.
    expect(dayjs.utc('2022-01-02T03:04:05Z').format('YYYY-MM-DD HH:mm:ss')).toBe(
      '2022-01-02 03:04:05'
    );
  });

  it('returns the same singleton dayjs across requires', () => {
    expect(require('../lib/day')).toBe(dayjs);
  });
});
